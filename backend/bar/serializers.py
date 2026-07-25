from rest_framework import serializers

from config.common.serializers import SyncableModelSerializer

from .models import Product, ProductCategory


class ProductCategorySerializer(SyncableModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=ProductCategory.objects.all(),
        source="parent",
        allow_null=True,
        required=False,
    )
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    child_count = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
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

    def get_child_count(self, obj: ProductCategory) -> int:
        return obj.children.filter(deleted_at__isnull=True).count()

    def get_full_name(self, obj: ProductCategory) -> str:
        return str(obj)


class ProductSerializer(SyncableModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(queryset=ProductCategory.objects.all(), source="category")
    category_name = serializers.SerializerMethodField()
    subcategory_name = serializers.SerializerMethodField()
    category_path = serializers.SerializerMethodField()
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "category",
            "category_id",
            "category_name",
            "subcategory_name",
            "category_path",
            "department",
            "item_type",
            "name",
            "sku",
            "barcode",
            "unit",
            "sale_price",
            "cost_price",
            "stock_quantity",
            "low_stock_threshold",
            "reorder_quantity",
            "supplier_name",
            "storage_location",
            "image_url",
            "notes",
            "active",
            "low_stock",
        ]
        read_only_fields = ["category"]

    def get_category_name(self, obj: Product) -> str:
        if obj.category.parent_id:
            return obj.category.parent.name
        return obj.category.name

    def get_subcategory_name(self, obj: Product) -> str:
        if obj.category.parent_id:
            return obj.category.name
        return ""

    def get_category_path(self, obj: Product) -> str:
        if obj.category.parent_id:
            return f"{obj.category.parent.name} / {obj.category.name}"
        return obj.category.name

    def get_low_stock(self, obj) -> bool:
        return obj.stock_quantity <= obj.low_stock_threshold

    def validate(self, attrs):
        category = attrs.get("category") or getattr(self.instance, "category", None)
        department = attrs.get("department") or getattr(self.instance, "department", None)
        if category and department and category.department not in {department, Product.Department.SHARED}:
            raise serializers.ValidationError(
                {"category_id": "A categoria escolhida não pertence à área selecionada."},
            )
        return attrs
