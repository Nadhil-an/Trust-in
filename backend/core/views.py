"""Auth views — Login, Logout, Token Refresh, Profile, Change Password, User Management"""
from django.utils import timezone
from datetime import timedelta
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.conf import settings
from django.contrib.auth import authenticate
import re

from core.models import User, AuditLog, SystemNotification, Role, RoleFeaturePermission
from core.serializers import (UserSerializer, UserCreateSerializer,
                                UserUpdateSerializer, ChangePasswordSerializer,
                                AuditLogSerializer, NotificationSerializer, EventSerializer)
from core.permissions import IsAdmin, IsHR, IsAnyStaff


def set_auth_cookies(response, access_token, refresh_token):
    jwt_settings = settings.SIMPLE_JWT
    secure = jwt_settings.get('AUTH_COOKIE_SECURE', False)
    samesite = jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax')
    access_max_age = int(jwt_settings['ACCESS_TOKEN_LIFETIME'].total_seconds())
    refresh_max_age = int(jwt_settings['REFRESH_TOKEN_LIFETIME'].total_seconds())

    response.set_cookie('access_token', str(access_token), max_age=access_max_age,
                        httponly=True, secure=secure, samesite=samesite, path='/')
    response.set_cookie('refresh_token', str(refresh_token), max_age=refresh_max_age,
                        httponly=True, secure=secure, samesite=samesite, path='/api/auth/refresh/')
    return response


