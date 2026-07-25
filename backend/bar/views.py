from django.db.models import F
from rest_framework.permissions import IsAuthenticated

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet

from .models import Product, ProductCategory
from .serializers import ProductCategorySerializer, ProductSerializer


class ProductCategoryViewSet(SoftDeleteModelViewSet):
    queryset = ProductCategory.objects.select_related("parent").all()
    serializer_class = ProductCategorySerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["inventory.view", "inventory.manage"],
        "retrieve": ["inventory.view", "inventory.manage"],
        "create": ["inventory.manage"],
        "update": ["inventory.manage"],
        "partial_update": ["inventory.manage"],
        "destroy": ["inventory.manage"],
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
        return queryset


class ProductViewSet(SoftDeleteModelViewSet):
    queryset = Product.objects.select_related("category", "category__parent").all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {
        "list": ["inventory.view", "inventory.manage"],
        "retrieve": ["inventory.view", "inventory.manage"],
        "create": ["inventory.manage"],
        "update": ["inventory.manage"],
        "partial_update": ["inventory.manage"],
        "destroy": ["inventory.manage"],
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        department = self.request.query_params.get("department")
        if department:
            queryset = queryset.filter(department=department)
        item_type = self.request.query_params.get("item_type")
        if item_type:
            queryset = queryset.filter(item_type=item_type)
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category_id=category)
        active = self.request.query_params.get("active")
        if active in {"true", "false"}:
            queryset = queryset.filter(active=active == "true")
        if self.request.query_params.get("low_stock") == "true":
            queryset = queryset.filter(stock_quantity__lte=F("low_stock_threshold"))
        return queryset

# Create your views here.
