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
