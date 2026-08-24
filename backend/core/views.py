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

from core.models import User, AuditLog, SystemNotification
from core.serializers import (UserSerializer, UserCreateSerializer,
                                UserUpdateSerializer, ChangePasswordSerializer,
                                AuditLogSerializer, NotificationSerializer)
from core.permissions import IsAdmin, IsAnyStaff


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
    rate = '5/minute'

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        import time, random
        time.sleep(random.uniform(0.05, 0.15))

        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response({'error': 'Username and password are required.'}, status=400)

        # First check if user exists to handle lockout safely without leaking existence
        user_obj = User.objects.filter(username=username).first()

        if user_obj and user_obj.is_account_locked():
            return Response({'error': 'Account is temporarily locked. Try again later.'}, status=403)

        user = authenticate(request, username=username, password=password)
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
        refresh_token = request.COOKIES.get('refresh_token') or request.data.get('refresh_token')
        if not refresh_token:
            return Response({'error': 'Refresh token not provided.'}, status=401)
        try:
            token = RefreshToken(refresh_token)
            access = token.access_token
            response = Response({'message': 'Token refreshed.'})
            jwt_settings = settings.SIMPLE_JWT
            response.set_cookie('access_token', str(access),
                                max_age=int(jwt_settings['ACCESS_TOKEN_LIFETIME'].total_seconds()),
                                httponly=True,
                                secure=jwt_settings.get('AUTH_COOKIE_SECURE', False),
                                samesite=jwt_settings.get('AUTH_COOKIE_SAMESITE', 'Lax'), path='/')
            return response
        except TokenError as e:
            return Response({'error': str(e)}, status=401)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
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
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user, action='CREATE_USER', module='ADMIN',
            record_type='User', record_id=str(user.id),
            description=f"User {user.username} ({user.role}) created by {self.request.user.full_name}",
            ip_address=getattr(self.request, 'audit_ip', None)
        )


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdmin]
    queryset = User.objects.all()

    def get_serializer_class(self):
        return UserSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
        AuditLog.objects.create(
            user=self.request.user, action='DEACTIVATE_USER', module='ADMIN',
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
