"""Core module serializers — User and AuditLog"""
from rest_framework import serializers
from core.models import (
    User, AuditLog, SystemNotification, Event,
    MemberPost, MemberPostImage, MemberPostLike, MemberPostComment
)


class UserSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'role', 'phone', 'photo', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']

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

