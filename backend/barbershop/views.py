from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Appointment, Service, ServiceCategory
from .serializers import AppointmentSerializer, ServiceCategorySerializer, ServiceSerializer


class ServiceCategoryViewSet(SoftDeleteModelViewSet):
    queryset = ServiceCategory.objects.select_related("parent").all()
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": [
            "barbershop.view",
            "barbershop.manage",
            "carwash.view",
            "carwash.manage",
            "pos.view",
            "pos.manage",
            "settings.view",
            "settings.manage",
        ],
        "retrieve": [
            "barbershop.view",
            "barbershop.manage",
            "carwash.view",
            "carwash.manage",
            "pos.view",
            "pos.manage",
            "settings.view",
            "settings.manage",
        ],
        "create": ["settings.manage"],
        "update": ["settings.manage"],
        "partial_update": ["settings.manage"],
        "destroy": ["settings.manage"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get("department")
        if department:
            queryset = queryset.filter(department=department)
        parent = self.request.query_params.get("parent")
        if parent == "root":
            queryset = queryset.filter(parent__isnull=True)
        elif parent:
            queryset = queryset.filter(parent_id=parent)
        active = self.request.query_params.get("active")
        if active in {"true", "false"}:
            queryset = queryset.filter(active=active == "true")
        return queryset


class ServiceViewSet(SoftDeleteModelViewSet):
    queryset = Service.objects.select_related("category_ref", "category_ref__parent").all()
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": [
            "barbershop.view",
            "barbershop.manage",
            "carwash.view",
            "carwash.manage",
            "pos.view",
            "pos.manage",
            "settings.view",
            "settings.manage",
        ],
        "retrieve": [
            "barbershop.view",
            "barbershop.manage",
            "carwash.view",
            "carwash.manage",
            "pos.view",
            "pos.manage",
            "settings.view",
            "settings.manage",
        ],
        "create": ["settings.manage"],
        "update": ["settings.manage"],
        "partial_update": ["settings.manage"],
        "destroy": ["settings.manage"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get("department")
        if department:
            queryset = queryset.filter(department=department)
        category_ref = self.request.query_params.get("category_ref")
        if category_ref:
            queryset = queryset.filter(category_ref_id=category_ref)
        active = self.request.query_params.get("active")
        if active in {"true", "false"}:
            queryset = queryset.filter(active=active == "true")
        return queryset


class AppointmentViewSet(SoftDeleteModelViewSet):
    queryset = Appointment.objects.select_related("customer", "employee__user", "service").all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_roles = {
        "list": ["admin", "manager", "barber", "cashier", "washer"],
        "retrieve": ["admin", "manager", "barber", "cashier", "washer"],
        "create": ["admin", "manager", "barber", "cashier", "washer"],
        "update": ["admin", "manager", "barber", "cashier", "washer"],
        "partial_update": ["admin", "manager", "barber", "cashier", "washer"],
        "destroy": ["admin", "manager"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get("department")
        if department:
            queryset = queryset.filter(department=department)
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status)
        return queryset

# Create your views here.
