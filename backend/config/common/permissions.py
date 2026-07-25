from rest_framework.permissions import BasePermission


class RoleBasedPermission(BasePermission):
    message = "O seu perfil não tem permissão para executar esta ação."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        allowed_permissions = getattr(view, "allowed_permissions", None)
        if allowed_permissions:
            action = getattr(view, "action", request.method.lower())
            permission_codes = (
                allowed_permissions.get(action)
                or allowed_permissions.get(request.method.lower())
                or allowed_permissions.get("*")
            )

            if permission_codes is None:
                return True

            if isinstance(permission_codes, str):
                permission_codes = [permission_codes]

            role = getattr(user, "role", None)
            if not role:
                return False

            role_permission_codes = set(role.permissions.values_list("code", flat=True))
            return any(code in role_permission_codes for code in permission_codes)

        allowed_roles = getattr(view, "allowed_roles", None)
        if not allowed_roles:
            return True

        action = getattr(view, "action", request.method.lower())
        roles = (
            allowed_roles.get(action)
            or allowed_roles.get(request.method.lower())
            or allowed_roles.get("*")
        )
        if roles is None:
            return True

        role = getattr(user, "role", None)
        return bool(role and role.code in roles)
