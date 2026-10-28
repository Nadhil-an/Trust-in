import os
from rest_framework import serializers
from core.models import (
    MemberInteraction,
    MemberTask,
    BadgeDefinition,
    MemberBadge,
    MemberAchievement,
    VolunteerAllowanceRecord,
    MemberAppreciation,
    MemberPost,
    User,
    TaskStatus,
)
from hr_module.models import Member, Volunteer


class MemberInteractionSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    assigned_staff_name = serializers.CharField(source='assigned_staff.full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = MemberInteraction
        fields = [
            'id', 'member', 'member_name', 'interaction_type',
            'summary', 'notes', 'confidential_notes',
            'follow_up_date', 'follow_up_status',
            'assigned_staff', 'assigned_staff_name',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        # Protect confidential notes: only ADMIN and MANAGER can see internal confidential notes
        if request and request.user and request.user.role not in ['ADMIN', 'MANAGER']:
            ret.pop('confidential_notes', None)
        return ret


class MemberTaskSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    member_id_str = serializers.CharField(source='member.member_id', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.full_name', read_only=True)
    responsible_staff_name = serializers.CharField(source='responsible_staff.full_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)
    completion_percentage = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()

    class Meta:
        model = MemberTask
        fields = [
            'id', 'task_number', 'title', 'description', 'category',
            'member', 'member_name', 'member_id_str',
            'assigned_by', 'assigned_by_name',
            'responsible_staff', 'responsible_staff_name',
            'start_date', 'due_date',
            'target_value', 'achieved_value', 'target_unit',
            'status', 'requires_verification',
            'evidence_notes', 'evidence_file', 'submitted_at',
            'review_notes', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'completion_percentage', 'is_overdue',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'task_number', 'assigned_by',
            'completion_percentage', 'is_overdue',
            'reviewed_by', 'reviewed_at',
            'created_at', 'updated_at'
        ]


class BadgeDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BadgeDefinition
        fields = [
            'badge_key', 'name', 'icon', 'color', 'category', 'description',
            'min_referrals_monthly', 'daily_collection_target', 'min_services_monthly',
            'consecutive_months_required', 'requires_volunteer_application',
            'prerequisite_badge_key', 'is_permanent_default', 'allow_repeat_awards',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class MemberBadgeSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    badge_name = serializers.CharField(source='badge.name', read_only=True)
    badge_icon = serializers.CharField(source='badge.icon', read_only=True)
    badge_color = serializers.CharField(source='badge.color', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.full_name', read_only=True)

    class Meta:
        model = MemberBadge
        fields = [
            'id', 'member', 'member_name',
            'badge', 'badge_name', 'badge_icon', 'badge_color',
            'qualifying_period', 'is_permanent', 'times_earned',
            'award_source', 'reason',
            'awarded_by', 'awarded_by_name',
            'awarded_at', 'created_at'
        ]
        read_only_fields = ['id', 'awarded_by', 'awarded_at', 'created_at']


class MemberAchievementSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    awarded_by_name = serializers.CharField(source='awarded_by.full_name', read_only=True)

    class Meta:
        model = MemberAchievement
        fields = [
            'id', 'member', 'member_name', 'category', 'title',
            'description', 'qualifying_period', 'award_source',
            'awarded_by', 'awarded_by_name', 'awarded_at', 'evidence'
        ]
        read_only_fields = ['id', 'awarded_by', 'awarded_at']


class VolunteerAllowanceRecordSerializer(serializers.ModelSerializer):
    volunteer_name = serializers.CharField(source='volunteer.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)

    class Meta:
        model = VolunteerAllowanceRecord
        fields = [
            'id', 'volunteer', 'volunteer_name', 'month', 'year',
            'petrol_allowance', 'recharge_allowance', 'trip_allowance',
            'total_approved', 'status', 'notes',
            'approved_by', 'approved_by_name', 'approved_at',
            'created_at'
        ]
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at']


class MemberAppreciationSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    member_photo = serializers.SerializerMethodField()
    badge_name = serializers.CharField(source='badge.name', read_only=True)
    badge_icon = serializers.CharField(source='badge.icon', read_only=True)
    post_title = serializers.CharField(source='post.title', read_only=True)
    post_description = serializers.CharField(source='post.description', read_only=True)
    post_images = serializers.SerializerMethodField()
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)

    class Meta:
        model = MemberAppreciation
        fields = [
            'id', 'post', 'post_title', 'post_description', 'post_images',
            'member', 'member_name', 'member_photo',
            'badge', 'badge_name', 'badge_icon',
            'achievement', 'recognition_category', 'approval_status',
            'approved_by', 'approved_by_name', 'approved_at', 'created_at'
        ]
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at']

    def get_member_photo(self, obj):
        if obj.member and obj.member.photo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.member.photo.url) if request else obj.member.photo.url
        return None

    def get_post_images(self, obj):
        request = self.context.get('request')
        return [
            request.build_absolute_uri(img.image.url) if request else img.image.url
            for img in obj.post.images.all()
        ]


class MRMMemberDetailSerializer(serializers.ModelSerializer):
    earned_badges_summary = serializers.SerializerMethodField()
    badges_list = serializers.SerializerMethodField()
    tasks = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()
    volunteer_info = serializers.SerializerMethodField()
    interactions = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            'id', 'member_id', 'full_name', 'photo', 'gender',
            'membership_type', 'status', 'is_verified', 'blood_group',
            'occupation', 'monthly_fee', 'joining_date', 'remarks',
            'earned_badges_summary', 'badges_list',
            'tasks', 'achievements', 'volunteer_info', 'interactions',
            'posts_count'
        ]

    def get_earned_badges_summary(self, obj):
        # Format: "🟨 × 2 | 🟩 × 1"
        awards = MemberBadge.objects.filter(member=obj).select_related('badge')
        if not awards.exists():
            return "No badges yet"
        parts = []
        for aw in awards:
            parts.append(f"{aw.badge.icon} × {aw.times_earned}")
        return " | ".join(parts)

    def get_badges_list(self, obj):
        awards = MemberBadge.objects.filter(member=obj).select_related('badge')
        return MemberBadgeSerializer(awards, many=True, context=self.context).data

    def get_tasks(self, obj):
        tasks = MemberTask.objects.filter(member=obj).order_by('-due_date')[:10]
        return MemberTaskSerializer(tasks, many=True, context=self.context).data

    def get_achievements(self, obj):
        achievements = MemberAchievement.objects.filter(member=obj).order_by('-awarded_at')[:10]
        return MemberAchievementSerializer(achievements, many=True, context=self.context).data

    def get_volunteer_info(self, obj):
        # Check if volunteer record exists for this member / user
        from hr_module.models import Volunteer
        vol = Volunteer.objects.filter(full_name__iexact=obj.full_name).first()
        if not vol and hasattr(obj, 'created_by') and obj.created_by:
            vol = Volunteer.objects.filter(user=obj.created_by).first()
        if vol:
            return {
                'id': str(vol.id),
                'volunteer_id': vol.volunteer_id,
                'status': vol.status,
                'total_hours': str(vol.total_hours),
                'joining_date': str(vol.joining_date)
            }
        return None

    def get_interactions(self, obj):
        request = self.context.get('request')
        qs = MemberInteraction.objects.filter(member=obj).order_by('-created_at')[:15]
        return MemberInteractionSerializer(qs, many=True, context=self.context).data

    def get_posts_count(self, obj):
        # Find matching User
        if hasattr(obj, 'created_by') and obj.created_by:
            return MemberPost.objects.filter(author=obj.created_by, is_active=True).count()
        user = User.objects.filter(full_name__iexact=obj.full_name).first()
        if user:
            return MemberPost.objects.filter(author=user, is_active=True).count()
        return 0
