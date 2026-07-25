from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Permission, Role, User

from .models import Product, ProductCategory


class ProductCatalogTests(APITestCase):
    def setUp(self):
        permission = Permission.objects.create(
            module="inventory",
            code="inventory.manage",
            name="Gerir stock",
        )
        role = Role.objects.create(code="inventory-manager", name="Inventory Manager")
        role.permissions.set([permission])
        self.user = User.objects.create_user(
            email="catalog@ocapitao.local",
            password="1122",
            first_name="Catalog",
            role=role,
        )
        self.client.force_authenticate(self.user)

    def test_product_creation_supports_subcategory_and_default_image(self):
        root = ProductCategory.objects.create(
            name="Cortes",
            department=ProductCategory.Department.BARBERSHOP,
        )
        child = ProductCategory.objects.create(
            name="Consumiveis",
            department=ProductCategory.Department.BARBERSHOP,
            parent=root,
        )

        response = self.client.post(
            "/api/products/",
            {
                "category_id": str(child.id),
                "department": Product.Department.BARBERSHOP,
                "item_type": Product.ItemType.CONSUMABLE,
                "name": "Spray finalizador",
                "sku": "BARB-IMG-001",
                "unit": Product.Unit.UNIT,
                "sale_price": "0.00",
                "cost_price": "180.00",
                "stock_quantity": "8.00",
                "low_stock_threshold": "2.00",
                "reorder_quantity": "4.00",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(pk=response.data["id"])
        self.assertEqual(product.image_url, "/branding/placeholders/product-default.svg")
        self.assertEqual(response.data["category_name"], "Cortes")
        self.assertEqual(response.data["subcategory_name"], "Consumiveis")
        self.assertEqual(response.data["category_path"], "Cortes / Consumiveis")

    def test_product_rejects_category_from_other_department(self):
        category = ProductCategory.objects.create(
            name="Lavagens",
            department=ProductCategory.Department.CARWASH,
        )

        response = self.client.post(
            "/api/products/",
            {
                "category_id": str(category.id),
                "department": Product.Department.BARBERSHOP,
                "item_type": Product.ItemType.CONSUMABLE,
                "name": "Shampoo premium",
                "sku": "BARB-ERR-001",
                "unit": Product.Unit.LITER,
                "sale_price": "0.00",
                "cost_price": "400.00",
                "stock_quantity": "5.00",
                "low_stock_threshold": "1.00",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", response.data)
