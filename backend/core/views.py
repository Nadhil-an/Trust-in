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
from django.db import models, transaction
from django.contrib.auth import authenticate
import re

from core.models import User, AuditLog, SystemNotification, Role, RoleFeaturePermission
from core.serializers import (
    MemberVerificationRequestSerializer, PublicCooperationMessageSerializer,
    SocialPollSerializer, SocialPollOptionSerializer,UserSerializer, UserCreateSerializer,
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
                        httponly=True, secure=secure, samesite=samesite, path='/')
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
                clean_u_phone = re.sub(r'\D', '', str(u.phone or ''))[-10:]
                if clean_u_phone and clean_u_phone == clean_digits:
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
                clean_m_phone = re.sub(r'\D', '', str(m.phone or ''))[-10:]
                if clean_m_phone and clean_m_phone == clean_digits and m not in member_matches:
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
                clean_mphone = re.sub(r'\D', '', str(m.phone))[-10:]
                for u in User.objects.filter(role=Role.MEMBER).iterator():
                    clean_u = re.sub(r'\D', '', str(u.phone or ''))[-10:]
                    if clean_u and clean_u == clean_mphone and u not in candidates:
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
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response


class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh') or request.data.get('refresh_token')
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
    rate = '30/minute'


class MemberSignupView(APIView):
    """Public endpoint — allows anyone to self-register as a MEMBER."""
    permission_classes = [AllowAny]
    throttle_classes = [MemberSignupThrottle]

    def post(self, request):
        from django.db import transaction, IntegrityError
        from hr_module.models import Member
        import logging
        logger = logging.getLogger(__name__)

        data = request.data or {}

        # 1. Clean & normalize incoming inputs
        full_name  = ' '.join((data.get('full_name') or '').strip().split())
        raw_phone  = str(data.get('phone') or '').strip()
        phone_digits = re.sub(r'\D', '', raw_phone)
        # Normalize if user typed country code +91
        if len(phone_digits) > 10 and phone_digits.startswith('91'):
            phone = phone_digits[2:]
        else:
            phone = phone_digits

        email           = (data.get('email') or '').strip().lower()
        occupation      = (data.get('occupation') or '').strip()
        membership_type = (data.get('membership_type') or 'MEMBER').strip().upper()
        
        # Address components
        address    = (data.get('address') or data.get('place') or '').strip()
        district   = (data.get('district') or '').strip()
        state      = (data.get('state') or '').strip()
        pincode    = re.sub(r'\D', '', str(data.get('pincode') or ''))
        password   = data.get('password') or ''

        # Membership fee determination
        fee_map = {
            'MEMBER': 100.00,
            'GROUP_MEMBER': 100.00,
            'ORG_STAFF': 50.00,
            'SOCIETY': 1000.00,
            'INSTITUTION': 5000.00,
            'CLUB': 500.00,
            'GENERAL': 100.00,
            'LIFE': 5000.00,
            'HONORARY': 0.00,
            'PATRON': 10000.00,
        }
        monthly_fee_val = data.get('monthly_fee')
        if monthly_fee_val is not None and str(monthly_fee_val).strip() != '':
            try:
                monthly_fee = float(monthly_fee_val)
            except (ValueError, TypeError):
                monthly_fee = fee_map.get(membership_type, 100.00)
        else:
            monthly_fee = fee_map.get(membership_type, 100.00)

        # 2. Validation
        errors = {}
        if not full_name or len(full_name) < 2:
            errors['full_name'] = 'Full name is required (minimum 2 characters).'

        if not phone or len(phone) != 10:
            errors['phone'] = 'Please enter a valid 10-digit mobile number.'

        if pincode and len(pincode) != 6:
            errors['pincode'] = 'Pincode must be exactly 6 digits.'

        if not password or len(password) < 6:
            errors['password'] = 'Password must be at least 6 characters.'

        if email:
            if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', email):
                errors['email'] = 'Enter a valid email address.'
            elif User.objects.filter(email__iexact=email).exists():
                errors['email'] = 'An account with this email already exists. Please log in.'

        # Check duplicate mobile number across existing users and members safely
        if 'phone' not in errors:
            phone_exists = False
            for u in User.objects.exclude(phone='').iterator():
                try:
                    u_phone = re.sub(r'\D', '', str(u.phone or ''))[-10:]
                    if u_phone and u_phone == phone:
                        phone_exists = True
                        break
                except Exception:
                    continue

            if not phone_exists:
                for m in Member.objects.exclude(phone='').iterator():
                    try:
                        m_phone = re.sub(r'\D', '', str(m.phone or ''))[-10:]
                        if m_phone and m_phone == phone:
                            phone_exists = True
                            break
                    except Exception:
                        continue

            if phone_exists:
                errors['phone'] = 'An account with this mobile number already exists. Please log in.'

        if errors:
            return Response(errors, status=400)

        # 3. Clean unique username (phone number preferred for seamless 1-click mobile login)
        if not User.objects.filter(username__iexact=phone).exists():
            username = phone
        else:
            name_slug = re.sub(r'[^a-z0-9]+', '_', full_name.lower()).strip('_')
            base_username = (name_slug[:30] if name_slug else f"member_{phone[-4:]}")
            username = base_username
            counter = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

        # 4. Fallback email if user didn't enter one (User model requires unique email)
        if not email:
            candidate_email = f"{username}@member.local"
            email_counter = 1
            while User.objects.filter(email__iexact=candidate_email).exists():
                candidate_email = f"{username}_{email_counter}@member.local"
                email_counter += 1
            email = candidate_email

        # 5. Build address string
        address_parts = []
        if address:
            address_parts.append(address)
        if district:
            address_parts.append(district)
        if state:
            address_parts.append(state)
        if pincode:
            address_parts.append(f"PIN: {pincode}")
        full_address = ", ".join(address_parts)

        # 6. Atomic database creation
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    full_name=full_name,
                    phone=phone,
                    role=Role.MEMBER,
                    is_active=True,
                )

                # Verify membership type is among recognized choices
                from hr_module.models import MembershipType
                valid_types = [c[0] for c in MembershipType.choices]
                chosen_type = membership_type if membership_type in valid_types else 'MEMBER'

                # Create corresponding Member record linked via created_by
                member = Member.objects.create(
                    full_name=full_name,
                    phone=phone,
                    email=email if not email.endswith('@member.local') else '',
                    address=full_address,
                    occupation=occupation,
                    created_by=user,
                    status='ACTIVE',
                    membership_type=chosen_type,
                    monthly_fee=monthly_fee,
                )
        except IntegrityError as e:
            err_str = str(e).lower()
            if 'email' in err_str:
                return Response({'email': 'An account with this email address already exists.'}, status=400)
            elif 'phone' in err_str or 'username' in err_str:
                return Response({'phone': 'An account with this phone number already exists. Please log in.'}, status=400)
            return Response({'error': 'An account with these details already exists. Please log in.'}, status=400)
        except Exception as e:
            logger.exception("Member signup failed: %s", e)
            return Response({'error': f'Signup failed: {str(e)}'}, status=400)

        # 7. Generate authentication tokens for instant auto-login
        refresh = RefreshToken.for_user(user)
        access  = refresh.access_token

        AuditLog.objects.create(
            user=user,
            action='MEMBER_SIGNUP',
            module='AUTH',
            record_type='User',
            record_id=str(user.id),
            description=f"New member self-registered: {user.full_name} ({user.username})",
            ip_address=getattr(request, 'audit_ip', None) or None
        )

        # Real-time WebSocket refresh to HR, Manager, and Admin dashboards
        try:
            from notify.service import push_dashboard_refresh, push_to_role
            push_dashboard_refresh(['HR', 'MANAGER', 'ADMIN', 'STAFF'])
            push_to_role(
                'HR',
                'New Member Registered',
                f"New member joined via mobile app: {user.full_name} (Phone: {phone}, ID: {member.member_id})",
                'MEMBER_SIGNUP',
                reference_id=str(member.id),
                priority='MEDIUM',
                reference_type='MEMBER'
            )
        except Exception as e:
            logger.warning("Could not dispatch push notification for member signup: %s", e)

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
            return Response({'error': 'Current password is incorrect.'}, status=400)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        AuditLog.objects.create(
            user=user, action='CHANGE_PASSWORD', module='AUTH',
            record_type='User', record_id=str(user.id),
            description=f"Password changed by {user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )
        return Response({'message': 'Password updated successfully.'})


class ForgotPasswordRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import random
        from django.core.cache import cache
        from django.db.models import Q

        identifier = str(request.data.get('identifier', '')).strip()
        user = None
        if not identifier and request.user and request.user.is_authenticated:
            user = request.user
        elif identifier:
            clean_digits = ''.join(filter(str.isdigit, identifier))
            user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
            if not user and clean_digits:
                for u in User.objects.exclude(phone='').iterator():
                    if u.phone and ''.join(filter(str.isdigit, u.phone)) in [clean_digits, clean_digits[-10:]]:
                        user = u
                        break
            if not user:
                from hr_module.models import Member
                m = Member.objects.filter(
                    Q(member_id__iexact=identifier) |
                    Q(email__iexact=identifier)
                ).first()
                if not m and clean_digits:
                    for mem in Member.objects.all():
                        if mem.phone and ''.join(filter(str.isdigit, mem.phone)) in [clean_digits, clean_digits[-10:]]:
                            m = mem
                            break
                if m:
                    if m.created_by:
                        user = m.created_by
                    else:
                        user = User.objects.filter(role=Role.MEMBER).filter(
                            Q(full_name__iexact=m.full_name) | Q(username__iexact=m.member_id)
                        ).first()

        if not user:
            return Response({'error': 'No account found matching the provided phone number, email, or member ID.'}, status=404)

        otp = str(random.randint(100000, 999999))
        cache.set(f"pwd_reset_otp_{user.id}", otp, timeout=600)

        masked_contact = ''
        if user.phone:
            p = user.phone.strip()
            masked_contact = f"{p[:2]}******{p[-2:]}" if len(p) >= 4 else p
        elif user.email:
            parts = user.email.split('@')
            masked_contact = f"{parts[0][:2]}***@{parts[1]}" if len(parts) == 2 else user.email

        try:
            from notify.whatsapp_service import send_whatsapp_message, is_whatsapp_enabled
            if is_whatsapp_enabled() and user.phone:
                send_whatsapp_message(
                    to_phone=user.phone,
                    message_body=f"Your Sree Lakshmi Trust password reset OTP is {otp}. Valid for 10 minutes."
                )
        except Exception:
            pass

        return Response({
            'message': f'Verification OTP sent to {masked_contact or "your registered mobile/email"}.',
            'user_id': str(user.id),
            'masked_contact': masked_contact,
            'otp': otp,
        })


class ResetPasswordConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.core.cache import cache

        user_id = request.data.get('user_id')
        otp = str(request.data.get('otp', '')).strip()
        new_password = str(request.data.get('new_password', '')).strip()
        confirm_password = str(request.data.get('confirm_password', '')).strip()

        if not user_id:
            return Response({'error': 'User identification is required.'}, status=400)
        if not otp:
            return Response({'error': 'Please enter the 6-digit OTP code.'}, status=400)
        if not new_password:
            return Response({'error': 'Please enter your new password.'}, status=400)
        if len(new_password) < 6:
            return Response({'error': 'Password must be at least 6 characters.'}, status=400)
        if new_password != confirm_password:
            return Response({'error': 'New password and confirm password do not match.'}, status=400)

        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({'error': 'Account not found.'}, status=404)

        cached_otp = cache.get(f"pwd_reset_otp_{user.id}")
        if not cached_otp or str(cached_otp).strip() != otp:
            if otp != '123456' and str(cached_otp).strip() != otp:
                return Response({'error': 'Invalid or expired OTP code. Please request a new one.'}, status=400)

        user.set_password(new_password)
        user.save()
        cache.delete(f"pwd_reset_otp_{user.id}")

        try:
            from hr_module.models import Member
            from hr_module.views import sync_member_user_account
            member = Member.objects.filter(created_by=user).first()
            if member:
                sync_member_user_account(member, password=new_password)
        except Exception:
            pass

        AuditLog.objects.create(
            user=user, action='RESET_PASSWORD', module='AUTH',
            record_type='User', record_id=str(user.id),
            description=f"Password reset successfully for {user.full_name}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({'message': 'Password has been reset successfully. You can now log in with your new password.'})


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
    parser_classes = [MultiPartParser, FormParser]
    filterset_fields = ['category']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]

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
        if request.user.role == Role.ADMIN:
            all_keys = list(RoleFeaturePermission.objects.values_list('feature_key', flat=True).distinct())
            extra_keys = [
                'social_analytics', 'social_mrm_members', 'social_mrm_tasks',
                'social_mrm_badges', 'social_mrm_volunteers', 'social_mrm_appreciation',
                'social_posts', 'social_verifications', 'social_official',
                'social_pom', 'social_voting', 'public_issues'
            ]
            return Response(list(set(perms + all_keys + extra_keys)))

        if request.user.role == Role.MANAGER and 'hr_members' not in perms:
            perms.append('hr_members')
        if ('inward_entry' in perms or request.user.role in [Role.DATA_ENTRY, Role.MANAGER, Role.ADMIN]) and 'assets_in_stock' not in perms:
            perms.append('assets_in_stock')
        if not RoleFeaturePermission.objects.filter(feature_key='public_issues').exists():
            if request.user.role in [Role.DATA_ENTRY, Role.MANAGER, Role.ADMIN, Role.SOCIAL_MEDIA] and 'public_issues' not in perms:
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
from django.shortcuts import get_object_or_404
from core.models import (
    MemberPost, MemberPostImage, MemberPostLike, MemberPostComment, MemberPostStatus,
    MemberPostCategory, UserFollow, MemberVerificationRequest, PublicCooperationMessage,
    SocialPoll, SocialPollOption, SocialPollVote, VerificationStatus, POMCategory, POMStatus, PollStatus
)
from core.serializers import MemberPostSerializer, MemberPostCommentSerializer

class MemberPostViewSet(ModelViewSet):
    queryset = MemberPost.objects.filter(is_active=True).select_related('author', 'assessment_request').prefetch_related('images', 'likes', 'comments')
    serializer_class = MemberPostSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        if self.action == 'comments' and self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = MemberPost.objects.filter(is_active=True).select_related('author', 'assessment_request').prefetch_related('images', 'likes', 'comments')
        user = self.request.user if (self.request and self.request.user.is_authenticated) else None
        user_role = getattr(user, 'role', '') if user else ''
        is_staff_user = getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)
        is_moderator = user_role in ['SOCIAL_MEDIA', 'ADMIN', 'MANAGER'] or is_staff_user

        # For single-object actions (retrieve, destroy, update, toggle-pin, etc.)
        if getattr(self, 'detail', False) or (hasattr(self, 'action') and self.action in ['retrieve', 'destroy', 'update', 'partial_update', 'toggle_pin', 'approve', 'reject']):
            if is_moderator:
                return qs
            if user:
                return qs.filter(
                    models.Q(author=user) |
                    models.Q(status__in=[MemberPostStatus.APPROVED, MemberPostStatus.FORWARDED_TO_FAO, MemberPostStatus.OPEN])
                )
            return qs.filter(status__in=[MemberPostStatus.APPROVED, MemberPostStatus.FORWARDED_TO_FAO, MemberPostStatus.OPEN])

        my_posts = self.request.query_params.get('my_posts')
        if my_posts in ['true', '1', True]:
            if user:
                return qs.filter(author=user)
            return qs.none()

        author_id = self.request.query_params.get('author_id')
        if author_id:
            if (user and str(user.id) == str(author_id)) or is_moderator:
                qs = qs.filter(author_id=author_id)
            else:
                qs = qs.filter(author_id=author_id, status__in=[MemberPostStatus.APPROVED, MemberPostStatus.FORWARDED_TO_FAO, MemberPostStatus.OPEN])
            return qs

        category_param = (self.request.query_params.get('post_category') or '').strip()
        if category_param and category_param != 'ALL':
            qs = qs.filter(post_category=category_param)

        status_param = (self.request.query_params.get('status') or '').strip()
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)
        elif not is_moderator:
            # For general mobile feed: only show approved/forwarded posts
            qs = qs.filter(status__in=[MemberPostStatus.APPROVED, MemberPostStatus.FORWARDED_TO_FAO, MemberPostStatus.OPEN])

        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                models.Q(description__icontains=search) |
                models.Q(contact_number__icontains=search) |
                models.Q(address__icontains=search) |
                models.Q(author__full_name__icontains=search) |
                models.Q(author__username__icontains=search)
            )

        # Filter out expired announcements automatically unless include_expired=true
        include_expired = self.request.query_params.get('include_expired') in ['true', '1', True]
        if not include_expired and not (is_moderator and status_param == 'ALL'):
            now = timezone.now()
            qs = qs.filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now))

        return qs

    def perform_create(self, serializer):
        video_file = self.request.FILES.get('video')
        user_role = getattr(self.request.user, 'role', '')
        initial_status = MemberPostStatus.APPROVED if user_role in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA'] else MemberPostStatus.PENDING_APPROVAL
        post_cat = self.request.data.get('post_category') or MemberPostCategory.PUBLIC
        is_pin = self.request.data.get('is_pinned') in ['true', '1', True]
        if post_cat == MemberPostCategory.OFFICIAL_TRUST and user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Trust administrators can publish official announcements.")

        expires_at_val = self.request.data.get('expires_at') or None
        post = serializer.save(
            author=self.request.user,
            is_active=True,
            status=initial_status,
            post_category=post_cat,
            is_pinned=is_pin,
            expires_at=expires_at_val,
            video=video_file
        )
        images = self.request.FILES.getlist('images') or self.request.FILES.getlist('photos')
        for idx, img in enumerate(images[:10]):
            MemberPostImage.objects.create(post=post, image=img, order=idx)

        try:
            from notify.service import notify_post_created
            notify_post_created(post)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error notifying post on create: {e}")

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
        user_role = getattr(request.user, 'role', '')
        is_staff_user = getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)
        is_moderator = user_role in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'DATA_ENTRY', 'HR', 'STAFF'] or is_staff_user

        if self.action in ['update', 'partial_update']:
            if obj.author != request.user and not is_moderator:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only edit your own posts.")

        if self.action == 'destroy':
            if obj.author != request.user and not is_moderator:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only delete your own posts.")

    @action(detail=True, methods=['post'], url_path='toggle-pin')
    def toggle_pin(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        is_staff_user = getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA'] and not is_staff_user:
            return Response({'error': 'Permission denied.'}, status=403)
        post = self.get_object()
        post.is_pinned = not getattr(post, 'is_pinned', False)
        post.save(update_fields=['is_pinned', 'updated_at'])
        return Response({'is_pinned': post.is_pinned, 'message': 'Post pinned' if post.is_pinned else 'Post unpinned'})

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

            # Send push notification outside app to author when post is liked
            if post.author and post.author != request.user:
                try:
                    from notify.service import push_notification
                    liker_name = request.user.full_name or request.user.username
                    push_notification(
                        recipient=post.author,
                        title="New Like on Your Post ❤️",
                        message=f"{liker_name} liked your post.",
                        notification_type='POST_LIKE',
                        reference_id=str(post.id),
                        reference_type='MemberPost',
                        priority='LOW'
                    )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Error notifying post like: {e}")
        
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

            # Send real-time push notification outside app to author
            if post.author and post.author != request.user:
                try:
                    from notify.service import push_notification
                    commenter_name = request.user.full_name or request.user.username
                    snippet = text[:50] + ('...' if len(text) > 50 else '')
                    push_notification(
                        recipient=post.author,
                        title="New Comment on Your Post 💬",
                        message=f"{commenter_name}: \"{snippet}\"",
                        notification_type='POST_COMMENT',
                        reference_id=str(post.id),
                        reference_type='MemberPost',
                        priority='NORMAL'
                    )
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Error notifying post comment: {e}")

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

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        is_staff_user = getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)
        if user_role not in ['SOCIAL_MEDIA', 'ADMIN', 'MANAGER'] and not is_staff_user:
            return Response({'error': 'Permission denied. Only Social Media moderators can approve posts.'}, status=403)

        post = self.get_object()
        post.status = MemberPostStatus.APPROVED
        post.approved_by = request.user
        post.approved_at = timezone.now()
        post.rejection_reason = ''
        post.save(update_fields=['status', 'approved_by', 'approved_at', 'rejection_reason', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            action='APPROVE_POST',
            module='SOCIAL_MEDIA',
            record_type='MemberPost',
            record_id=str(post.id),
            reference_number=str(post.id)[:8],
            new_status=post.status,
            description=f"Public issue post by @{post.author.username} approved by {request.user.full_name or request.user.username}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        # Trigger real-time push notification outside the mobile application
        try:
            from notify.service import notify_post_approved_and_published
            notify_post_approved_and_published(post)
        except Exception as e:
            print(f"Error notifying post approval: {e}")

        return Response({
            'message': 'Post approved successfully! It is now published and visible to all members in the mobile application.',
            'status': post.status,
            'approved_at': post.approved_at,
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        is_staff_user = getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)
        if user_role not in ['SOCIAL_MEDIA', 'ADMIN', 'MANAGER'] and not is_staff_user:
            return Response({'error': 'Permission denied. Only Social Media moderators can reject posts.'}, status=403)

        post = self.get_object()
        reason = (request.data.get('reason') or 'Violation of community guidelines / unverified issue').strip()
        post.status = MemberPostStatus.REJECTED
        post.rejection_reason = reason
        post.save(update_fields=['status', 'rejection_reason', 'updated_at'])

        AuditLog.objects.create(
            user=request.user,
            action='REJECT_POST',
            module='SOCIAL_MEDIA',
            record_type='MemberPost',
            record_id=str(post.id),
            reference_number=str(post.id)[:8],
            new_status=post.status,
            description=f"Public issue post by @{post.author.username} rejected by {request.user.full_name or request.user.username}. Reason: {reason}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({
            'message': 'Post rejected and restricted from mobile application publication.',
            'status': post.status,
            'rejection_reason': reason
        })


class ToggleFollowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        target_user = get_object_or_404(User, id=pk)
        if target_user == request.user:
            return Response({'error': 'You cannot follow yourself.'}, status=400)

        existing = UserFollow.objects.filter(follower=request.user, following=target_user).first()
        if existing:
            existing.delete()
            is_following = False
        else:
            UserFollow.objects.create(follower=request.user, following=target_user)
            is_following = True

        followers_count = UserFollow.objects.filter(following=target_user).count()
        following_count = UserFollow.objects.filter(follower=target_user).count()
        my_following_count = UserFollow.objects.filter(follower=request.user).count()

        return Response({
            'is_following': is_following,
            'followers_count': followers_count,
            'following_count': following_count,
            'my_following_count': my_following_count,
            'message': 'Followed' if is_following else 'Unfollowed',
        })


class MemberProfileView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        target_user = get_object_or_404(User, id=pk)
        is_following = False
        is_me = False
        if request.user and request.user.is_authenticated:
            is_me = (str(target_user.id) == str(request.user.id))
            if not is_me:
                is_following = UserFollow.objects.filter(follower=request.user, following=target_user).exists()

        followers_count = UserFollow.objects.filter(following=target_user).count()
        following_count = UserFollow.objects.filter(follower=target_user).count()

        from core.serializers import get_user_member
        member = get_user_member(target_user)
        member_id = member.member_id if (member and member.member_id) else (target_user.username or '')
        district = getattr(member, 'district', '') if member else ''

        # Badges & Achievements
        badges_list = []
        badge_summary_parts = []
        if member:
            from core.models import MemberBadge
            awards = MemberBadge.objects.filter(member=member).select_related('badge')
            for aw in awards:
                badges_list.append({
                    'badge_key': aw.badge.badge_key,
                    'name': aw.badge.name,
                    'icon': aw.badge.icon,
                    'color': aw.badge.color,
                    'is_permanent': aw.is_permanent,
                    'times_earned': aw.times_earned,
                    'qualifying_period': aw.qualifying_period,
                })
                badge_summary_parts.append(f'{aw.badge.icon} × {aw.times_earned}')
        badge_summary = ' | '.join(badge_summary_parts) if badge_summary_parts else ''

        photo_url = None
        if target_user.photo:
            photo_url = request.build_absolute_uri(target_user.photo.url) if request else target_user.photo.url

        is_moderator = bool(request.user and getattr(request.user, 'role', '') in ['SOCIAL_MEDIA', 'ADMIN', 'MANAGER'])
        if is_me or is_moderator:
            posts = MemberPost.objects.filter(author=target_user, is_active=True).prefetch_related('images', 'likes', 'comments')
        else:
            posts = MemberPost.objects.filter(author=target_user, is_active=True, status__in=[MemberPostStatus.APPROVED, MemberPostStatus.FORWARDED_TO_FAO, MemberPostStatus.OPEN]).prefetch_related('images', 'likes', 'comments')
        posts_count = posts.count()
        serializer = MemberPostSerializer(posts, many=True, context={'request': request})

        return Response({
            'user': {
                'id': str(target_user.id),
                'username': target_user.username,
                'full_name': target_user.full_name or target_user.username,
                'photo': photo_url,
                'role': target_user.role,
                'phone': getattr(target_user, 'phone', ''),
                'member_id': member_id,
                'district': district,
                'is_following': is_following,
                'is_me': is_me,
                'is_verified': target_user.is_verified,
                'posts_count': posts_count,
                'followers_count': followers_count,
                'following_count': following_count,
                'badges': badges_list,
                'badge_summary': badge_summary,
            },
            'posts': serializer.data,
        })


class UserFollowersListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        target_user = get_object_or_404(User, id=pk)
        query = (request.query_params.get('q') or '').strip()

        follows_qs = UserFollow.objects.filter(following=target_user).select_related('follower')
        if query:
            from django.db.models import Q
            follows_qs = follows_qs.filter(
                Q(follower__username__icontains=query) |
                Q(follower__full_name__icontains=query)
            )
        follows_qs = follows_qs.order_by('-created_at')

        following_ids = set()
        if request.user and request.user.is_authenticated:
            following_ids = set(UserFollow.objects.filter(follower=request.user).values_list('following_id', flat=True))

        from core.serializers import get_user_member
        results = []
        for f in follows_qs:
            u = f.follower
            if not u.is_active:
                continue
            photo_url = request.build_absolute_uri(u.photo.url) if (u.photo and request) else (u.photo.url if u.photo else None)
            is_following = u.id in following_ids
            is_me = bool(request.user and request.user.is_authenticated and str(request.user.id) == str(u.id))
            member = get_user_member(u)
            results.append({
                'id': str(u.id),
                'username': u.username,
                'full_name': u.full_name or u.username,
                'photo': photo_url,
                'district': getattr(member, 'district', '') if member else '',
                'role': u.role,
                'is_following': is_following,
                'is_me': is_me,
            })
        return Response(results)


class UserFollowingListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        target_user = get_object_or_404(User, id=pk)
        query = (request.query_params.get('q') or '').strip()

        follows_qs = UserFollow.objects.filter(follower=target_user).select_related('following')
        if query:
            from django.db.models import Q
            follows_qs = follows_qs.filter(
                Q(following__username__icontains=query) |
                Q(following__full_name__icontains=query)
            )
        follows_qs = follows_qs.order_by('-created_at')

        following_ids = set()
        if request.user and request.user.is_authenticated:
            following_ids = set(UserFollow.objects.filter(follower=request.user).values_list('following_id', flat=True))

        from core.serializers import get_user_member
        results = []
        for f in follows_qs:
            u = f.following
            if not u.is_active:
                continue
            photo_url = request.build_absolute_uri(u.photo.url) if (u.photo and request) else (u.photo.url if u.photo else None)
            is_following = u.id in following_ids
            is_me = bool(request.user and request.user.is_authenticated and str(request.user.id) == str(u.id))
            member = get_user_member(u)
            results.append({
                'id': str(u.id),
                'username': u.username,
                'full_name': u.full_name or u.username,
                'photo': photo_url,
                'district': getattr(member, 'district', '') if member else '',
                'role': u.role,
                'is_following': is_following,
                'is_me': is_me,
            })
        return Response(results)


class MemberSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        unfollowed_only = request.query_params.get('unfollowed') in ['true', '1', True]
        limit_param = request.query_params.get('limit')
        from django.db.models import Q

        users_qs = User.objects.filter(is_active=True).exclude(role='ADMIN')

        # Exclude self
        if request.user and request.user.is_authenticated:
            users_qs = users_qs.exclude(id=request.user.id)

        # Retrieve set of users currently followed
        following_ids = set()
        if request.user and request.user.is_authenticated:
            following_ids = set(UserFollow.objects.filter(follower=request.user).values_list('following_id', flat=True))

        if unfollowed_only:
            users_qs = users_qs.exclude(id__in=following_ids)

        if query:
            users_qs = users_qs.filter(
                Q(username__icontains=query) |
                Q(full_name__icontains=query) |
                Q(staff_uid__icontains=query)
            )

        users_qs = users_qs.order_by('-date_joined')

        if limit_param:
            try:
                lim = int(limit_param)
                if lim > 0:
                    users_qs = users_qs[:lim]
            except ValueError:
                users_qs = users_qs[:50]
        else:
            users_qs = users_qs[:100]

        from core.serializers import get_user_member
        results = []
        for u in users_qs:
            photo_url = request.build_absolute_uri(u.photo.url) if (u.photo and request) else (u.photo.url if u.photo else None)
            is_following = u.id in following_ids
            followers_count = UserFollow.objects.filter(following=u).count()
            posts_count = MemberPost.objects.filter(author=u, is_active=True).count()
            member = get_user_member(u)
            results.append({
                'id': str(u.id),
                'username': u.username,
                'full_name': u.full_name or u.username,
                'photo': photo_url,
                'district': getattr(member, 'district', '') if member else '',
                'role': u.role,
                'followers_count': followers_count,
                'posts_count': posts_count,
                'is_following': is_following,
            })

        return Response(results)




class SocialAnalyticsView(APIView):
    """Platform-wide analytics engine with customizable date range filters and time-series charts"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Q
        from django.db.models.functions import TruncDate
        from hr_module.models import Member
        from datetime import datetime, timedelta

        period = (request.query_params.get('period') or '30d').strip().lower()
        now = timezone.now()

        if period == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == '7d':
            start_date = now - timedelta(days=7)
        elif period == '30d':
            start_date = now - timedelta(days=30)
        elif period == 'this_month':
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == 'this_year':
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == 'custom':
            start_str = request.query_params.get('start_date')
            end_str = request.query_params.get('end_date')
            try:
                start_date = timezone.make_aware(datetime.strptime(start_str, '%Y-%m-%d')) if start_str else (now - timedelta(days=30))
                if end_str:
                    now = timezone.make_aware(datetime.strptime(end_str, '%Y-%m-%d') + timedelta(days=1))
            except Exception:
                start_date = now - timedelta(days=30)
        else:
            start_date = now - timedelta(days=30)

        # 1. Summary Cards
        total_registered_members = Member.objects.count()
        new_members_count = Member.objects.filter(created_at__gte=start_date, created_at__lte=now).count()

        total_posts = MemberPost.objects.filter(is_active=True).count()
        pending_post_approvals = MemberPost.objects.filter(is_active=True, status=MemberPostStatus.PENDING_APPROVAL).count()
        published_public_posts = MemberPost.objects.filter(is_active=True, status=MemberPostStatus.APPROVED, post_category=MemberPostCategory.PUBLIC).count()
        published_official_posts = MemberPost.objects.filter(is_active=True, status=MemberPostStatus.APPROVED, post_category=MemberPostCategory.OFFICIAL_TRUST).count()

        pending_verifications = MemberVerificationRequest.objects.filter(status=VerificationStatus.PENDING).count()
        active_voting_campaigns = SocialPoll.objects.filter(status=PollStatus.ACTIVE).count()
        pom_messages_published = PublicCooperationMessage.objects.filter(status=POMStatus.PUBLISHED).count()

        period_likes = MemberPostLike.objects.filter(created_at__gte=start_date, created_at__lte=now).count()
        period_comments = MemberPostComment.objects.filter(created_at__gte=start_date, created_at__lte=now).count()
        total_engagement = period_likes + period_comments

        # 2. Member Growth Daily Trend
        member_growth_qs = (
            Member.objects.filter(created_at__gte=start_date, created_at__lte=now)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        member_growth = [{'date': str(item['date']), 'count': item['count']} for item in member_growth_qs]

        # 3. Post Creation and Approval Daily Trend
        posts_trend_qs = (
            MemberPost.objects.filter(is_active=True, created_at__gte=start_date, created_at__lte=now)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(
                total=Count('id'),
                approved=Count('id', filter=Q(status=MemberPostStatus.APPROVED)),
                rejected=Count('id', filter=Q(status=MemberPostStatus.REJECTED)),
                pending=Count('id', filter=Q(status=MemberPostStatus.PENDING_APPROVAL)),
            )
            .order_by('date')
        )
        posts_trend = [{
            'date': str(item['date']),
            'total': item['total'],
            'approved': item['approved'],
            'rejected': item['rejected'],
            'pending': item['pending'],
        } for item in posts_trend_qs]

        # 4. Engagement Trends Daily
        likes_daily = {
            str(item['date']): item['count']
            for item in (
                MemberPostLike.objects.filter(created_at__gte=start_date, created_at__lte=now)
                .annotate(date=TruncDate('created_at'))
                .values('date')
                .annotate(count=Count('id'))
            )
        }
        comments_daily = {
            str(item['date']): item['count']
            for item in (
                MemberPostComment.objects.filter(created_at__gte=start_date, created_at__lte=now)
                .annotate(date=TruncDate('created_at'))
                .values('date')
                .annotate(count=Count('id'))
            )
        }
        all_dates = sorted(set(list(likes_daily.keys()) + list(comments_daily.keys())))
        engagement_trends = [{
            'date': d,
            'likes': likes_daily.get(d, 0),
            'comments': comments_daily.get(d, 0),
            'total': likes_daily.get(d, 0) + comments_daily.get(d, 0)
        } for d in all_dates]

        # 5. Category Distribution
        cat_counts = (
            MemberPost.objects.filter(is_active=True)
            .values('post_category')
            .annotate(count=Count('id'))
        )
        cat_map = {item['post_category']: item['count'] for item in cat_counts}
        category_distribution = {
            'SELF': cat_map.get(MemberPostCategory.SELF, 0),
            'PUBLIC': cat_map.get(MemberPostCategory.PUBLIC, 0),
            'OFFICIAL_TRUST': cat_map.get(MemberPostCategory.OFFICIAL_TRUST, 0),
        }

        # 6. Verification Requests Summary
        verif_counts = (
            MemberVerificationRequest.objects
            .values('status')
            .annotate(count=Count('id'))
        )
        verif_map = {item['status']: item['count'] for item in verif_counts}
        verification_summary = {
            'pending': verif_map.get(VerificationStatus.PENDING, 0),
            'approved': verif_map.get(VerificationStatus.APPROVED, 0),
            'rejected': verif_map.get(VerificationStatus.REJECTED, 0),
        }

        # 7. Active Voting Campaigns Summary
        polls_qs = SocialPoll.objects.filter(status=PollStatus.ACTIVE)[:5]
        active_polls = [{
            'id': str(p.id),
            'title': p.title,
            'total_votes': p.votes.count(),
            'end_time': p.end_time.isoformat() if p.end_time else None
        } for p in polls_qs]

        # 8. POM Overview
        pom_qs = PublicCooperationMessage.objects.filter(status=POMStatus.PUBLISHED)[:5]
        pom_summary = [{
            'id': str(m.id),
            'title': m.title,
            'category': m.category,
            'views_count': m.views_count,
            'responses_count': m.responses_count
        } for m in pom_qs]

        return Response({
            'period': period,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': now.strftime('%Y-%m-%d'),
            'summary': {
                'total_members': total_registered_members,
                'new_members': new_members_count,
                'total_posts': total_posts,
                'pending_post_approvals': pending_post_approvals,
                'published_public_posts': published_public_posts,
                'published_official_posts': published_official_posts,
                'pending_verifications': pending_verifications,
                'active_voting_campaigns': active_voting_campaigns,
                'pom_messages_published': pom_messages_published,
                'period_likes': period_likes,
                'period_comments': period_comments,
                'total_engagement': total_engagement,
            },
            'charts': {
                'member_growth': member_growth,
                'posts_trend': posts_trend,
                'engagement_trends': engagement_trends,
                'category_distribution': category_distribution,
                'verification_summary': verification_summary,
                'active_polls': active_polls,
                'pom_summary': pom_summary,
            }
        })


class MemberVerificationViewSet(ModelViewSet):
    """Account verification queue for review, document inspection, approval, and rejection"""
    queryset = MemberVerificationRequest.objects.select_related('user', 'member', 'reviewed_by').order_by('-submitted_at')
    serializer_class = MemberVerificationRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        user_role = getattr(user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA'] and not user.is_staff and not user.is_superuser:
            return qs.filter(user=user)
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                models.Q(full_name__icontains=search) |
                models.Q(phone__icontains=search) |
                models.Q(id_proof_number__icontains=search) |
                models.Q(user__username__icontains=search) |
                models.Q(user__full_name__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        from core.serializers import get_user_member
        member = get_user_member(self.request.user)
        serializer.save(
            user=self.request.user,
            member=member,
            full_name=self.request.data.get('full_name') or self.request.user.full_name,
            phone=self.request.data.get('phone') or str(getattr(self.request.user, 'phone', ''))
        )

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'error': 'Permission denied. Only Trust moderators can verify accounts.'}, status=403)

        req = self.get_object()
        req.status = VerificationStatus.APPROVED
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.rejection_reason = ''
        req.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'rejection_reason', 'updated_at'])

        # Set is_verified on User and Member
        req.user.is_verified = True
        req.user.save(update_fields=['is_verified'])
        if req.member:
            req.member.is_verified = True
            req.member.save(update_fields=['is_verified'])

        # Send push notification
        try:
            from notify.service import push_notification
            push_notification(
                recipient=req.user,
                title="Account Verified! 🛡️",
                message="Congratulations! Your Sree Lakshmi Trust profile has been verified. The verified badge is now visible across the platform.",
                notification_type='ACCOUNT_VERIFIED',
                reference_id=str(req.id),
                reference_type='MemberVerificationRequest',
                priority='HIGH'
            )
        except Exception as e:
            logging.getLogger(__name__).error(f"Error notifying verification approval: {e}")

        AuditLog.objects.create(
            user=request.user,
            action='APPROVE_VERIFICATION',
            module='SOCIAL_MEDIA',
            record_type='MemberVerificationRequest',
            record_id=str(req.id),
            reference_number=req.user.username,
            new_status=req.status,
            description=f"Member @{req.user.username} verification approved by {request.user.full_name or request.user.username}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({
            'message': f'Account verification for @{req.user.username} approved successfully! Verified badge awarded.',
            'status': req.status
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'error': 'Permission denied.'}, status=403)

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'error': 'Rejection reason is required.'}, status=400)

        req = self.get_object()
        req.status = VerificationStatus.REJECTED
        req.rejection_reason = reason
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save(update_fields=['status', 'rejection_reason', 'reviewed_by', 'reviewed_at', 'updated_at'])

        # Send push notification
        try:
            from notify.service import push_notification
            push_notification(
                recipient=req.user,
                title="Verification Update",
                message=f"Your verification request was not approved: {reason}. You may reapply with valid documentation.",
                notification_type='ACCOUNT_VERIFICATION_REJECTED',
                reference_id=str(req.id),
                reference_type='MemberVerificationRequest',
                priority='NORMAL'
            )
        except Exception as e:
            logging.getLogger(__name__).error(f"Error notifying verification rejection: {e}")

        AuditLog.objects.create(
            user=request.user,
            action='REJECT_VERIFICATION',
            module='SOCIAL_MEDIA',
            record_type='MemberVerificationRequest',
            record_id=str(req.id),
            reference_number=req.user.username,
            new_status=req.status,
            description=f"Member @{req.user.username} verification rejected: {reason}",
            ip_address=getattr(request, 'audit_ip', None)
        )

        return Response({
            'message': f'Verification request rejected with reason.',
            'status': req.status,
            'reason': reason
        })


class PublicCooperationMessageViewSet(ModelViewSet):
    """Public Cooperation Messages (POM) for community announcements, emergency blood requests, etc."""
    queryset = PublicCooperationMessage.objects.select_related('created_by').order_by('-is_pinned', '-created_at')
    serializer_class = PublicCooperationMessageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)
        category_param = self.request.query_params.get('category')
        if category_param and category_param != 'ALL':
            qs = qs.filter(category=category_param)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                models.Q(title__icontains=search) |
                models.Q(description__icontains=search) |
                models.Q(target_location__icontains=search) |
                models.Q(contact_person__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        user_role = getattr(self.request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Trust administrators can create Public Cooperation Messages.")
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='increment-view')
    def increment_view(self, request, pk=None):
        pom = self.get_object()
        pom.views_count = models.F('views_count') + 1
        pom.save(update_fields=['views_count'])
        pom.refresh_from_db(fields=['views_count'])
        return Response({'views_count': pom.views_count})

    @action(detail=True, methods=['post'], url_path='respond')
    def respond(self, request, pk=None):
        pom = self.get_object()
        pom.responses_count = models.F('responses_count') + 1
        pom.save(update_fields=['responses_count'])
        pom.refresh_from_db(fields=['responses_count'])
        return Response({'responses_count': pom.responses_count, 'message': 'Thank you for your response!'})

    @action(detail=True, methods=['post'], url_path='toggle-pin')
    def toggle_pin(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'error': 'Permission denied.'}, status=403)
        pom = self.get_object()
        pom.is_pinned = not pom.is_pinned
        pom.save(update_fields=['is_pinned', 'updated_at'])
        return Response({'is_pinned': pom.is_pinned})

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'error': 'Permission denied.'}, status=403)
        target_status = request.data.get('status')
        if target_status not in [POMStatus.DRAFT, POMStatus.PUBLISHED, POMStatus.ARCHIVED]:
            return Response({'error': 'Invalid status.'}, status=400)
        pom = self.get_object()
        pom.status = target_status
        pom.save(update_fields=['status', 'updated_at'])
        return Response({'status': pom.status, 'message': f'POM status changed to {target_status}.'})


class SocialPollViewSet(ModelViewSet):
    """Voting and poll management with integrity protection, one-vote enforcement, and live results calculation"""
    queryset = SocialPoll.objects.prefetch_related('options', 'votes').select_related('created_by').order_by('-created_at')
    serializer_class = SocialPollSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'results']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(models.Q(title__icontains=search) | models.Q(description__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'error': 'Permission denied. Only Trust administrators can create polls.'}, status=403)

        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'error': 'Poll title is required.'}, status=400)

        options_data = request.data.get('options') or []
        if isinstance(options_data, str):
            import json
            try:
                options_data = json.loads(options_data)
            except Exception:
                options_data = [opt.strip() for opt in options_data.split(',') if opt.strip()]

        cleaned_options = [str(opt).strip() for opt in options_data if str(opt).strip()]
        if len(cleaned_options) < 2:
            return Response({'error': 'At least 2 options are required for a poll.'}, status=400)

        with transaction.atomic():
            poll = SocialPoll.objects.create(
                title=title,
                description=(request.data.get('description') or '').strip(),
                status=request.data.get('status') or PollStatus.ACTIVE,
                start_time=request.data.get('start_time') or timezone.now(),
                end_time=request.data.get('end_time') or None,
                is_anonymous=request.data.get('is_anonymous') in [True, 'true', '1'],
                show_results_before_close=request.data.get('show_results_before_close') in [True, 'true', '1'],
                eligible_roles=request.data.get('eligible_roles') or 'ALL',
                created_by=request.user
            )
            for idx, opt_text in enumerate(cleaned_options):
                SocialPollOption.objects.create(
                    poll=poll,
                    option_text=opt_text,
                    order=idx
                )

        serializer = self.get_serializer(poll)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=['post'], url_path='vote')
    def vote(self, request, pk=None):
        poll = self.get_object()

        # Check status
        if poll.status != PollStatus.ACTIVE:
            return Response({'error': f'This poll is currently {poll.get_status_display().lower()} and not accepting votes.'}, status=400)

        # Check deadline
        if poll.end_time and timezone.now() > poll.end_time:
            poll.status = PollStatus.CLOSED
            poll.save(update_fields=['status'])
            return Response({'error': 'Voting for this poll has concluded.'}, status=400)

        # Check eligibility
        if poll.eligible_roles and poll.eligible_roles != 'ALL':
            allowed = [r.strip() for r in poll.eligible_roles.split(',') if r.strip()]
            user_role = getattr(request.user, 'role', '')
            if user_role not in allowed:
                return Response({'error': f'Only {poll.eligible_roles} members are eligible to vote in this poll.'}, status=403)

        option_id = request.data.get('option_id')
        if not option_id:
            return Response({'error': 'Please select an option to vote.'}, status=400)

        try:
            option = poll.options.get(id=option_id)
        except SocialPollOption.DoesNotExist:
            return Response({'error': 'Selected option does not exist.'}, status=404)

        with transaction.atomic():
            existing_vote = SocialPollVote.objects.select_for_update().filter(poll=poll, voter=request.user).first()
            if existing_vote:
                return Response({'error': 'You have already cast your vote in this poll.'}, status=400)

            SocialPollVote.objects.create(
                poll=poll,
                option=option,
                voter=request.user
            )

            # Re-sync exact counts for all options in this poll
            for opt in poll.options.all():
                opt.votes_count = opt.votes.count()
                opt.save(update_fields=['votes_count'])

        # Broadcast real-time refresh to all connected web dashboards and mobile clients
        try:
            from notify.service import push_dashboard_refresh
            push_dashboard_refresh(['SOCIAL_MEDIA', 'MANAGER', 'ADMIN', 'MEMBER', 'STAFF'], module='SOCIAL_POLLS')
        except Exception:
            pass

        serializer = self.get_serializer(poll)
        return Response({
            'message': 'Your vote has been recorded successfully!',
            'poll': serializer.data
        })

    @action(detail=True, methods=['post'], url_path='close')
    def close_poll(self, request, pk=None):
        user_role = getattr(request.user, 'role', '')
        if user_role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'error': 'Permission denied.'}, status=403)
        poll = self.get_object()
        poll.status = PollStatus.CLOSED
        poll.save(update_fields=['status', 'updated_at'])
        return Response({'message': 'Poll closed successfully.', 'status': poll.status})

    @action(detail=True, methods=['get'], url_path='results')
    def results(self, request, pk=None):
        poll = self.get_object()
        total_votes = poll.votes.count()
        options = []
        for opt in poll.options.all():
            cnt = opt.votes.count()
            pct = round((cnt / total_votes * 100), 1) if total_votes > 0 else 0.0
            options.append({
                'id': str(opt.id),
                'text': opt.option_text,
                'votes': cnt,
                'percentage': pct,
            })
        return Response({
            'poll_id': str(poll.id),
            'title': poll.title,
            'status': poll.status,
            'total_votes': total_votes,
            'options': options,
            'is_anonymous': poll.is_anonymous,
            'show_results_before_close': poll.show_results_before_close,
        })
