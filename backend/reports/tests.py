from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Permission, Role, User


class AnalyticsTests(APITestCase):
    def setUp(self):
        permission = Permission.objects.create(module="reports", code="reports.view", name="Ver relatórios")
        role = Role.objects.create(code="reports-test", name="Relatórios")
        role.permissions.add(permission)
        self.client.force_authenticate(User.objects.create_user(email="reports@test.local", password="1122", role=role))

    def test_analytics_and_csv_are_available(self):
        response = self.client.get("/api/reports/analytics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("inventory_value", response.data)
        csv_response = self.client.get("/api/reports/analytics/?export=csv")
        self.assertEqual(csv_response.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_response["Content-Type"], "text/csv; charset=utf-8")
