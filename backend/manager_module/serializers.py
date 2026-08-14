"""Manager Module Serializers"""
from rest_framework import serializers
from manager_module.models import (
    AssessmentRequest, RequestStatusHistory,
    FAOReport, FAOPhoto,
    ACOCalculation,
    GEOReport, GEOPhoto,
    CharityInventory,
    MinutesRegistry, Partner,
)
from core.serializers import UserSerializer


# ── Assessment Request ────────────────────────────────────────────

class AssessmentRequestListSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    has_fao_report = serializers.SerializerMethodField()
    has_aco_calculation = serializers.SerializerMethodField()
    has_geo_report = serializers.SerializerMethodField()
    recommended_amount = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentRequest
        fields = [
            'id', 'request_number', 'request_type', 'category', 'priority', 'status',
            'source', 'purpose', 'description',
            'amount_requested', 'amount_approved', 'amount_disbursed',
            'beneficiary_name', 'beneficiary_age', 'beneficiary_phone', 'beneficiary_address',
            'eligibility',
            'requested_by_name', 'reviewed_by_name', 'required_date',
            'has_fao_report', 'has_aco_calculation', 'has_geo_report',
            'recommended_amount',
            'created_at', 'submitted_at', 'approved_at', 'updated_at',
        ]

    def get_requested_by_name(self, obj):
        return obj.requested_by.full_name if obj.requested_by else ''

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.full_name if obj.reviewed_by else ''

    def get_has_fao_report(self, obj):
        return hasattr(obj, 'fao_report')

    def get_has_aco_calculation(self, obj):
        return hasattr(obj, 'aco_calculation')

    def get_has_geo_report(self, obj):
        return hasattr(obj, 'geo_report')

    def get_recommended_amount(self, obj):
        if hasattr(obj, 'aco_calculation'):
            return str(obj.aco_calculation.recommended_amount)
        return None


class FAOReportSummarySerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = FAOReport
        fields = [
            'id', 'eligibility', 'eligibility_reason',
            'urgency_assessment', 'category_confirmed',
            'officer_findings', 'visited_at', 'submitted_at', 'submitted_by_name',
        ]

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''


class ACOCalculationSummarySerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ACOCalculation
        fields = [
            'id', 'total_one_time_cost', 'total_estimated_cost', 'recommended_amount',
            'has_recurring_cost', 'recurring_monthly_cost', 'recurring_duration_months',
            'justification', 'submitted_at', 'submitted_by_name',
        ]

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''


class GEOReportSummarySerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GEOReport
        fields = [
            'id', 'recommendation', 'recommended_amount_override',
            'recommendation_justification', 'submitted_at', 'submitted_by_name',
        ]

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''


class AssessmentRequestSerializer(serializers.ModelSerializer):
    requested_by = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    disbursed_by = UserSerializer(read_only=True)
    status_history = serializers.SerializerMethodField()
    fao_report_summary = serializers.SerializerMethodField()
    aco_calculation_summary = serializers.SerializerMethodField()
    geo_report_summary = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentRequest
        fields = '__all__'
        read_only_fields = [
            'id', 'request_number', 'status', 'eligibility',
            'requested_by', 'reviewed_by', 'disbursed_by',
            'created_at', 'updated_at', 'submitted_at',
            'reviewed_at', 'approved_at', 'disbursed_at', 'completed_at',
        ]

    def get_status_history(self, obj):
        history = obj.status_history.select_related('changed_by').all()
        return RequestStatusHistorySerializer(history, many=True).data

    def get_fao_report_summary(self, obj):
        if hasattr(obj, 'fao_report'):
            return FAOReportSummarySerializer(obj.fao_report).data
        return None

    def get_aco_calculation_summary(self, obj):
        if hasattr(obj, 'aco_calculation'):
            return ACOCalculationSummarySerializer(obj.aco_calculation).data
        return None

    def get_geo_report_summary(self, obj):
        if hasattr(obj, 'geo_report'):
            return GEOReportSummarySerializer(obj.geo_report).data
        return None


class RequestStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RequestStatusHistory
        fields = '__all__'

    def get_changed_by_name(self, obj):
        return obj.changed_by.full_name if obj.changed_by else 'System'


# ── FAO Report ────────────────────────────────────────────────────

class FAOPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAOPhoto
        fields = ['id', 'image', 'caption', 'uploaded_at']


class FAOReportSerializer(serializers.ModelSerializer):
    photos = FAOPhotoSerializer(many=True, read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    uploaded_photos = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False
    )

    class Meta:
        model = FAOReport
        fields = '__all__'
        read_only_fields = ['id', 'assessment', 'submitted_by', 'submitted_at', 'created_at', 'updated_at']

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''

    def create(self, validated_data):
        uploaded_photos = validated_data.pop('uploaded_photos', [])
        report = super().create(validated_data)
        for photo in uploaded_photos:
            FAOPhoto.objects.create(report=report, image=photo)
        return report

    def update(self, instance, validated_data):
        uploaded_photos = validated_data.pop('uploaded_photos', [])
        report = super().update(instance, validated_data)
        for photo in uploaded_photos:
            FAOPhoto.objects.create(report=report, image=photo)
        return report


# ── ACO Calculation ───────────────────────────────────────────────

class ACOCalculationSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ACOCalculation
        fields = '__all__'
        read_only_fields = ['id', 'assessment', 'submitted_by', 'submitted_at', 'created_at', 'updated_at']

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''


# ── GEO Report ────────────────────────────────────────────────────

class GEOPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = GEOPhoto
        fields = ['id', 'image', 'caption', 'uploaded_at']


class GEOReportSerializer(serializers.ModelSerializer):
    photos = GEOPhotoSerializer(many=True, read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    uploaded_photos = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False
    )

    class Meta:
        model = GEOReport
        fields = '__all__'
        read_only_fields = ['id', 'assessment', 'submitted_by', 'submitted_at', 'created_at', 'updated_at']

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''

    def create(self, validated_data):
        uploaded_photos = validated_data.pop('uploaded_photos', [])
        report = super().create(validated_data)
        for photo in uploaded_photos:
            GEOPhoto.objects.create(report=report, image=photo)
        return report


# ── Charity Inventory ─────────────────────────────────────────────

class CharityInventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CharityInventory
        fields = '__all__'
        read_only_fields = ['id', 'item_code', 'last_updated', 'created_at']


# ── Minutes ───────────────────────────────────────────────────────

class MinutesSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MinutesRegistry
        fields = '__all__'
        read_only_fields = ['id', 'meeting_id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else ''


# ── Partners ──────────────────────────────────────────────────────

class PartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Partner
        fields = '__all__'
        read_only_fields = ['id', 'partner_id', 'created_by', 'created_at', 'updated_at']
