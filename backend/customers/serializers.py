from rest_framework import serializers

from accounts.models import Employee
from config.common.serializers import SyncableModelSerializer

from .models import Customer


class CustomerSerializer(SyncableModelSerializer):
    preferred_barber_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="preferred_barber",
        write_only=True,
        allow_null=True,
        required=False,
    )
    preferred_barber_name = serializers.CharField(source="preferred_barber.user.get_full_name", read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "full_name",
            "phone",
            "email",
            "address",
            "birth_date",
            "preferred_barber",
            "preferred_barber_id",
            "preferred_barber_name",
            "loyalty_points",
            "notes",
            "active",
        ]
        read_only_fields = ["preferred_barber"]
