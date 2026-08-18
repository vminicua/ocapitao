from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from accounts.models import Employee, User
from bar.models import Product
from barbershop.models import Appointment, Service
from carwash.models import Vehicle
from config.common.serializers import SyncableModelSerializer
from customers.models import Customer
from inventory.models import StockMovement
from settings_app.models import Settings

from .models import CashMovement, CashSession, OperationalSession, Payment, Sale, SaleItem


PAYMENT_METHOD_ALIASES = {
    "Dinheiro": Payment.Method.CASH,
    "Cartão": Payment.Method.CARD,
    "M-Pesa": Payment.Method.MPESA,
    "Transferência": Payment.Method.TRANSFER,
    "Outro": Payment.Method.OTHER,
}


class OperationalSessionSerializer(SyncableModelSerializer):
    class Meta:
        model = OperationalSession
        fields = "__all__"
        read_only_fields = ["created_by"]

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


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
    customer_name = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()

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
            "label",
            "customer_name",
            "subtotal",
            "discount_amount",
            "total_amount",
            "amount_paid",
            "balance_due",
            "payment_status",
            "status",
            "notes",
            "items",
            "payments",
        ]
        read_only_fields = ["session", "customer", "vehicle", "appointment", "seller"]

    def get_customer_name(self, obj):
        return obj.customer.full_name if obj.customer else obj.customer_name

    def get_items(self, obj):
        return [
            {
                "id": str(item.id),
                "product_id": str(item.product_id) if item.product_id else None,
                "service_id": str(item.service_id) if item.service_id else None,
                "description": item.description,
                "item_type": item.item_type,
                "quantity": str(item.quantity),
                "unit_price": str(item.unit_price),
                "total_price": str(item.total_price),
            }
            for item in obj.items.filter(deleted_at__isnull=True)
        ]

    def get_payments(self, obj):
        return [
            {
                "id": str(payment.id),
                "method": payment.method,
                "amount": str(payment.amount),
                "paid_at": payment.paid_at,
                "reference": payment.reference,
            }
            for payment in obj.payments.filter(deleted_at__isnull=True)
        ]


class CompleteSaleItemSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=False)
    service_id = serializers.UUIDField(required=False)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))

    def validate(self, attrs):
        if bool(attrs.get("product_id")) == bool(attrs.get("service_id")):
            raise serializers.ValidationError("Cada item deve indicar exatamente um produto ou serviço.")
        return attrs


class CompleteSaleSerializer(serializers.Serializer):
    department = serializers.ChoiceField(choices=Sale.Department.choices)
    label = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), default=0)
    payment_method = serializers.CharField(max_length=30)
    payment_reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    operational_session_id = serializers.UUIDField(required=False, allow_null=True)
    items = CompleteSaleItemSerializer(many=True, allow_empty=False)

    def validate_payment_method(self, value):
        if value == "Crédito":
            return value
        if value not in PAYMENT_METHOD_ALIASES and value not in Payment.Method.values:
            raise serializers.ValidationError("Método de pagamento inválido.")
        return value

    def _allow_negative_stock(self):
        config = Settings.objects.order_by("created_at").first()
        return bool(config and config.allow_negative_stock)

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        item_payloads = validated_data.pop("items")
        customer_id = validated_data.pop("customer_id", None)
        operational_session_id = validated_data.pop("operational_session_id", None)
        payment_method = validated_data.pop("payment_method")
        payment_reference = validated_data.pop("payment_reference", "")
        discount = validated_data.pop("discount_amount", Decimal("0"))

        cash_session = CashSession.objects.select_for_update().filter(
            status=CashSession.Status.OPEN,
            deleted_at__isnull=True,
        ).first()
        if not cash_session:
            raise serializers.ValidationError({"cash_session": "Abra o caixa antes de concluir uma venda."})

        customer = Customer.objects.filter(pk=customer_id, deleted_at__isnull=True).first() if customer_id else None
        seller = getattr(request.user, "employee_profile", None)
        sale = Sale.objects.create(
            session=cash_session,
            customer=customer,
            seller=seller,
            discount_amount=discount,
            status=Sale.Status.DRAFT,
            **validated_data,
        )

        subtotal = Decimal("0")
        allow_negative = self._allow_negative_stock()
        for payload in item_payloads:
            quantity = payload["quantity"]
            product_id = payload.get("product_id")
            service_id = payload.get("service_id")
            if product_id:
                product = Product.objects.select_for_update().filter(pk=product_id, active=True, deleted_at__isnull=True).first()
                if not product or product.item_type != Product.ItemType.RESALE:
                    raise serializers.ValidationError({"items": "Produto indisponível para venda."})
                stock_after = product.stock_quantity - quantity
                if stock_after < 0 and not allow_negative:
                    raise serializers.ValidationError({"items": f"Stock insuficiente para {product.name}."})
                SaleItem.objects.create(
                    sale=sale,
                    item_type=SaleItem.ItemType.PRODUCT,
                    product=product,
                    description=product.name,
                    quantity=quantity,
                    unit_price=product.sale_price,
                )
                StockMovement.objects.create(
                    product=product,
                    movement_type=StockMovement.MovementType.EXIT,
                    reference_type=StockMovement.ReferenceType.SALE,
                    reference_code=str(sale.id),
                    quantity=quantity,
                    stock_before=product.stock_quantity,
                    stock_after=stock_after,
                    created_by=request.user,
                )
                product.stock_quantity = stock_after
                product.save(update_fields=["stock_quantity", "updated_at"])
                subtotal += product.sale_price * quantity
            else:
                service = Service.objects.filter(pk=service_id, active=True, deleted_at__isnull=True).first()
                if not service:
                    raise serializers.ValidationError({"items": "Serviço indisponível."})
                SaleItem.objects.create(
                    sale=sale,
                    item_type=SaleItem.ItemType.SERVICE,
                    service=service,
                    description=service.name,
                    quantity=quantity,
                    unit_price=service.price,
                )
                subtotal += service.price * quantity

        if discount > subtotal:
            raise serializers.ValidationError({"discount_amount": "O desconto não pode superar o subtotal."})

        total = subtotal - discount
        is_credit = payment_method == "Crédito"
        paid = Decimal("0") if is_credit else total
        sale.subtotal = subtotal
        sale.total_amount = total
        sale.amount_paid = paid
        sale.balance_due = total - paid
        sale.payment_status = Sale.PaymentStatus.PENDING if is_credit else Sale.PaymentStatus.PAID
        sale.status = Sale.Status.COMPLETED
        sale.save(update_fields=[
            "subtotal", "total_amount", "amount_paid", "balance_due", "payment_status", "status", "updated_at",
        ])

        if not is_credit:
            method = PAYMENT_METHOD_ALIASES.get(payment_method, payment_method)
            Payment.objects.create(
                sale=sale,
                method=method,
                amount=total,
                paid_at=timezone.now(),
                reference=payment_reference,
            )

        if operational_session_id:
            OperationalSession.objects.filter(pk=operational_session_id).update(
                status=OperationalSession.Status.COMPLETED,
                updated_at=timezone.now(),
            )
        return sale


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