class LoginThrottle(AnonRateThrottle):
    rate = '30/minute'

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        import time, random
        from django.db.models import Q
        time.sleep(random.uniform(0.05, 0.15))

        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response({'error': 'Username and password are required.'}, status=400)

        # Flexible multi-identifier candidate search
        clean_username = username.strip()
        import re
        clean_digits = re.sub(r'[^0-9]', '', clean_username)[-10:]
        candidates = []

        # 1. Exact match by username, email, staff_uid, or full_name (Name)
        for u in User.objects.filter(
            Q(username__iexact=clean_username) |
            Q(email__iexact=clean_username) |
            Q(staff_uid__iexact=clean_username) |
            Q(full_name__iexact=clean_username)
        ):
            if u not in candidates:
                candidates.append(u)

        # 2. Match by phone digits (last 10 digits)
        if len(clean_digits) >= 10:
            for u in User.objects.filter(username__iexact=clean_digits):
                if u not in candidates:
                    candidates.append(u)
            for u in User.objects.exclude(phone='').iterator():
                if u.phone and u.phone.strip() in [clean_username, clean_digits]:
                    if u not in candidates:
                        candidates.append(u)

        # 3. Check if clean_username matches a Member by Name (full_name), Email, member_id, or phone
        from hr_module.models import Member
        clean_mem_id = clean_username.replace('SLCT/MEM/', '').replace('MEM-', '').strip()
        member_matches = list(Member.objects.filter(
            Q(full_name__iexact=clean_username) |
            Q(email__iexact=clean_username) |
            Q(member_id__iexact=clean_username) |
            Q(member_id__iexact=clean_mem_id)
        ))
        if len(clean_digits) >= 10:
            for m in Member.objects.all():
                if m.phone and m.phone.strip() in [clean_username, clean_digits] and m not in member_matches:
                    member_matches.append(m)

        for m in member_matches:
            if m.created_by and m.created_by not in candidates:
                candidates.append(m.created_by)
            for u in User.objects.filter(role=Role.MEMBER).filter(
                Q(full_name__iexact=m.full_name) |
                Q(email__iexact=m.email) |
                Q(username__iexact=m.member_id) |
                Q(username__iexact=clean_digits) |
                Q(username__iexact=clean_mem_id)
            ):
                if u not in candidates:
                    candidates.append(u)
            if m.phone:
                clean_mphone = m.phone.strip()
                for u in User.objects.filter(role=Role.MEMBER).iterator():
                    if u.phone and u.phone.strip() == clean_mphone and u not in candidates:
                        candidates.append(u)

        # Authenticate against all matching candidates
        user = None
        user_obj = None

        for candidate in candidates:
            if candidate.is_account_locked():
                continue
            u_auth = authenticate(request, username=candidate.username, password=password)
            if u_auth:
                user = u_auth
                user_obj = candidate
                break

        # Fallback to direct username authentication
        if not user:
            user = authenticate(request, username=clean_username, password=password)
            if user:
                user_obj = user

        if not user:
            if candidates:
                for candidate in candidates:
                    candidate.failed_login_attempts += 1
                    if candidate.failed_login_attempts >= 5:
                        candidate.locked_until = timezone.now() + timedelta(minutes=1)
                    candidate.save(update_fields=['failed_login_attempts', 'locked_until'])
                user_obj = candidates[0]
            AuditLog.objects.create(
                user=None, action='LOGIN_FAILED', module='AUTH',
                record_type='User', record_id=str(user_obj.id) if user_obj else '',
                description=f"Failed login for {username}",
                ip_address=getattr(request, 'audit_ip', None)
            )
            return Response({'error': 'Invalid credentials.'}, status=401)

        if not user.is_active:
            return Response({'error': 'Account is disabled.'}, status=403)

        # Reset failed attempts on success
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_ip = getattr(request, 'audit_ip', None)
        user.save(update_fields=['failed_login_attempts', 'locked_until', 'last_login_ip'])

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        AuditLog.objects.create(
            user=user, action='LOGIN', module='AUTH',
            record_type='User', record_id=str(user.id),
            description=f"Successful login by {user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        response = Response({
            'user': UserSerializer(user).data,
            'access': str(access),
            'refresh': str(refresh),
            'message': 'Login successful.'
        })
        set_auth_cookies(response, access, refresh)
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except TokenError:
            pass

        AuditLog.objects.create(
            user=request.user, action='LOGOUT', module='AUTH',
            record_type='User', record_id=str(request.user.id),
            description=f"Logout by {request.user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        response = Response({'message': 'Logged out successfully.'})
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response


class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'Refresh token not provided.'}, status=401)
        try:
            token = RefreshToken(refresh_token)
            user_id = token.get('user_id')
            if user_id:
                user = User.objects.filter(id=user_id).first()
                if not user or not user.is_active:
                    return Response({'error': 'User account is inactive or deleted.'}, status=401)
            access = token.access_token
            jwt_settings = settings.SIMPLE_JWT
            # Return access token in both JSON body (for mobile app) and cookie (for web)
            response = Response({
                'access': str(access),
                'message': 'Token refreshed.'
            })
            response.set_cookie('access_token', str(access),
                                max_age=int(jwt_settings['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                                httponly=True,
                                secure=jwt_settings.get('AUTH_COOKIE_SECURE', False),
                                samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'), path='/')
            return response
        except TokenError as e:
            return Response({'error': str(e)}, status=401)


class MemberSignupThrottle(AnonRateThrottle):
    rate = '3/minute'


class MemberSignupView(APIView):
    """Public endpoint — allows anyone to self-register as a MEMBER."""
    permission_classes = [AllowAny]
    throttle_classes = [MemberSignupThrottle]

    def post(self, request):
        data = request.data

        full_name  = (data.get('full_name') or '').strip()
        phone      = (data.get('phone') or '').strip()
        email      = (data.get('email') or '').strip()
        place      = (data.get('place') or '').strip()
        pincode    = (data.get('pincode') or '').strip()
        occupation = (data.get('occupation') or '').strip()
        password   = data.get('password') or ''

        # Combine place and pincode for address
        full_address = place
        if pincode:
            full_address += f" - {pincode}"

        # Validate required fields
        errors = {}
        if not full_name:
            errors['full_name'] = 'Full name is required.'
        if not phone:
            errors['phone'] = 'Phone number is required.'
        elif not re.match(r'^\d{10}$', phone):
            errors['phone'] = 'Phone number must be exactly 10 digits.'
        if not password or len(password) < 6:
            errors['password'] = 'Password must be at least 6 characters.'
        if errors:
            return Response(errors, status=400)

        # Build a unique username from phone number
        base_username = re.sub(r'[^0-9]', '', phone)[-10:] or full_name.lower().replace(' ', '_')
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        # Fallback for optional email
        if not email:
            email = f"{username}@member.local"

        # Create the auth User
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            phone=phone,
            role=Role.MEMBER,
            is_active=True,
        )

        # Create the corresponding Member profile
        from hr_module.models import Member
        Member.objects.create(
            full_name=full_name,
            phone=phone,
            email=email,
            address=full_address,
            occupation=occupation,
            created_by=user,
        )

        # Auto-login — generate tokens
        refresh = RefreshToken.for_user(user)
        access  = refresh.access_token

        AuditLog.objects.create(
            user=user, action='MEMBER_SIGNUP', module='AUTH',
            record_type='User', record_id=str(user.id),
            description=f"New member self-registered: {user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        response = Response({
            'user':    UserSerializer(user).data,
            'access':  str(access),
            'refresh': str(refresh),
            'message': 'Account created successfully!'
        }, status=201)
        set_auth_cookies(response, access, refresh)
        return response


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        print("INCOMING PATCH to ProfileView")
        print("FILES:", request.FILES)
        print("DATA:", request.data)
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            print("SAVE SUCCESS!")
            return Response(serializer.data)
        print("SERIALIZER ERRORS:", serializer.errors)
        return Response(serializer.errors, status=400)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Old password is incorrect.'}, status=400)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        AuditLog.objects.create(
            user=user, action='CHANGE_PASSWORD', module='AUTH',
            record_type='User', record_id=str(user.id),
            description=f"Password changed by {user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )
        return Response({'message': 'Password changed successfully.'})


# ── Admin: User Management ─────────────────────────────────────────

class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by('full_name')

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1', 't', 'y', 'yes'))
        return qs

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAnyStaff()]
        return [IsHR()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        from django.db.models import Q
        from hr_module.models import ExecutiveOfficer
        dob = self.request.data.get('date_of_birth') if hasattr(self.request, 'data') else None
        if not ExecutiveOfficer.objects.filter(
            Q(email__iexact=user.email) | Q(full_name__iexact=user.full_name)
        ).exists():
            ExecutiveOfficer.objects.create(
                full_name=user.full_name,
                email=user.email,
                phone=user.phone or '',
                designation=user.role.replace('_', ' ').title(),
                department='General',
                date_of_birth=dob if dob else None,
                status='ACTIVE' if user.is_active else 'INACTIVE',
                created_by=self.request.user if hasattr(self.request, 'user') and self.request.user.is_authenticated else None
            )
        AuditLog.objects.create(
            user=self.request.user if hasattr(self.request, 'user') and self.request.user.is_authenticated else None,
            action='CREATE_USER', module='ADMIN',
            record_type='User', record_id=str(user.id),
            description=f"User {user.username} ({user.role}) created",
            ip_address=getattr(self.request, 'audit_ip', None)
        )


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsHR]
    queryset = User.objects.all()

    def get_serializer_class(self):
        return UserSerializer

    def perform_update(self, serializer):
        user = serializer.save()
        if not user.is_active:
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"notify_{str(user.id)}",
                        {'type': 'force_logout', 'message': 'Account deactivated by HR'}
                    )
            except Exception as e:
                print("WebSocket force logout error:", e)

        from django.db.models import Q
        from hr_module.models import ExecutiveOfficer
        dob = self.request.data.get('date_of_birth') if hasattr(self.request, 'data') else None
        update_kwargs = {
            'full_name': user.full_name,
            'email': user.email,
            'phone': user.phone or '',
            'status': 'ACTIVE' if user.is_active else 'INACTIVE'
        }
        if dob:
            update_kwargs['date_of_birth'] = dob
        ExecutiveOfficer.objects.filter(
            Q(email__iexact=user.email) | Q(full_name__iexact=user.full_name)
        ).update(**update_kwargs)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.set_unusable_password()
        instance.save(update_fields=['is_active', 'password'])

        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"notify_{str(instance.id)}",
                    {'type': 'force_logout', 'message': 'Account deactivated by HR'}
                )
        except Exception as e:
            print("WebSocket force logout error:", e)

        from django.db.models import Q
        from hr_module.models import ExecutiveOfficer
        ExecutiveOfficer.objects.filter(
            Q(email__iexact=instance.email) | Q(full_name__iexact=instance.full_name)
        ).update(status='INACTIVE')
        AuditLog.objects.create(
            user=self.request.user if hasattr(self.request, 'user') and self.request.user.is_authenticated else None,
            action='DEACTIVATE_USER', module='ADMIN',
            record_type='User', record_id=str(instance.id),
            description=f"User {instance.username} deactivated",
            ip_address=getattr(self.request, 'audit_ip', None)
        )


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    queryset = AuditLog.objects.select_related('user').all()
    filterset_fields = ['module', 'action', 'record_type']
    search_fields = ['reference_number', 'record_id', 'description']
    ordering_fields = ['timestamp']


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SystemNotification.objects.filter(recipient=self.request.user)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = SystemNotification.objects.get(pk=pk, recipient=request.user)
            notif.mark_read()
            return Response({'message': 'Marked as read.'})
        except SystemNotification.DoesNotExist:
            return Response({'error': 'Not found.'}, status=404)

    def delete(self, request, pk):
        """Mark all as read."""
        SystemNotification.objects.filter(recipient=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({'message': 'All marked as read.'})

class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        count = SystemNotification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'count': count})


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response({'error': 'Query too short.'}, status=400)

        results = []

        # Search Assessment Requests
        from manager_module.models import AssessmentRequest
        for r in AssessmentRequest.objects.filter(request_number__icontains=q)[:5]:
            results.append({'type': 'Money Request', 'id': str(r.id),
                            'ref': r.request_number, 'label': r.purpose,
                            'status': r.status, 'url': f'/slt/mgr/requests/{r.id}'})

        # Search Members
        from hr_module.models import Member
        for m in Member.objects.filter(member_id__icontains=q)[:5]:
            results.append({'type': 'Member', 'id': str(m.id),
                            'ref': m.member_id, 'label': m.full_name,
                            'status': m.status, 'url': f'/slt/hr/members/{m.id}'})

        # Search Transactions
        from accounts_module.models import Transaction
        for t in Transaction.objects.filter(transaction_id__icontains=q)[:5]:
            results.append({'type': 'Transaction', 'id': str(t.id),
                            'ref': t.transaction_id, 'label': t.description,
                            'status': t.status, 'url': f'/slt/finance/transactions/{t.id}'})

        return Response({'results': results, 'query': q})

