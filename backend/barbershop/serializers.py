from rest_framework import serializers
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta

from accounts.models import Employee
from config.common.serializers import SyncableModelSerializer
from customers.models import Customer

from .models import Appointment, Service, ServiceCategory


class ServiceCategorySerializer(SyncableModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=ServiceCategory.objects.all(),
        source="parent",
        allow_null=True,
        required=False,
    )
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    child_count = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "department",
            "parent",
            "parent_id",
            "parent_name",
            "name",
            "description",
            "active",
            "child_count",
            "full_name",
        ]
        read_only_fields = ["parent"]

    def get_child_count(self, obj: ServiceCategory) -> int:
        return obj.children.filter(deleted_at__isnull=True).count()

    def get_full_name(self, obj: ServiceCategory) -> str:
        return str(obj)


class ServiceSerializer(SyncableModelSerializer):
    category_ref_id = serializers.PrimaryKeyRelatedField(
        queryset=ServiceCategory.objects.all(),
        source="category_ref",
        allow_null=True,
        required=False,
    )
    category_ref_name = serializers.CharField(source="category_ref.name", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "department",
            "category",
            "subcategory",
            "category_ref",
            "category_ref_id",
            "category_ref_name",
            "name",
            "duration_minutes",
            "price",
            "active",
            "description",
        ]
        read_only_fields = ["category_ref"]
        extra_kwargs = {
            "category": {"required": False},
            "subcategory": {"required": False, "allow_blank": True},
        }

    def _apply_category_from_ref(self, attrs):
        category_ref = attrs.get("category_ref")
        if not category_ref:
            return attrs

        attrs["department"] = category_ref.department
        if category_ref.parent_id:
            attrs["category"] = category_ref.parent.name
            attrs["subcategory"] = category_ref.name
        else:
            attrs["category"] = category_ref.name
            attrs["subcategory"] = ""
        return attrs

    def validate(self, attrs):
        attrs = self._apply_category_from_ref(attrs)
        department = attrs.get("department") or getattr(self.instance, "department", None)
        category_ref = attrs.get("category_ref") or getattr(self.instance, "category_ref", None)
        category = attrs.get("category") or getattr(self.instance, "category", None)
        if not category:
            raise serializers.ValidationError({"category_ref_id": "Selecione a categoria ou subcategoria do serviço."})
        if category_ref and department and category_ref.department != department:
            raise serializers.ValidationError(
                {"category_ref_id": "A categoria do serviço não corresponde ao departamento selecionado."},
            )
        return attrs


class AppointmentSerializer(SyncableModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), source="customer")
    employee_id = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), source="employee")
    service_id = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), source="service")
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    employee_name = serializers.CharField(source="employee.user.get_full_name", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "department",
            "customer",
            "customer_id",
            "customer_name",
            "employee",
            "employee_id",
            "employee_name",
            "service",
            "service_id",
            "service_name",
            "scheduled_for",
            "status",
            "walk_in",
            "payment_status",
            "price",
            "notes",
        ]
        read_only_fields = ["customer", "employee", "service"]

    def validate(self, attrs):
        department = attrs.get("department") or getattr(self.instance, "department", None)
        service = attrs.get("service") or getattr(self.instance, "service", None)
        if department and service and department != service.department:
            raise serializers.ValidationError("O serviço escolhido não corresponde ao módulo selecionado.")
        employee = attrs.get("employee") or getattr(self.instance, "employee", None)
        scheduled_for = attrs.get("scheduled_for") or getattr(self.instance, "scheduled_for", None)
        target_status = attrs.get("status") or getattr(self.instance, "status", Appointment.Status.SCHEDULED)
        is_active_booking = target_status in [Appointment.Status.SCHEDULED, Appointment.Status.IN_PROGRESS]
        if is_active_booking and scheduled_for and scheduled_for < timezone.now() and not attrs.get("walk_in", getattr(self.instance, "walk_in", False)):
            raise serializers.ValidationError({"scheduled_for": "A marcação não pode ser criada no passado."})
        if is_active_booking and employee and service and scheduled_for:
            end = scheduled_for + timedelta(minutes=service.duration_minutes)
            conflicts = Appointment.objects.filter(
                employee=employee,
                status__in=[Appointment.Status.SCHEDULED, Appointment.Status.IN_PROGRESS],
                scheduled_for__lt=end,
            ).filter(scheduled_for__gte=scheduled_for - timedelta(minutes=service.duration_minutes))
            if self.instance:
                conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists():
                raise serializers.ValidationError({"scheduled_for": "O colaborador já possui uma marcação neste horário."})
        return attrs
