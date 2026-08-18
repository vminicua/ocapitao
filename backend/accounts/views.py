from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Employee, Permission, Role, User
from .serializers import (
    ChangePinSerializer,
    EmployeeSerializer,
    LoginUserSerializer,
    PermissionSerializer,
    PinTokenObtainPairSerializer,
    RoleSerializer,
    UserSerializer,
)
from .throttles import LoginRateThrottle


class PermissionViewSet(SoftDeleteModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["users.view", "users.manage", "settings.view", "settings.manage"],
        "retrieve": ["users.view", "users.manage", "settings.view", "settings.manage"],
        "create": ["users.manage", "settings.manage"],
        "update": ["users.manage", "settings.manage"],
        "partial_update": ["users.manage", "settings.manage"],
        "destroy": ["users.manage", "settings.manage"],
    }


class RoleViewSet(SoftDeleteModelViewSet):
    queryset = Role.objects.prefetch_related("permissions").all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["users.view", "users.manage", "settings.view", "settings.manage"],
        "retrieve": ["users.view", "users.manage", "settings.view", "settings.manage"],
        "create": ["users.manage", "settings.manage"],
        "update": ["users.manage", "settings.manage"],
        "partial_update": ["users.manage", "settings.manage"],
        "destroy": ["users.manage", "settings.manage"],
    }


class UserViewSet(viewsets.ModelViewSet):
    queryset = (
        User.objects.select_related("role", "employee_profile")
        .prefetch_related("role__permissions")
        .order_by("first_name", "last_name", "email")
    )
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["users.view", "users.manage"],
        "retrieve": ["users.view", "users.manage"],
        "create": ["users.manage"],
        "update": ["users.manage"],
        "partial_update": ["users.manage"],
        "destroy": ["users.manage"],
    }

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.is_online = False
        instance.save(update_fields=["is_active", "is_online", "updated_at"])
        employee = getattr(instance, "employee_profile", None)
        if employee:
            employee.is_active_employee = False
            employee.save(update_fields=["is_active_employee", "updated_at"])


class PinTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = PinTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class ChangePinView(generics.GenericAPIView):
    serializer_class = ChangePinSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"ok": True, "message": "PIN alterado. Inicie sessão novamente."})


class LoginUserListView(generics.ListAPIView):
    serializer_class = LoginUserSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return (
            User.objects.filter(is_active=True)
            .select_related("role")
            .order_by("first_name", "last_name", "username", "email")
        )


class EmployeeViewSet(SoftDeleteModelViewSet):
    queryset = Employee.objects.select_related("user").all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["users.view", "users.manage", "barbershop.view", "barbershop.manage", "bar.view", "bar.manage", "carwash.view", "carwash.manage"],
        "retrieve": ["users.view", "users.manage", "barbershop.view", "barbershop.manage", "bar.view", "bar.manage", "carwash.view", "carwash.manage"],
        "create": ["users.manage"],
        "update": ["users.manage"],
        "partial_update": ["users.manage"],
        "destroy": ["users.manage"],
    }


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

# Create your views here.
