from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import User


class IsAdminRole(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == User.Role.ADMIN)


class IsAdminOrReadOnly(BasePermission):
    """Any logged-in user may read; only admins may create/update/delete."""

    message = "Only admins can modify this resource."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role == User.Role.ADMIN