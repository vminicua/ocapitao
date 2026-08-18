from rest_framework import status
from rest_framework.test import APITestCase
from django.core.management import call_command
from django.test import override_settings

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
            force_password_change=False,
        )
        self.viewer = User.objects.create_user(
            email="viewer@ocapitao.local",
            password="1122",
            first_name="Vera",
            role=self.viewer_role,
            force_password_change=False,
        )
        self.target = User.objects.create_user(
            email="target@ocapitao.local",
            password="1122",
            first_name="Target",
            role=self.viewer_role,
            force_password_change=False,
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

    def test_forced_pin_change_blocks_business_endpoints(self):
        self.manager.force_password_change = True
        self.manager.save(update_fields=["force_password_change"])
        self.client.force_authenticate(self.manager)

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_can_change_temporary_pin(self):
        self.manager.force_password_change = True
        self.manager.save(update_fields=["force_password_change"])
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            "/api/auth/change-pin/",
            {"current_pin": "1122", "new_pin": "864275"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.manager.refresh_from_db()
        self.assertFalse(self.manager.force_password_change)
        self.assertTrue(self.manager.check_password("864275"))

    def test_non_superuser_cannot_assign_privileged_role(self):
        settings_manage = Permission.objects.create(
            module="settings", code="settings.manage", name="Gerir configurações"
        )
        privileged_role = Role.objects.create(code="privileged", name="Privileged")
        privileged_role.permissions.set([settings_manage])
        self.client.force_authenticate(self.manager)

        response = self.client.patch(
            f"/api/users/{self.target.id}/",
            {"role_id": str(privileged_role.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.target.refresh_from_db()
        self.assertEqual(self.target.role_id, self.viewer_role.id)

    @override_settings(INITIAL_ADMIN_PIN="")
    def test_seed_preserves_existing_password_and_privileges(self):
        admin = User.objects.create_user(
            email="admin@ocapitao.local",
            username="custom-admin",
            password="987654",
            is_staff=False,
            is_superuser=False,
            force_password_change=True,
            role=self.viewer_role,
        )

        call_command("seed_initial_data", verbosity=0)

        admin.refresh_from_db()
        self.assertTrue(admin.check_password("987654"))
        self.assertFalse(admin.is_superuser)
        self.assertFalse(admin.is_staff)
        self.assertTrue(admin.force_password_change)
        self.assertEqual(admin.username, "custom-admin")
