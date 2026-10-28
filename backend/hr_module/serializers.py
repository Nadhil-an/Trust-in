"""HR Module Serializers"""
from rest_framework import serializers
from hr_module.models import (Member, MemberDocument, Volunteer, ExecutiveMember,
                               ExecutiveOfficer, SalaryStructure, Attendance,
                               LeaveRequest, LeaveHRNote, LeaveHRCommunication, LeaveAuditLog,
                               MonthlyPayroll, EmployeeDocument,
                               Complaint, StaffReport, PaymentAdvanceRequest, PerformancePoint,
                               PromoterRegistryEntry)


class MemberSerializer(serializers.ModelSerializer):
    document = serializers.FileField(required=False, write_only=True)
    password = serializers.CharField(required=False, write_only=True, allow_blank=True, min_length=6)
    username = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Member
        fields = '__all__'
        read_only_fields = ['id', 'member_id', 'created_by', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)
        if 'date_of_birth' in data and not data.get('date_of_birth'):
            data['date_of_birth'] = None
        if 'photo' in data and isinstance(data['photo'], str):
            data.pop('photo')
        if 'document' in data and isinstance(data['document'], str):
            data.pop('document')
        return super().to_internal_value(data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        from core.models import User, Role
        import re
        from django.db.models import Q
        clean_phone = re.sub(r'[^0-9]', '', str(instance.phone or ''))[-10:]
        clean_mem_id = str(instance.member_id or '').replace('MEM-', '').strip()
        
        user = None
        if instance.created_by and getattr(instance.created_by, 'role', None) == Role.MEMBER:
            user = instance.created_by
        if not user and clean_phone:
            user = User.objects.filter(role=Role.MEMBER).filter(
                Q(username__iexact=clean_phone) | Q(username__iexact=str(instance.phone).strip())
            ).first()
        if not user and instance.member_id:
            user = User.objects.filter(role=Role.MEMBER).filter(
                Q(username__iexact=instance.member_id) | Q(username__iexact=clean_mem_id)
            ).first()
        if not user and instance.email:
            user = User.objects.filter(role=Role.MEMBER, email__iexact=instance.email.strip()).first()
        
        data['username'] = user.username if user else (clean_phone or instance.member_id or '')
        data['role'] = 'MEMBER'
        data['is_phone_signup'] = bool(
            (instance.created_by and getattr(instance.created_by, 'role', None) == Role.MEMBER) or
            (user and user.role == Role.MEMBER)
        )

        # Membership validity and expiration calculation
        from hr_module.views import calculate_member_validity
        try:
            validity = calculate_member_validity(instance)
            data['valid_upto'] = validity['valid_upto_str']
            data['days_left'] = validity['days_left']
            data['is_expired'] = validity['is_expired']
        except Exception:
            data['valid_upto'] = None
            data['days_left'] = None
            data['is_expired'] = (instance.status == 'EXPIRED')

        return data

    def create(self, validated_data):
        document = validated_data.pop('document', None)
        password = validated_data.pop('password', None)
        username = validated_data.pop('username', None)
        member = super().create(validated_data)
        if document:
            MemberDocument.objects.create(
                member=member,
                doc_type='ID Proof',
                file=document,
                uploaded_by=validated_data.get('created_by')
            )
        from hr_module.views import sync_member_user_account
        req_user = self.context['request'].user if 'request' in self.context else None
        sync_member_user_account(member, password=password, username=username, request_user=req_user)
        return member

    def update(self, instance, validated_data):
        document = validated_data.pop('document', None)
        password = validated_data.pop('password', None)
        username = validated_data.pop('username', None)
        member = super().update(instance, validated_data)
        if document:
            MemberDocument.objects.create(
                member=member,
                doc_type='ID Proof',
                file=document,
                uploaded_by=self.context['request'].user if 'request' in self.context else None
            )
        from hr_module.views import sync_member_user_account
        req_user = self.context['request'].user if 'request' in self.context else None
        sync_member_user_account(member, password=password, username=username, request_user=req_user)
        return member


class MemberDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberDocument
        fields = '__all__'
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']


class VolunteerSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default='')

    class Meta:
        model = Volunteer
        fields = '__all__'
        read_only_fields = ['id', 'volunteer_id', 'created_by', 'created_at', 'updated_at', 'approved_by', 'approved_at']


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


class LeaveHRNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveHRNote
        fields = ['id', 'author', 'author_name', 'note', 'created_at']
        read_only_fields = ['id', 'author', 'author_name', 'created_at']

    def get_author_name(self, obj):
        return obj.author.full_name or obj.author.username if obj.author else 'HR'


class LeaveHRCommunicationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveHRCommunication
        fields = ['id', 'sender', 'sender_name', 'message', 'is_decision_communicated', 'delivery_status', 'created_at']
        read_only_fields = ['id', 'sender', 'sender_name', 'created_at']

    def get_sender_name(self, obj):
        return obj.sender.full_name or obj.sender.username if obj.sender else 'HR'


class LeaveAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()

    class Meta:
        model = LeaveAuditLog
        fields = ['id', 'actor', 'actor_name', 'actor_role', 'action', 'details', 'ip_address', 'created_at']
        read_only_fields = ['id', 'actor', 'actor_name', 'actor_role', 'action', 'details', 'ip_address', 'created_at']

    def get_actor_name(self, obj):
        return obj.actor.full_name or obj.actor.username if obj.actor else 'System'

    def get_actor_role(self, obj):
        return getattr(obj.actor, 'role', '') if obj.actor else ''


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    staff_uid = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    employee_photo = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    approved_by_role = serializers.SerializerMethodField()
    total_days = serializers.DecimalField(source='number_of_days', max_digits=4, decimal_places=1, read_only=True)
    approved_days_this_month = serializers.SerializerMethodField()
    hr_notes = LeaveHRNoteSerializer(many=True, read_only=True)
    hr_communications = LeaveHRCommunicationSerializer(many=True, read_only=True)
    audit_logs = LeaveAuditLogSerializer(many=True, read_only=True)
    reapplication_history = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = '__all__'
        read_only_fields = [
            'id', 'status', 'applied_at', 'created_at', 'approved_by', 'approved_at',
            'exceeds_monthly_limit', 'notice_days', 'number_of_days'
        ]

    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else ''

    def get_employee_code(self, obj):
        return obj.employee.employee_id if obj.employee else ''

    def get_staff_uid(self, obj):
        if obj.staff_user and obj.staff_user.staff_uid:
            return obj.staff_user.staff_uid
        return obj.employee.employee_id if obj.employee else ''

    def get_department(self, obj):
        return obj.employee.department if obj.employee else 'General'

    def get_designation(self, obj):
        return obj.employee.designation if obj.employee else 'Staff'

    def get_employee_photo(self, obj):
        if obj.employee and obj.employee.photo:
            try:
                return obj.employee.photo.url
            except Exception:
                return None
        return None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else ''

    def get_approved_by_role(self, obj):
        return getattr(obj.approved_by, 'role', '') if obj.approved_by else ''

    def get_approved_days_this_month(self, obj):
        from hr_module.leave_service import get_approved_leave_days_in_month
        if not obj.employee or not obj.from_date:
            return 0.0
        return float(get_approved_leave_days_in_month(obj.employee, obj.from_date.year, obj.from_date.month))

    def get_reapplication_history(self, obj):
        history = []
        curr = obj.reapplication_of
        while curr:
            history.append({
                'id': str(curr.id),
                'from_date': curr.from_date.isoformat(),
                'to_date': curr.to_date.isoformat(),
                'status': curr.status,
                'rejection_reason': curr.rejection_reason,
                'created_at': curr.created_at.isoformat()
            })
            curr = curr.reapplication_of

        for sub in obj.reapplications.all():
            history.append({
                'id': str(sub.id),
                'from_date': sub.from_date.isoformat(),
                'to_date': sub.to_date.isoformat(),
                'status': sub.status,
                'created_at': sub.created_at.isoformat(),
                'is_subsequent': True
            })
        return history


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
            'verification_status',
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
