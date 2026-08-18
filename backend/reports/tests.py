from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Permission, Role, User


class AnalyticsTests(APITestCase):
    def setUp(self):
        permission = Permission.objects.create(module="reports", code="reports.view", name="Ver relatórios")
        role = Role.objects.create(code="reports-test", name="Relatórios")
        role.permissions.add(permission, Permission.objects.get(code="reports.export"))
        self.client.force_authenticate(User.objects.create_user(email="reports@test.local", password="1122", role=role))

    def test_analytics_and_csv_are_available(self):
        response = self.client.get("/api/reports/analytics/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("inventory_value", response.data)
        csv_response = self.client.get("/api/reports/analytics/?export=csv")
        self.assertEqual(csv_response.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_response["Content-Type"], "text/csv; charset=utf-8")

    def test_report_viewer_without_export_permission_cannot_export(self):
        self.client.force_authenticate(None)
        role = Role.objects.create(code="report-viewer", name="Consulta de relatórios")
        role.permissions.add(Permission.objects.get(code="reports.view"))
        user = User.objects.create_user(email="report-viewer@test.local", password="1122", role=role)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get("/api/reports/analytics/").status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get("/api/reports/analytics/?export=csv").status_code, status.HTTP_403_FORBIDDEN)
