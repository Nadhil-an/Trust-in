"""Core module serializers — User and AuditLog"""
from rest_framework import serializers
from core.models import (
    User, AuditLog, SystemNotification, Event,
    MemberPost, MemberPostImage, MemberPostLike, MemberPostComment
)


class UserSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()
    member_id = serializers.SerializerMethodField()
    member_name = serializers.SerializerMethodField()
    member_since = serializers.SerializerMethodField()
    valid_upto = serializers.SerializerMethodField()
    is_subscription_expired = serializers.SerializerMethodField()
    has_active_subscription = serializers.SerializerMethodField()
    is_paid_member = serializers.SerializerMethodField()
    subscription_status = serializers.SerializerMethodField()
    days_left_to_expire = serializers.SerializerMethodField()
    monthly_fee = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'role', 'phone', 'photo',
            'is_active', 'date_joined',
            'member_id', 'member_name', 'member_since', 'valid_upto',
            'is_subscription_expired', 'has_active_subscription', 'is_paid_member',
            'subscription_status', 'days_left_to_expire', 'monthly_fee'
        ]
        read_only_fields = ['id', 'date_joined']

    def _get_member(self, obj):
        if hasattr(obj, '_cached_member'):
            return obj._cached_member
        from hr_module.models import Member
        target_username = (obj.username or '').strip()
        target_phone = str(getattr(obj, 'phone', '') or '').strip()
        target_name = (obj.full_name or '').strip().lower()

        member = None
        if target_username:
            member = Member.objects.filter(member_id__iexact=target_username).first()
        if not member and target_name:
            member = Member.objects.filter(full_name__iexact=obj.full_name.strip()).first()
        if not member:
            for m in Member.objects.all():
                m_phone = str(m.phone or '').strip()
                if m_phone and (m_phone == target_username or (target_phone and m_phone == target_phone)):
                    member = m
                    break
        obj._cached_member = member
        return member

    def get_member_id(self, obj):
        member = self._get_member(obj)
        if member and member.member_id:
            return member.member_id
        return obj.username or ''

    def get_member_name(self, obj):
        return obj.full_name or (self._get_member(obj).full_name if self._get_member(obj) else '')

    def _get_subscription_info(self, obj):
        if hasattr(obj, '_cached_subscription_info'):
            return obj._cached_subscription_info

        from accounts_module.models import Income
        from django.db import models
        from django.utils import timezone
        from dateutil.relativedelta import relativedelta

        today = timezone.localdate()
        member = self._get_member(obj)

        q = models.Q(created_by=obj)
        if obj.full_name and obj.full_name.strip():
            q |= models.Q(donor_name__iexact=obj.full_name.strip())
        if member and member.full_name and member.full_name.strip():
            q |= models.Q(donor_name__iexact=member.full_name.strip())
        if member and getattr(member, 'phone', None):
            q |= models.Q(donor_phone__iexact=str(member.phone).strip())
        if getattr(obj, 'phone', None):
            q |= models.Q(donor_phone__iexact=str(obj.phone).strip())

        latest_income = Income.objects.filter(source='MEMBERSHIP').filter(q).order_by('-date', '-created_at').first()

        if not latest_income:
            info = {
                'has_active_subscription': False,
                'is_paid_member': False,
                'subscription_status': 'NOT_SUBSCRIBED',
                'valid_upto': None,
                'days_left_to_expire': None,
                'is_subscription_expired': True,
                'latest_payment_date': None,
            }
        else:
            base_date = latest_income.date or (latest_income.created_at.date() if latest_income.created_at else None)
            if not base_date:
                base_date = today

            valid_date = base_date + relativedelta(months=1)
            days_left = (valid_date - today).days

            if days_left < 0:
                status = 'EXPIRED'
                is_expired = True
                is_active = False
            elif days_left <= 2:
                status = 'EXPIRING_SOON'
                is_expired = False
                is_active = True
            else:
                status = 'ACTIVE'
                is_expired = False
                is_active = True

            info = {
                'has_active_subscription': is_active,
                'is_paid_member': True,
                'subscription_status': status,
                'valid_upto': valid_date.strftime('%d %b %Y'),
                'days_left_to_expire': days_left,
                'is_subscription_expired': is_expired,
                'latest_payment_date': base_date.strftime('%d %b %Y') if base_date else None,
            }

        obj._cached_subscription_info = info
        return info

    def get_member_since(self, obj):
        info = self._get_subscription_info(obj)
        if not info['is_paid_member']:
            return 'Not Subscribed'
        from accounts_module.models import Income
        from django.db import models
        member = self._get_member(obj)
        q = models.Q(created_by=obj)
        if obj.full_name and obj.full_name.strip():
            q |= models.Q(donor_name__iexact=obj.full_name.strip())
        if member and member.full_name and member.full_name.strip():
            q |= models.Q(donor_name__iexact=member.full_name.strip())
        earliest_income = Income.objects.filter(source='MEMBERSHIP').filter(q).order_by('date', 'created_at').first()
        if earliest_income:
            d = earliest_income.date or earliest_income.created_at
            return d.strftime('%B %Y')
        return 'Not Subscribed'

    def get_valid_upto(self, obj):
        return self._get_subscription_info(obj)['valid_upto']

    def get_is_subscription_expired(self, obj):
        return self._get_subscription_info(obj)['is_subscription_expired']

    def get_has_active_subscription(self, obj):
        return self._get_subscription_info(obj)['has_active_subscription']

    def get_is_paid_member(self, obj):
        return self._get_subscription_info(obj)['is_paid_member']

    def get_subscription_status(self, obj):
        return self._get_subscription_info(obj)['subscription_status']

    def get_days_left_to_expire(self, obj):
        return self._get_subscription_info(obj)['days_left_to_expire']

    def get_monthly_fee(self, obj):
        member = self._get_member(obj)
        if member and member.monthly_fee is not None:
            return float(member.monthly_fee)
        return 100.00

    def get_photo(self, obj):
        request = self.context.get('request')
        if obj.photo:
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        
        if obj.role != 'MEMBER':
            from hr_module.models import ExecutiveOfficer
            officer = ExecutiveOfficer.objects.filter(full_name__iexact=obj.full_name).first()
            if officer and officer.photo:
                if request:
                    return request.build_absolute_uri(officer.photo.url)
                return officer.photo.url
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'full_name', 'role', 'phone', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'email', 'phone', 'photo']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return data


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_user_name(self, obj):
        return obj.user.full_name if obj.user else 'System'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemNotification
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class MemberPostImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = MemberPostImage
        fields = ['id', 'image', 'order', 'created_at']

    def get_image(self, obj):
        if not obj.image:
            return None
        url = obj.image.url
        if url.startswith('http://') or url.startswith('https://'):
            return url
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(url)
        return url


class MemberPostCommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = MemberPostComment
        fields = ['id', 'post', 'author', 'text', 'created_at']
        read_only_fields = ['id', 'post', 'author', 'created_at']

    def get_author(self, obj):
        request = self.context.get('request')
        photo_url = None
        if obj.user.photo:
            photo_url = request.build_absolute_uri(obj.user.photo.url) if request else obj.user.photo.url
        return {
            'id': str(obj.user.id),
            'username': obj.user.username,
            'full_name': obj.user.full_name or obj.user.username,
            'photo': photo_url,
            'role': obj.user.role,
        }


class MemberPostSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    images = MemberPostImageSerializer(many=True, read_only=True)
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    is_liked_by_me = serializers.SerializerMethodField()
    assessment_request_number = serializers.SerializerMethodField()
    address = serializers.CharField(required=True, allow_blank=False, error_messages={
        'required': 'Location or address is required.',
        'blank': 'Location or address cannot be blank.'
    })

    class Meta:
        model = MemberPost
        fields = [
            'id', 'author', 'description', 'contact_number', 'address',
            'status', 'assessment_request', 'assessment_request_number',
            'is_active', 'images', 'likes_count', 'comments_count',
            'is_liked_by_me', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'author', 'status', 'is_active', 'assessment_request',
            'assessment_request_number', 'likes_count', 'comments_count',
            'is_liked_by_me', 'created_at', 'updated_at'
        ]

    def get_author(self, obj):
        request = self.context.get('request')
        photo_url = None
        if obj.author.photo:
            photo_url = request.build_absolute_uri(obj.author.photo.url) if request else obj.author.photo.url
        return {
            'id': str(obj.author.id),
            'username': obj.author.username,
            'full_name': obj.author.full_name or obj.author.username,
            'photo': photo_url,
            'role': obj.author.role,
            'phone': getattr(obj.author, 'phone', ''),
        }

    def get_likes_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'likes' in obj._prefetched_objects_cache:
            return len(obj.likes.all())
        return obj.likes.count()

    def get_comments_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'comments' in obj._prefetched_objects_cache:
            return len(obj.comments.all())
        return obj.comments.count()

    def get_is_liked_by_me(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if hasattr(obj, '_prefetched_objects_cache') and 'likes' in obj._prefetched_objects_cache:
            return any(str(l.user_id) == str(request.user.id) for l in obj.likes.all())
        return obj.likes.filter(user=request.user).exists()

    def get_assessment_request_number(self, obj):
        return obj.assessment_request.request_number if obj.assessment_request else None

