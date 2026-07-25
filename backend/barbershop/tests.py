from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Permission, Role, User

from .models import Service, ServiceCategory


class ServiceCatalogTests(APITestCase):
    def setUp(self):
        manage_permission = Permission.objects.create(
            module="settings",
            code="settings.manage",
            name="Gerir configurações",
        )
        view_permission = Permission.objects.create(
            module="settings",
            code="settings.view",
            name="Consultar configurações",
        )
        self.manager_role = Role.objects.create(code="settings-manager", name="Settings Manager")
        self.manager_role.permissions.set([manage_permission, view_permission])
        self.viewer_role = Role.objects.create(code="settings-viewer", name="Settings Viewer")
        self.viewer_role.permissions.set([view_permission])

        self.manager = User.objects.create_user(
            email="settings@ocapitao.local",
            password="1122",
            first_name="Settings",
            role=self.manager_role,
        )
        self.viewer = User.objects.create_user(
            email="viewer@ocapitao.local",
            password="1122",
            first_name="Viewer",
            role=self.viewer_role,
        )

    def test_settings_manager_can_create_service_category_and_service(self):
        self.client.force_authenticate(self.manager)

        root_response = self.client.post(
            "/api/service-categories/",
            {
                "department": ServiceCategory.Department.BARBERSHOP,
                "name": "Cortes",
                "description": "Categorias principais",
                "active": True,
            },
            format="json",
        )
        self.assertEqual(root_response.status_code, status.HTTP_201_CREATED)

        subcategory_response = self.client.post(
            "/api/service-categories/",
            {
                "department": ServiceCategory.Department.BARBERSHOP,
                "parent_id": root_response.data["id"],
                "name": "Clássico",
                "description": "Cortes de rotina",
                "active": True,
            },
            format="json",
        )
        self.assertEqual(subcategory_response.status_code, status.HTTP_201_CREATED)

        service_response = self.client.post(
            "/api/services/",
            {
                "department": Service.Department.CARWASH,
                "category_ref_id": subcategory_response.data["id"],
                "name": "Corte normal",
                "duration_minutes": 35,
                "price": "250.00",
                "active": True,
                "description": "Serviço padrão",
            },
            format="json",
        )

        self.assertEqual(service_response.status_code, status.HTTP_201_CREATED)
        service = Service.objects.get(pk=service_response.data["id"])
        self.assertEqual(service.department, Service.Department.BARBERSHOP)
        self.assertEqual(service.category, "Cortes")
        self.assertEqual(service.subcategory, "Clássico")

    def test_settings_viewer_can_list_service_categories_but_cannot_create(self):
        ServiceCategory.objects.create(
            department=ServiceCategory.Department.CARWASH,
            name="Lavagens",
            description="Estrutura do carwash",
        )
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get("/api/service-categories/")
        create_response = self.client.post(
            "/api/service-categories/",
            {
                "department": ServiceCategory.Department.CARWASH,
                "name": "Premium",
                "active": True,
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
