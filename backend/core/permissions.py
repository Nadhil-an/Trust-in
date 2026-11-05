"""
Role-based permission classes for DRF views.
Usage:  permission_classes = [IsAuthenticated, IsManager]
"""
from rest_framework.permissions import BasePermission
from core.models import Role


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.ADMIN


class IsManager(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in [Role.MANAGER, Role.ADMIN]:
            return True
        from core.models import RoleFeaturePermission
        manager_features = [
            'assessment_requests', 'charity_inventory', 'minutes_registry', 'volunteers', 'partners_entry'
        ]
        return RoleFeaturePermission.objects.filter(
            role=request.user.role,
            feature_key__in=manager_features
        ).exists()


class IsAccountant(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in [Role.ACCOUNTANT, Role.ADMIN, Role.HR]:
            return True
        from core.models import RoleFeaturePermission
        finance_features = [
            'payouts', 'pending_payouts', 'scheduled_payouts',
            'salary_review', 'money_requests', 'cash_closing',
            'donations_view', 'cash_book', 'bank_ledger',
            'income_view', 'expenses_view', 'cheques', 'transfers', 'transactions'
        ]
        return RoleFeaturePermission.objects.filter(
            role=request.user.role,
            feature_key__in=finance_features
        ).exists()


class IsFinanceOrDataEntry(BasePermission):
    """Allows Accountant, Manager, Admin, Data Entry, and HR (or any staff with finance/entry feature enabled)."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in [
            Role.ACCOUNTANT, Role.MANAGER, Role.ADMIN, Role.DATA_ENTRY, Role.HR
        ]:
            return True
        from core.models import RoleFeaturePermission
        entry_features = [
            'donation_entry', 'donation_registry', 'purchase_entry',
            'promoters_verification', 'promoters_registry',
            'membership_entry', 'partners_entry', 'events_entry',
            'inward_entry', 'material_outward', 'assets_in_stock'
        ]
        return RoleFeaturePermission.objects.filter(
            role=request.user.role,
            feature_key__in=entry_features
        ).exists()



class IsHR(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in [Role.HR, Role.ADMIN])


class IsManagerOrHR(BasePermission):
    """Allows Manager, HR, and Admin (or any user with Manager or HR feature enabled)."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in [Role.MANAGER, Role.HR, Role.ADMIN]:
            return True
        from core.models import RoleFeaturePermission
        combined_features = [
            'assessment_requests', 'charity_inventory', 'minutes_registry', 'volunteers', 'partners_entry',
            'hr_attendance', 'hr_leave', 'hr_payroll', 'hr_payment_advances',
            'hr_members', 'hr_volunteers', 'hr_exec_members', 'hr_officers',
            'hr_complaints', 'hr_staff_reports', 'hr_performance'
        ]
        return RoleFeaturePermission.objects.filter(
            role=request.user.role,
            feature_key__in=combined_features
        ).exists()


class IsManagerOrAccountant(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in [Role.MANAGER, Role.ACCOUNTANT, Role.ADMIN]:
            return True
        from core.models import RoleFeaturePermission
        mgr_acc_features = [
            'assessment_requests', 'charity_inventory', 'minutes_registry', 'volunteers', 'partners_entry',
            'payouts', 'pending_payouts', 'scheduled_payouts',
            'salary_review', 'money_requests', 'cash_closing',
            'donations_view', 'cash_book', 'bank_ledger',
            'income_view', 'expenses_view', 'cheques', 'transfers', 'transactions'
        ]
        return RoleFeaturePermission.objects.filter(
            role=request.user.role,
            feature_key__in=mgr_acc_features
        ).exists()



class IsAnyStaff(BasePermission):
    """Any authenticated user."""
    def has_permission(self, request, view):
        return request.user.is_authenticated

class IsOwnerOrManager(BasePermission):
    """
    Object-level permission to only allow owners of an object to edit it,
    unless they are a Manager/Admin.
    Assumes the model instance has an attribute named `created_by` or `requested_by`.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        if request.user.role in [Role.MANAGER, Role.ADMIN, Role.DATA_ENTRY, Role.ACCOUNTANT]:
            return True

        owner = getattr(obj, 'created_by', None)
        if not owner:
            owner = getattr(obj, 'requested_by', None)
            
        return owner == request.user


class IsOwnerOrManagerOrHR(BasePermission):
    """
    Object-level permission to only allow owners of an object to edit it,
    unless they are a Manager/Admin or HR.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        if request.user.role in [Role.MANAGER, Role.ADMIN, Role.HR, Role.DATA_ENTRY, Role.ACCOUNTANT]:
            return True

        owner = getattr(obj, 'created_by', None)
        if not owner:
            owner = getattr(obj, 'requested_by', None)
            
        return owner == request.user


# ── Mobile Role Permissions ───────────────────────────────────────

class IsFAO(BasePermission):
    """Field Assessment Officer permission."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            Role.FIELD_ASSESSMENT_OFFICER, Role.ADMIN, Role.MANAGER
        ]


class IsACO(BasePermission):
    """Assessment Calculation Officer permission."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            Role.ASSESSMENT_CALCULATION_OFFICER, Role.ADMIN, Role.MANAGER
        ]


class IsGEO(BasePermission):
    """General Enquiry Officer permission."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            Role.GENERAL_ENQUIRY_OFFICER, Role.ADMIN, Role.MANAGER
        ]


class IsMobileStaff(BasePermission):
    """Staff or Member who can submit assessments."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            Role.STAFF, Role.MEMBER, Role.ADMIN, Role.MANAGER
        ]


class IsMobileUser(BasePermission):
    """Any mobile app user (FAO, ACO, GEO, STAFF, MEMBER)."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [
            Role.FIELD_ASSESSMENT_OFFICER,
            Role.ASSESSMENT_CALCULATION_OFFICER,
            Role.GENERAL_ENQUIRY_OFFICER,
            Role.STAFF,
            Role.MEMBER,
            Role.ADMIN,
            Role.MANAGER,
        ]

