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

        # Flexible user lookup by case-insensitive username, email, or encrypted phone number
        clean_username = username.strip()
        user_obj = User.objects.filter(Q(username__iexact=clean_username) | Q(email__iexact=clean_username)).first()
        if not user_obj:
            for u in User.objects.exclude(phone='').iterator():
                if u.phone and u.phone.strip() == clean_username:
                    user_obj = u
                    break

        if user_obj and user_obj.is_account_locked():
            return Response({'error': 'Account is temporarily locked. Try again later.'}, status=403)

        target_username = user_obj.username if user_obj else clean_username
        user = authenticate(request, username=target_username, password=password)
        if not user:
            if user_obj:
                user_obj.failed_login_attempts += 1
                if user_obj.failed_login_attempts >= 5:
                    user_obj.locked_until = timezone.now() + timedelta(minutes=15)
                user_obj.save(update_fields=['failed_login_attempts', 'locked_until'])
                # Log failed attempt
                AuditLog.objects.create(
                    user=None, action='LOGIN_FAILED', module='AUTH',
                    record_type='User', record_id=str(user_obj.id),
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
    filterset_fields = ['role', 'is_active']

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
            
        perms = RoleFeaturePermission.objects.filter(role=request.user.role).values_list('feature_key', flat=True)
        return Response(list(perms))

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
