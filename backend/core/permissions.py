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
        return request.user.is_authenticated and request.user.role in [Role.MANAGER, Role.ADMIN]


class IsAccountant(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [Role.ACCOUNTANT, Role.ADMIN]



class IsHR(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [Role.HR, Role.ADMIN]


class IsManagerOrAccountant(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in [Role.MANAGER, Role.ACCOUNTANT, Role.ADMIN]



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

        if request.user.role in [Role.MANAGER, Role.ADMIN]:
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

        if request.user.role in [Role.MANAGER, Role.ADMIN, Role.HR]:
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

