"""HR Module Serializers"""
from rest_framework import serializers
from hr_module.models import (Member, MemberDocument, Volunteer, ExecutiveMember,
                               ExecutiveOfficer, SalaryStructure, Attendance,
                               LeaveRequest, MonthlyPayroll, EmployeeDocument,
                               Complaint)


class MemberSerializer(serializers.ModelSerializer):
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
        read_only_fields = ['id', 'complaint_id', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''
