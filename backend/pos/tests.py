from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Employee, Permission, Role, User
from bar.models import Product, ProductCategory
from inventory.models import StockMovement

from .models import CashSession, Commission, OperationalSession, Payment, Sale


class CompleteSaleTests(APITestCase):
    def setUp(self):
        permission = Permission.objects.create(module="pos", code="pos.manage", name="Gerir POS")
        role = Role.objects.create(code="cashier-test", name="Cashier Test")
        role.permissions.add(permission)
        self.user = User.objects.create_user(email="cashier@test.local", password="1122", role=role)
        self.client.force_authenticate(self.user)
        category = ProductCategory.objects.create(name="Bebidas", department=ProductCategory.Department.BAR)
        self.product = Product.objects.create(
            category=category,
            department=Product.Department.BAR,
            item_type=Product.ItemType.RESALE,
            name="Água",
            sku="POS-WATER-001",
            unit=Product.Unit.BOTTLE,
            sale_price=Decimal("75.00"),
            cost_price=Decimal("40.00"),
            stock_quantity=Decimal("10.00"),
            low_stock_threshold=Decimal("2.00"),
        )

    def open_cash(self, opening_amount="1000.00"):
        response = self.client.post("/api/cash-sessions/open/", {"opening_amount": opening_amount}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def sale_payload(self, method="Dinheiro", quantity="2.00"):
        return {
            "department": "bar",
            "label": "Mesa 1",
            "discount_amount": "10.00",
            "payment_method": method,
            "items": [{"product_id": str(self.product.id), "quantity": quantity}],
        }

    def test_complete_paid_sale_is_atomic_and_decrements_stock(self):
        self.open_cash()
        response = self.client.post("/api/sales/complete/", self.sale_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(pk=response.data["id"])
        self.product.refresh_from_db()
        self.assertEqual(sale.subtotal, Decimal("150.00"))
        self.assertEqual(sale.total_amount, Decimal("140.00"))
        self.assertEqual(sale.amount_paid, Decimal("140.00"))
        self.assertEqual(sale.balance_due, Decimal("0.00"))
        self.assertEqual(sale.payment_status, Sale.PaymentStatus.PAID)
        self.assertEqual(self.product.stock_quantity, Decimal("8.00"))
        self.assertEqual(Payment.objects.get(sale=sale).amount, Decimal("140.00"))
        movement = StockMovement.objects.get(reference_code=str(sale.id))
        self.assertEqual(movement.stock_before, Decimal("10.00"))
        self.assertEqual(movement.stock_after, Decimal("8.00"))

    def test_credit_sale_creates_real_balance_without_payment(self):
        self.open_cash()
        response = self.client.post("/api/sales/complete/", self.sale_payload(method="Crédito"), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(pk=response.data["id"])
        self.assertEqual(sale.amount_paid, Decimal("0.00"))
        self.assertEqual(sale.balance_due, Decimal("140.00"))
        self.assertEqual(sale.payment_status, Sale.PaymentStatus.PENDING)
        self.assertFalse(Payment.objects.filter(sale=sale).exists())

    def test_sale_without_open_cash_is_rejected_without_side_effects(self):
        response = self.client.post("/api/sales/complete/", self.sale_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
        self.assertFalse(Sale.objects.exists())
        self.assertFalse(StockMovement.objects.exists())

    def test_insufficient_stock_rolls_back_sale_and_movement(self):
        self.open_cash()
        response = self.client.post("/api/sales/complete/", self.sale_payload(quantity="20.00"), format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
        self.assertFalse(Sale.objects.exists())
        self.assertFalse(StockMovement.objects.exists())

    def test_cash_close_calculates_expected_cash(self):
        opened = self.open_cash("1000.00")
        self.client.post("/api/sales/complete/", self.sale_payload(), format="json")
        response = self.client.post(
            f"/api/cash-sessions/{opened.data['id']}/close/",
            {"closing_amount": "1140.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session = CashSession.objects.get(pk=opened.data["id"])
        self.assertEqual(session.expected_amount, Decimal("1140.00"))
        self.assertEqual(session.closing_amount, Decimal("1140.00"))
        self.assertEqual(session.status, CashSession.Status.CLOSED)

    def test_receive_credit_payment_persists_payment_and_clears_balance(self):
        self.open_cash()
        created = self.client.post("/api/sales/complete/", self.sale_payload(method="Crédito"), format="json")
        response = self.client.post(
            f"/api/sales/{created.data['id']}/receive-payment/", {"method": "mpesa"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        sale = Sale.objects.get(pk=created.data["id"])
        self.assertEqual(sale.balance_due, Decimal("0.00"))
        self.assertEqual(sale.amount_paid, Decimal("140.00"))
        self.assertEqual(sale.payment_status, Sale.PaymentStatus.PAID)
        self.assertEqual(Payment.objects.get(sale=sale).method, Payment.Method.MPESA)

    def test_cancel_sale_restores_stock_once(self):
        self.open_cash()
        created = self.client.post("/api/sales/complete/", self.sale_payload(), format="json")
        endpoint = f"/api/sales/{created.data['id']}/cancel/"

        response = self.client.post(endpoint, {}, format="json")
        second_response = self.client.post(endpoint, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("10.00"))
        self.assertEqual(StockMovement.objects.filter(reference_code=created.data["id"]).count(), 2)

    def test_operational_session_snapshot_persists_and_closes_missing_sessions(self):
        first = self.client.post(
            "/api/operational-sessions/snapshot/",
            {
                "department": "bar",
                "sessions": [{
                    "label": "Mesa 1", "client_name": "Ana", "items": [],
                    "discount_amount": "0.00", "status": "open",
                }],
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        session_id = first.data[0]["id"]

        listed = self.client.get("/api/operational-sessions/?department=bar&status=open")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(listed.data["results"][0]["client_name"], "Ana")

        cleared = self.client.post(
            "/api/operational-sessions/snapshot/", {"department": "bar", "sessions": []}, format="json"
        )
        self.assertEqual(cleared.status_code, status.HTTP_200_OK)
        self.assertEqual(OperationalSession.objects.get(pk=session_id).status, OperationalSession.Status.CANCELLED)

    def test_sale_generates_and_cancellation_reverses_commission(self):
        employee = Employee.objects.create(
            user=self.user, department=Employee.Department.BAR, commission_rate=Decimal("10.00")
        )
        self.open_cash()
        payload = self.sale_payload()
        payload["responsible_employee_id"] = str(employee.id)
        created = self.client.post("/api/sales/complete/", payload, format="json")
        commission = Commission.objects.get(sale_id=created.data["id"])
        self.assertEqual(commission.amount, Decimal("14.00"))

        self.client.post(f"/api/sales/{created.data['id']}/cancel/", {}, format="json")
        commission.refresh_from_db()
        self.assertEqual(commission.status, Commission.Status.REVERSED)
