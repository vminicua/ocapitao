from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from accounts.models import Employee, User
from bar.models import Product
from barbershop.models import Appointment, Service
from carwash.models import Vehicle
from config.common.serializers import SyncableModelSerializer
from customers.models import Customer

from .models import CashMovement, CashSession, Payment, Sale, SaleItem


class CashSessionSerializer(SyncableModelSerializer):
    opened_by_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source="opened_by")
    closed_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="closed_by",
        allow_null=True,
        required=False,
    )
    opened_by_name = serializers.CharField(source="opened_by.get_full_name", read_only=True)

    class Meta:
        model = CashSession
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "opened_by",
            "opened_by_id",
            "opened_by_name",
            "closed_by",
            "closed_by_id",
            "opened_at",
            "closed_at",
            "opening_amount",
            "closing_amount",
            "expected_amount",
            "status",
            "notes",
        ]
        read_only_fields = ["opened_by", "closed_by"]


class CashMovementSerializer(SyncableModelSerializer):
    session_id = serializers.PrimaryKeyRelatedField(queryset=CashSession.objects.all(), source="session")
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="created_by",
        allow_null=True,
        required=False,
    )

    class Meta:
        model = CashMovement
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "session",
            "session_id",
            "movement_type",
            "amount",
            "notes",
            "created_by",
            "created_by_id",
        ]
        read_only_fields = ["session", "created_by"]


class SaleSerializer(SyncableModelSerializer):
    session_id = serializers.PrimaryKeyRelatedField(
        queryset=CashSession.objects.all(),
        source="session",
        allow_null=True,
        required=False,
    )
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        source="customer",
        allow_null=True,
        required=False,
    )
    vehicle_id = serializers.PrimaryKeyRelatedField(
        queryset=Vehicle.objects.all(),
        source="vehicle",
        allow_null=True,
        required=False,
    )
    appointment_id = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(),
        source="appointment",
        allow_null=True,
        required=False,
    )
    seller_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        source="seller",
        allow_null=True,
        required=False,
    )
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "session",
            "session_id",
            "customer",
            "customer_id",
            "customer_name",
            "vehicle",
            "vehicle_id",
            "appointment",
            "appointment_id",
            "seller",
            "seller_id",
            "department",
            "subtotal",
            "discount_amount",
            "total_amount",
            "status",
            "notes",
        ]
        read_only_fields = ["session", "customer", "vehicle", "appointment", "seller"]


class SaleItemSerializer(SyncableModelSerializer):
    sale_id = serializers.PrimaryKeyRelatedField(queryset=Sale.objects.all(), source="sale")
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source="product",
        allow_null=True,
        required=False,
    )
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        source="service",
        allow_null=True,
        required=False,
    )

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "sale",
            "sale_id",
            "item_type",
            "product",
            "product_id",
            "service",
            "service_id",
            "description",
            "quantity",
            "unit_price",
            "total_price",
        ]
        read_only_fields = ["sale", "product", "service", "total_price"]

    def create(self, validated_data):
        item = super().create(validated_data)
        self._recalculate_sale(item.sale)
        return item

    def update(self, instance, validated_data):
        item = super().update(instance, validated_data)
        self._recalculate_sale(item.sale)
        return item

    def _recalculate_sale(self, sale: Sale):
        sale.recalculate_totals()
        sale.save(update_fields=["subtotal", "total_amount", "updated_at"])


class PaymentSerializer(SyncableModelSerializer):
    sale_id = serializers.PrimaryKeyRelatedField(queryset=Sale.objects.all(), source="sale")
    remaining_balance = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "sale",
            "sale_id",
            "method",
            "amount",
            "paid_at",
            "reference",
            "notes",
            "remaining_balance",
        ]
        read_only_fields = ["sale", "remaining_balance"]

    def get_remaining_balance(self, obj):
        paid = obj.sale.payments.exclude(pk=obj.pk).aggregate(total=Sum("amount"))["total"] or Decimal("0")
        return str(max(Decimal("0"), obj.sale.total_amount - (paid + obj.amount)))
