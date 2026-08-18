from rest_framework import serializers

from config.common.serializers import SyncableModelSerializer
from customers.models import Customer

from .models import Vehicle


class VehicleSerializer(SyncableModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), source="customer")
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "customer",
            "customer_id",
            "customer_name",
            "registration_number",
            "brand",
            "model",
            "color",
            "notes",
        ]
        read_only_fields = ["customer"]

    def validate_registration_number(self, value):
        normalized = value.strip().upper().replace(" ", "")
        if normalized:
            duplicate = Vehicle.objects.filter(registration_number__iexact=normalized, deleted_at__isnull=True)
            if self.instance:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError("Já existe uma viatura com esta matrícula.")
        return normalized
