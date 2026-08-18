from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Permission, Role, User
from .models import Customer


class CustomerPermissionTests(APITestCase):
    def test_custom_role_uses_permissions_instead_of_fixed_role_code(self):
        permission = Permission.objects.get(code="customers.manage")
        role = Role.objects.create(code="custom-reception", name="Receção personalizada")
        role.permissions.add(permission)
        user = User.objects.create_user(email="reception@test.local", password="1122", role=role)
        self.client.force_authenticate(user)
        response = self.client.post("/api/customers/", {"full_name": "Cliente", "phone": "840000001"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Customer.objects.filter(phone="840000001").exists())

    def test_customer_endpoint_denies_role_without_permission(self):
        role = Role.objects.create(code="no-customer-access", name="Sem clientes")
        user = User.objects.create_user(email="blocked@test.local", password="1122", role=role)
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get("/api/customers/").status_code, status.HTTP_403_FORBIDDEN)