from rest_framework.viewsets import ModelViewSet
from core.models import Event
from rest_framework.parsers import MultiPartParser, FormParser

class EventViewSet(ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ['category']

class RoleFeaturePermissionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get enabled features for the current user's role (or all if admin requested all)."""
        if request.query_params.get('all') == 'true' and request.user.role == Role.ADMIN:
            # Return mapping { "feature_key": ["ROLE1", "ROLE2"] }
            mappings = {}
            for perm in RoleFeaturePermission.objects.all():
                if perm.feature_key not in mappings:
                    mappings[perm.feature_key] = []
                mappings[perm.feature_key].append(perm.role)
            return Response(mappings)
            
        perms = list(RoleFeaturePermission.objects.filter(role=request.user.role).values_list('feature_key', flat=True))
        if request.user.role == Role.MANAGER and 'hr_members' not in perms:
            perms.append('hr_members')
        if ('inward_entry' in perms or request.user.role in [Role.DATA_ENTRY, Role.MANAGER, Role.ADMIN]) and 'assets_in_stock' not in perms:
            perms.append('assets_in_stock')
        if request.user.role in [Role.DATA_ENTRY, Role.MANAGER, Role.ADMIN] and 'public_issues' not in perms:
            perms.append('public_issues')
        return Response(perms)

    def post(self, request):
        """Update feature permissions (Admin only)"""
        if request.user.role != Role.ADMIN:
            return Response({'error': 'Unauthorized'}, status=403)
            
        feature_key = request.data.get('feature_key')
        roles = request.data.get('roles', [])
        
        if not feature_key:
            return Response({'error': 'feature_key required'}, status=400)
            
        RoleFeaturePermission.objects.filter(feature_key=feature_key).delete()
        new_perms = [RoleFeaturePermission(role=r, feature_key=feature_key) for r in roles if r in dict(Role.choices)]
        RoleFeaturePermission.objects.bulk_create(new_perms)
        
        return Response({'message': 'Updated successfully'})


class ExpoPushTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from core.models import ExpoDevice
        token = request.data.get('push_token')
        if token:
            ExpoDevice.objects.update_or_create(
                push_token=token,
                defaults={'user': request.user}
            )
            return Response({'status': 'ok'})
        return Response({'error': 'Token required'}, status=400)


from rest_framework.decorators import action
from rest_framework.parsers import JSONParser
from core.models import MemberPost, MemberPostImage, MemberPostLike, MemberPostComment, MemberPostStatus
from core.serializers import MemberPostSerializer, MemberPostCommentSerializer

class MemberPostViewSet(ModelViewSet):
    queryset = MemberPost.objects.filter(is_active=True).select_related('author', 'assessment_request').prefetch_related('images', 'likes', 'comments')
    serializer_class = MemberPostSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = MemberPost.objects.filter(is_active=True).select_related('author', 'assessment_request').prefetch_related('images', 'likes', 'comments')
        my_posts = self.request.query_params.get('my_posts')
        if my_posts in ['true', '1', True]:
            qs = qs.filter(author=self.request.user)

        status_param = (self.request.query_params.get('status') or '').strip()
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                models.Q(description__icontains=search) |
                models.Q(contact_number__icontains=search) |
                models.Q(address__icontains=search) |
                models.Q(author__full_name__icontains=search) |
                models.Q(author__username__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user, is_active=True)
        images = self.request.FILES.getlist('images') or self.request.FILES.getlist('photos')
        for idx, img in enumerate(images[:10]):
            MemberPostImage.objects.create(post=post, image=img, order=idx)

    def perform_update(self, serializer):
        post = serializer.save()
        images = self.request.FILES.getlist('images') or self.request.FILES.getlist('photos')
        if images:
            start_order = post.images.count()
            for idx, img in enumerate(images[:10]):
                MemberPostImage.objects.create(post=post, image=img, order=start_order + idx)

    def perform_destroy(self, instance):
        # Soft delete post so historical relationships remain safe
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if self.action in ['update', 'partial_update', 'destroy']:
            user_role = getattr(request.user, 'role', '')
            is_staff_user = getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)
            if obj.author != request.user and user_role not in ['ADMIN', 'MANAGER', 'DATA_ENTRY', 'HR'] and not is_staff_user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only edit or delete your own posts.")

    @action(detail=True, methods=['post'], url_path='toggle-like')
    def toggle_like(self, request, pk=None):
        post = self.get_object()
        like = MemberPostLike.objects.filter(post=post, user=request.user).first()
        if like:
            like.delete()
            is_liked = False
        else:
            MemberPostLike.objects.get_or_create(post=post, user=request.user)
            is_liked = True
        
        # Always query the database directly for accurate likes count
        current_count = MemberPostLike.objects.filter(post=post).count()
        return Response({
            'is_liked': is_liked,
            'likes_count': current_count,
            'post_id': str(post.id),
        })

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            comments = post.comments.select_related('user').order_by('created_at')
            serializer = MemberPostCommentSerializer(comments, many=True, context={'request': request})
            return Response(serializer.data)
        elif request.method == 'POST':
            text = (request.data.get('text') or '').strip()
            if not text:
                return Response({'error': 'Comment text cannot be empty'}, status=400)
            comment = MemberPostComment.objects.create(post=post, user=request.user, text=text)
            serializer = MemberPostCommentSerializer(comment, context={'request': request})
            return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], url_path='forward-to-fao')
    def forward_to_fao(self, request, pk=None):
        post = self.get_object()
        if post.status == MemberPostStatus.FORWARDED_TO_FAO and post.assessment_request:
            return Response({
                'error': f'Already forwarded to FAO as {post.assessment_request.request_number}',
                'assessment_request_id': str(post.assessment_request.id),
                'request_number': post.assessment_request.request_number
            }, status=400)

        from manager_module.models import AssessmentRequest, AssessmentPhoto, RequestStatus, RequestStatusHistory
        category = request.data.get('category') or 'OTHER'
        priority = request.data.get('priority') or 'NORMAL'

        # Create AssessmentRequest with status WITH_FAO
        req = AssessmentRequest.objects.create(
            source='MEMBER',
            requested_by=post.author,
            beneficiary_name=post.author.full_name or post.author.username,
            beneficiary_phone=post.contact_number or getattr(post.author, 'phone', ''),
            beneficiary_address=post.address or '',
            purpose=post.description[:250] if post.description else 'Public Issue Report',
            description=post.description,
            category=category,
            priority=priority,
            status=RequestStatus.WITH_FAO,
            submitted_at=timezone.now(),
        )

        # Copy all post images to AssessmentPhoto
        for post_img in post.images.all():
            if post_img.image:
                AssessmentPhoto.objects.create(
                    assessment=req,
                    image=post_img.image,
                    caption='Uploaded by member'
                )

        # Record Status History
        RequestStatusHistory.objects.create(
            request=req,
            from_status=RequestStatus.SUBMITTED,
            to_status=RequestStatus.WITH_FAO,
            changed_by=request.user,
            remarks=f"Forwarded from Public Issue (Post ID: {post.id})"
        )

        # Update Post
        post.status = MemberPostStatus.FORWARDED_TO_FAO
        post.assessment_request = req
        post.save(update_fields=['status', 'assessment_request', 'updated_at'])

        # Audit Log
        AuditLog.objects.create(
            user=request.user,
            action='FORWARD_TO_FAO',
            module='DATA_ENTRY',
            record_type='MemberPost',
            record_id=str(post.id),
            reference_number=req.request_number,
            new_status=post.status,
            description=f"Public Issue {post.id} forwarded to FAO by {request.user.full_name} -> {req.request_number}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({
            'message': f'Successfully forwarded to FAO as {req.request_number}',
            'assessment_request_id': str(req.id),
            'request_number': req.request_number,
            'status': post.status
        })

