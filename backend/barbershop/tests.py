from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Employee, Permission, Role, User
from customers.models import Customer
from django.utils import timezone
from datetime import timedelta
from pos.models import OperationalSession

from .models import Appointment, Service, ServiceCategory


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


class AppointmentOperationsTests(APITestCase):
    def setUp(self):
        role = Role.objects.create(code="admin", name="Administrador Agenda")
        role.permissions.add(Permission.objects.get(code="appointments.manage"))
        self.user = User.objects.create_user(email="agenda@test.local", password="1122", role=role)
        self.employee = Employee.objects.create(user=self.user, department=Employee.Department.BARBERSHOP)
        self.customer = Customer.objects.create(full_name="Ana Agenda", phone="841234567")
        category = ServiceCategory.objects.create(department="barbershop", name="Cortes")
        self.service = Service.objects.create(
            department="barbershop", category="Cortes", category_ref=category,
            name="Corte", duration_minutes=30, price="300.00",
        )
        self.client.force_authenticate(self.user)

    def payload(self, minutes=60):
        return {
            "department": "barbershop", "customer_id": str(self.customer.id),
            "employee_id": str(self.employee.id), "service_id": str(self.service.id),
            "scheduled_for": (timezone.now() + timedelta(minutes=minutes)).isoformat(),
            "price": "300.00", "status": "scheduled", "payment_status": "pending",
        }

    def test_conflicting_appointment_is_rejected(self):
        first = self.client.post("/api/appointments/", self.payload(), format="json")
        second = self.client.post("/api/appointments/", self.payload(minutes=70), format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_start_appointment_creates_linked_operational_session(self):
        created = self.client.post("/api/appointments/", self.payload(), format="json")
        response = self.client.post(f"/api/appointments/{created.data['id']}/start/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appointment = Appointment.objects.get(pk=created.data["id"])
        session = OperationalSession.objects.get(appointment=appointment)
        self.assertEqual(appointment.status, Appointment.Status.IN_PROGRESS)
        self.assertEqual(session.responsible, self.employee)
        self.assertEqual(session.items[0]["service_id"], str(self.service.id))
