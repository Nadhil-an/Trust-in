"""HR Module Serializers"""
from rest_framework import serializers
from hr_module.models import (Member, MemberDocument, Volunteer, ExecutiveMember,
                               ExecutiveOfficer, SalaryStructure, Attendance,
                               LeaveRequest, MonthlyPayroll, EmployeeDocument,
                               Complaint, StaffReport, PaymentAdvanceRequest, PerformancePoint,
                               PromoterRegistryEntry)


class MemberSerializer(serializers.ModelSerializer):
    document = serializers.FileField(required=False, write_only=True)

    class Meta:
        model = Member
        fields = '__all__'
        read_only_fields = ['id', 'member_id', 'created_by', 'created_at', 'updated_at']


class MemberDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberDocument
        fields = '__all__'
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']


class VolunteerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Volunteer
        fields = '__all__'
        read_only_fields = ['id', 'volunteer_id', 'created_by', 'created_at', 'updated_at']


class ExecutiveMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExecutiveMember
        fields = '__all__'
        read_only_fields = ['id', 'exec_id', 'created_at']


class ExecutiveOfficerSerializer(serializers.ModelSerializer):
    salary_structure = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()

    class Meta:
        model = ExecutiveOfficer
        fields = '__all__'
        read_only_fields = ['id', 'employee_id', 'created_by', 'created_at', 'updated_at']

    def get_salary_structure(self, obj):
        try:
            salary = SalaryStructure.objects.get(employee=obj, is_active=True)
            from hr_module.serializers import SalaryStructureSerializer
            return SalaryStructureSerializer(salary).data
        except SalaryStructure.DoesNotExist:
            return None

    def get_user_id(self, obj):
        from django.db.models import Q
        from core.models import User
        
        # Build query avoiding empty email strings matching incorrectly
        q = Q(full_name__iexact=obj.full_name)
        if obj.email:
            q |= Q(email__iexact=obj.email)
            
        users = User.objects.filter(q)
        
        if obj.designation:
            user = users.filter(role__iexact=obj.designation).first()
            if user: return str(user.id)
            
        user = users.first()
        return str(user.id) if user else None

    def get_username(self, obj):
        from django.db.models import Q
        from core.models import User
        
        q = Q(full_name__iexact=obj.full_name)
        if obj.email:
            q |= Q(email__iexact=obj.email)
            
        users = User.objects.filter(q)
        
        if obj.designation:
            user = users.filter(role__iexact=obj.designation).first()
            if user: return user.username
            
        user = users.first()
        return user.username if user else ''


class SalaryStructureSerializer(serializers.ModelSerializer):
    gross_salary = serializers.ReadOnlyField()
    net_salary = serializers.ReadOnlyField()
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = SalaryStructure
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''


class AttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = '__all__'
        read_only_fields = ['id', 'marked_by', 'created_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = '__all__'
        read_only_fields = ['id', 'approved_by', 'approved_at', 'created_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else ''


class MonthlyPayrollSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyPayroll
        fields = '__all__'
        read_only_fields = ['id', 'payroll_id', 'generated_by', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeDocument
        fields = '__all__'
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']


class ComplaintSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = '__all__'
        read_only_fields = ['id', 'complaint_id', 'created_at', 'updated_at', 'employee']

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.full_name
        return ''


class StaffReportSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffReport
        fields = '__all__'
        read_only_fields = ['id', 'report_id', 'submitted_by', 'created_at', 'updated_at', 'employee']

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.full_name
        if obj.submitted_by:
            return obj.submitted_by.full_name
        return 'Unknown'

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else ''


class PaymentAdvanceRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PaymentAdvanceRequest
        fields = '__all__'
        read_only_fields = ['id', 'request_id', 'requested_by', 'created_at', 'updated_at', 'employee']

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.full_name
        if obj.requested_by:
            return obj.requested_by.full_name
        return 'Unknown'

    def get_requested_by_name(self, obj):
        return obj.requested_by.full_name if obj.requested_by else ''



class PerformancePointSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    awarded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PerformancePoint
        fields = '__all__'
        read_only_fields = ['id', 'awarded_by', 'created_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_awarded_by_name(self, obj):
        return obj.awarded_by.full_name if obj.awarded_by else ''


class PromoterRegistrySerializer(serializers.ModelSerializer):
    promoter_name = serializers.SerializerMethodField()
    total_collected = serializers.SerializerMethodField()
    has_discrepancy = serializers.SerializerMethodField()

    class Meta:
        model = PromoterRegistryEntry
        fields = [
            'id', 'date', 'promoter', 'promoter_name',
            'entry_code', 'starting_reading', 'ending_reading',
            'cash_collected', 'online_collected', 'cash_submitted',
            'total_collected', 'has_discrepancy',
            'is_closed', 'closed_at',
            'created_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'closed_at']

    def get_promoter_name(self, obj):
        return obj.promoter.full_name if obj.promoter else ''

    def get_total_collected(self, obj):
        return float(obj.cash_collected) + float(obj.online_collected)

    def get_has_discrepancy(self, obj):
        return obj.has_discrepancy

    def validate(self, data):
        start = data.get('starting_reading')
        end = data.get('ending_reading')
        if start is not None and end is not None and end > 0 and end < start:
            raise serializers.ValidationError("Ending reading must be >= starting reading.")
        return data
