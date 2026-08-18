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

    def validate_phone(self, value):
        normalized = "".join(character for character in value if character.isdigit() or character == "+")
        if len(normalized.lstrip("+")) < 8:
            raise serializers.ValidationError("Introduza um número de telefone válido.")
        duplicate = Customer.objects.filter(phone=normalized, deleted_at__isnull=True)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError("Já existe um cliente com este telefone.")
        return normalized

    def validate_email(self, value):
        if not value:
            return value
        duplicate = Customer.objects.filter(email__iexact=value, deleted_at__isnull=True)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError("Já existe um cliente com este email.")
        return value.lower()
