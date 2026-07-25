from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Permission, Role, User
from bar.models import Product, ProductCategory
from settings_app.models import Settings

from .models import StockMovement


class StockMovementFlowTests(APITestCase):
    def setUp(self):
        permission = Permission.objects.create(
            module="inventory",
            code="inventory.manage",
            name="Gerir stock",
        )
        role = Role.objects.create(code="stock-manager", name="Stock Manager")
        role.permissions.set([permission])

        self.user = User.objects.create_user(
            email="stock@ocapitao.local",
            password="1122",
            first_name="Stock",
            role=role,
        )
        self.client.force_authenticate(self.user)

        Settings.objects.create(
            business_name="O Capitão",
            allow_negative_stock=False,
        )

        category = ProductCategory.objects.create(name="Barbershop")
        self.product = Product.objects.create(
            category=category,
            department=Product.Department.BARBERSHOP,
            item_type=Product.ItemType.CONSUMABLE,
            unit=Product.Unit.UNIT,
            name="Lâmina",
            sku="BARB-TEST-001",
            sale_price=Decimal("0.00"),
            cost_price=Decimal("20.00"),
            stock_quantity=Decimal("10.00"),
            low_stock_threshold=Decimal("2.00"),
        )

    def test_create_update_and_delete_latest_movement_keeps_stock_consistent(self):
        create_response = self.client.post(
            "/api/stock-movements/",
            {
                "product_id": str(self.product.id),
                "movement_type": StockMovement.MovementType.ENTRY,
                "reference_type": StockMovement.ReferenceType.PURCHASE,
                "reference_code": "PO-100",
                "quantity": "5.00",
                "unit_cost": "18.00",
                "notes": "Reposição inicial",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.product.refresh_from_db()
        movement = StockMovement.objects.get(pk=create_response.data["id"])
        self.assertEqual(self.product.stock_quantity, Decimal("15.00"))
        self.assertEqual(movement.stock_before, Decimal("10.00"))
        self.assertEqual(movement.stock_after, Decimal("15.00"))

        update_response = self.client.patch(
            f"/api/stock-movements/{movement.id}/",
            {
                "quantity": "4.00",
                "notes": "Reposição corrigida",
            },
            format="json",
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        movement.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("14.00"))
        self.assertEqual(movement.stock_before, Decimal("10.00"))
        self.assertEqual(movement.stock_after, Decimal("14.00"))

        delete_response = self.client.delete(f"/api/stock-movements/{movement.id}/")

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.product.refresh_from_db()
        movement.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
        self.assertIsNotNone(movement.deleted_at)

    def test_exit_that_would_make_stock_negative_is_blocked(self):
        response = self.client.post(
            "/api/stock-movements/",
            {
                "product_id": str(self.product.id),
                "movement_type": StockMovement.MovementType.EXIT,
                "reference_type": StockMovement.ReferenceType.INTERNAL_USE,
                "quantity": "12.00",
                "unit_cost": "0.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
