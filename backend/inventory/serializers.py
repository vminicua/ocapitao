from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from accounts.models import User
from bar.models import Product
from config.common.serializers import SyncableModelSerializer
from settings_app.models import Settings

from .models import StockMovement


class StockMovementSerializer(SyncableModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), source="product")
    created_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="created_by",
        allow_null=True,
        required=False,
    )
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_department = serializers.CharField(source="product.department", read_only=True)
    product_item_type = serializers.CharField(source="product.item_type", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "product",
            "product_id",
            "product_name",
            "product_department",
            "product_item_type",
            "movement_type",
            "reference_type",
            "reference_code",
            "quantity",
            "unit_cost",
            "stock_before",
            "stock_after",
            "notes",
            "created_by",
            "created_by_id",
            "created_by_name",
        ]
        read_only_fields = ["product", "created_by", "stock_before", "stock_after"]

    def _allow_negative_stock(self) -> bool:
        settings = Settings.objects.order_by("created_at").first()
        return bool(settings and settings.allow_negative_stock)

    def get_created_by_name(self, obj: StockMovement) -> str:
        if not obj.created_by:
            return ""
        return obj.created_by.get_full_name().strip() or obj.created_by.username or obj.created_by.email

    def _validate_quantity(self, movement_type: str, quantity: Decimal) -> None:
        if movement_type in {StockMovement.MovementType.ENTRY, StockMovement.MovementType.EXIT} and quantity <= 0:
            raise serializers.ValidationError({"quantity": "Introduza uma quantidade maior que zero."})
        if movement_type == StockMovement.MovementType.ADJUSTMENT and quantity < 0:
            raise serializers.ValidationError({"quantity": "O stock ajustado não pode ser negativo."})

    def _ensure_latest_movement(self, instance: StockMovement) -> None:
        latest_movement = (
            StockMovement.objects.filter(product=instance.product, deleted_at__isnull=True)
            .order_by("-created_at", "-updated_at")
            .first()
        )
        if latest_movement and latest_movement.pk != instance.pk:
            raise serializers.ValidationError(
                "Só é permitido editar ou anular o movimento mais recente deste artigo.",
            )

    def _calculate_stock_after(self, product: Product, movement_type: str, quantity: Decimal, stock_before: Decimal) -> Decimal:
        simulated_movement = StockMovement(
            product=product,
            movement_type=movement_type,
            quantity=quantity,
        )
        stock_after = simulated_movement.calculate_stock_after(stock_before)
        if stock_after < 0 and not self._allow_negative_stock():
            raise serializers.ValidationError(
                {"quantity": "A operação deixaria o stock negativo e isso está desativado nas configurações."},
            )
        return stock_after

    def validate(self, attrs):
        product = attrs.get("product") or getattr(self.instance, "product", None)
        movement_type = attrs.get("movement_type") or getattr(self.instance, "movement_type", None)
        quantity = attrs.get("quantity")
        if quantity is None and self.instance is not None:
            quantity = self.instance.quantity

        if self.instance and "product" in attrs and attrs["product"] != self.instance.product:
            raise serializers.ValidationError({"product_id": "Não é permitido trocar o artigo de um movimento já registado."})

        if product and movement_type and quantity is not None:
            self._validate_quantity(movement_type, quantity)
            stock_before = self.instance.stock_before if self.instance else product.stock_quantity
            self._calculate_stock_after(product, movement_type, quantity, stock_before)
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated and "created_by" not in validated_data:
            validated_data["created_by"] = request.user

        product = validated_data["product"]
        movement_type = validated_data["movement_type"]
        quantity = validated_data["quantity"]

        with transaction.atomic():
            stock_before = product.stock_quantity
            stock_after = self._calculate_stock_after(product, movement_type, quantity, stock_before)
            movement = StockMovement.objects.create(
                **validated_data,
                stock_before=stock_before,
                stock_after=stock_after,
            )
            product.stock_quantity = stock_after
            product.save(update_fields=["stock_quantity", "updated_at"])
        return movement

    def update(self, instance, validated_data):
        self._ensure_latest_movement(instance)

        movement_type = validated_data.get("movement_type", instance.movement_type)
        quantity = validated_data.get("quantity", instance.quantity)

        with transaction.atomic():
            stock_after = self._calculate_stock_after(instance.product, movement_type, quantity, instance.stock_before)
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.stock_after = stock_after
            instance.save()

            product = instance.product
            product.stock_quantity = stock_after
            product.save(update_fields=["stock_quantity", "updated_at"])

        return instance
