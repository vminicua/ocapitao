from rest_framework import status
from rest_framework.test import APITestCase

from .models import Permission, Role, User


class UserPermissionTests(APITestCase):
    def setUp(self):
        self.users_manage = Permission.objects.create(
            module="users",
            code="users.manage",
            name="Gerir utilizadores",
        )
        self.users_view = Permission.objects.create(
            module="users",
            code="users.view",
            name="Consultar utilizadores",
        )

        self.manager_role = Role.objects.create(code="ops-manager", name="Operations Manager")
        self.manager_role.permissions.set([self.users_manage, self.users_view])

        self.viewer_role = Role.objects.create(code="guest", name="Guest")

        self.manager = User.objects.create_user(
            email="manager@ocapitao.local",
            password="1122",
            first_name="Marta",
            role=self.manager_role,
        )
        self.viewer = User.objects.create_user(
            email="viewer@ocapitao.local",
            password="1122",
            first_name="Vera",
            role=self.viewer_role,
        )
        self.target = User.objects.create_user(
            email="target@ocapitao.local",
            password="1122",
            first_name="Target",
            role=self.viewer_role,
        )

    def test_user_management_accepts_permission_not_role_code(self):
        self.client.force_authenticate(self.manager)

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_user_delete_deactivates_instead_of_removing(self):
        self.client.force_authenticate(self.manager)

        response = self.client.delete(f"/api/users/{self.target.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)

    def test_user_management_blocks_without_permission(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
