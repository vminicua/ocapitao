from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Employee, Permission, Role, User
from bar.models import Product, ProductCategory
from barbershop.models import Service, ServiceCategory
from settings_app.models import Settings


class Command(BaseCommand):
    help = "Cria permissões, perfis, utilizador admin e dados base da aplicação."

    def handle(self, *args, **options):
        default_pin = "1122"
        permissions_map = [
            ("dashboard", "dashboard.view", "Ver dashboard"),
            ("barbershop", "barbershop.view", "Consultar agenda e serviços do barbershop"),
            ("barbershop", "barbershop.manage", "Gerir serviços e agendamentos do barbershop"),
            ("bar", "bar.view", "Consultar produtos e vendas do bar"),
            ("bar", "bar.manage", "Gerir produtos e vendas do bar"),
            ("carwash", "carwash.view", "Consultar operações do carwash"),
            ("carwash", "carwash.manage", "Gerir veículos e serviços do carwash"),
            ("pos", "pos.view", "Consultar POS e caixa"),
            ("pos", "pos.manage", "Gerir caixa e POS"),
            ("inventory", "inventory.view", "Consultar stock"),
            ("inventory", "inventory.manage", "Gerir stock"),
            ("reports", "reports.view", "Consultar relatórios"),
            ("sync", "sync.manage", "Executar sincronização"),
            ("users", "users.view", "Consultar utilizadores e perfis"),
            ("users", "users.manage", "Gerir utilizadores"),
            ("settings", "settings.view", "Consultar configurações"),
            ("settings", "settings.manage", "Gerir configurações"),
            ("customers", "customers.view", "Consultar clientes"),
            ("customers", "customers.manage", "Gerir clientes"),
            ("appointments", "appointments.view", "Consultar agenda"),
            ("appointments", "appointments.manage", "Gerir agenda"),
            ("vehicles", "vehicles.view", "Consultar viaturas"),
            ("vehicles", "vehicles.manage", "Gerir viaturas"),
            ("purchases", "purchases.view", "Consultar fornecedores e compras"),
            ("purchases", "purchases.manage", "Gerir fornecedores e compras"),
            ("inventory", "stock.count", "Executar e aprovar contagens de stock"),
            ("inventory", "stock.transfer", "Transferir stock entre localizações"),
            ("loyalty", "loyalty.view", "Consultar fidelização"),
            ("loyalty", "loyalty.adjust", "Ajustar pontos de fidelização"),
            ("promotions", "promotions.view", "Consultar promoções"),
            ("promotions", "promotions.manage", "Gerir promoções"),
            ("sales", "sales.cancel", "Cancelar vendas"),
            ("sales", "sales.discount", "Aplicar descontos manuais"),
            ("reports", "reports.export", "Exportar relatórios"),
        ]

        permissions = {}
        for module, code, name in permissions_map:
            permission, _ = Permission.objects.get_or_create(
                code=code,
                defaults={"module": module, "name": name},
            )
            permissions[code] = permission

        role_specs = {
            "admin": {
                "name": "Admin",
                "description": "Acesso completo ao sistema.",
                "permissions": list(permissions.keys()),
            },
            "manager": {
                "name": "Gerente",
                "description": "Gestão operacional da loja.",
                "permissions": [
                    "dashboard.view",
                    "barbershop.view",
                    "barbershop.manage",
                    "bar.view",
                    "bar.manage",
                    "carwash.view",
                    "carwash.manage",
                    "pos.view",
                    "pos.manage",
                    "inventory.view",
                    "inventory.manage",
                    "reports.view",
                    "sync.manage",
                    "users.view",
                    "settings.view",
                    "settings.manage",
                    "customers.view", "customers.manage", "appointments.view", "appointments.manage",
                    "vehicles.view", "vehicles.manage", "purchases.view", "purchases.manage", "stock.count",
                    "stock.transfer", "loyalty.view", "loyalty.adjust", "promotions.view", "promotions.manage",
                    "sales.cancel", "sales.discount", "reports.export",
                ],
            },
            "barber": {
                "name": "Barbeiro",
                "description": "Operação do atendimento de barbearia.",
                "permissions": [
                    "dashboard.view",
                    "barbershop.view",
                    "barbershop.manage",
                    "inventory.view",
                    "pos.view",
                    "pos.manage",
                    "reports.view",
                    "customers.view", "customers.manage", "appointments.view", "appointments.manage", "loyalty.view",
                ],
            },
            "cashier": {
                "name": "Caixa",
                "description": "Operação do POS, bar e sincronização manual.",
                "permissions": [
                    "dashboard.view",
                    "bar.view",
                    "bar.manage",
                    "pos.view",
                    "pos.manage",
                    "inventory.view",
                    "sync.manage",
                    "customers.view", "customers.manage", "appointments.view", "appointments.manage",
                    "vehicles.view", "vehicles.manage", "loyalty.view",
                ],
            },
            "washer": {
                "name": "Lavador",
                "description": "Operação do carwash.",
                "permissions": [
                    "dashboard.view",
                    "carwash.view",
                    "carwash.manage",
                    "inventory.view",
                    "pos.view",
                    "pos.manage",
                    "customers.view", "customers.manage", "appointments.view", "appointments.manage",
                    "vehicles.view", "vehicles.manage",
                ],
            },
        }

        roles = {}
        for code, spec in role_specs.items():
            role, _ = Role.objects.get_or_create(
                code=code,
                defaults={"name": spec["name"], "description": spec["description"]},
            )
            role.name = spec["name"]
            role.description = spec["description"]
            role.save(update_fields=["name", "description", "updated_at"])
            role.permissions.set([permissions[item] for item in spec["permissions"]])
            roles[code] = role

        admin_user, created = User.objects.get_or_create(
            email="admin@ocapitao.local",
            defaults={
                "first_name": "Admin",
                "last_name": "O Capitão",
                "is_staff": True,
                "is_superuser": True,
                "role": roles["admin"],
                "force_password_change": True,
            },
        )
        admin_user.role = roles["admin"]
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.force_password_change = False
        admin_user.username = "admin"
        admin_user.set_password(default_pin)
        admin_user.save()

        Employee.objects.get_or_create(
            user=admin_user,
            defaults={
                "department": Employee.Department.MANAGEMENT,
                "title": "Administrador",
                "hire_date": timezone.localdate(),
            },
        )

        access_users = [
            {
                "email": "harox@ocapitao.local",
                "username": "harox",
                "first_name": "Harox",
                "last_name": "",
                "role": roles["admin"],
                "title": "Operador",
            },
            {
                "email": "hakeem@ocapitao.local",
                "username": "hakeem",
                "first_name": "Hakeem",
                "last_name": "",
                "role": roles["admin"],
                "title": "Operador",
            },
            {
                "email": "guebuza@ocapitao.local",
                "username": "guebuza",
                "first_name": "Guebuza",
                "last_name": "",
                "role": roles["admin"],
                "title": "Operador",
            },
        ]

        for spec in access_users:
            user, _ = User.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "username": spec["username"],
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                    "role": spec["role"],
                    "force_password_change": False,
                    "is_active": True,
                },
            )
            user.username = spec["username"]
            user.first_name = spec["first_name"]
            user.last_name = spec["last_name"]
            user.role = spec["role"]
            user.force_password_change = False
            user.is_active = True
            user.set_password(default_pin)
            user.save()

            Employee.objects.get_or_create(
                user=user,
                defaults={
                    "department": Employee.Department.MANAGEMENT,
                    "title": spec["title"],
                    "hire_date": timezone.localdate(),
                },
            )

        Settings.objects.get_or_create(
            business_name="O Capitão",
            defaults={
                "legal_name": "O Capitão, Lda",
                "city": "Maputo",
                "country": "Moçambique",
                "currency_code": "MZN",
                "currency_symbol": "MT",
                "timezone": "Africa/Maputo",
                "tax_rate": "16.00",
                "appointment_slot_minutes": 30,
                "receipt_header": "Barbershop, Bar e Carwash",
                "receipt_footer": "Obrigado pela preferência.",
                "business_hours": "Segunda a Domingo, 08:00 - 22:00",
                "ssh_tunnel_command": "ssh -L 5523:127.0.0.1:3306 salacsth@premium342.web-hosting.com -p 21098 -N",
                "sync_interval_seconds": 300,
                "auto_sync_enabled": True,
                "enable_barbershop_module": True,
                "enable_pos_module": True,
                "enable_reports_module": True,
                "enable_low_stock_alerts": True,
                "allow_negative_stock": False,
                "require_pin_on_sale": True,
            },
        )

        bebidas, _ = ProductCategory.objects.get_or_create(name="Bebidas", department="bar", parent=None)
        snacks, _ = ProductCategory.objects.get_or_create(name="Snacks", department="bar", parent=None)
        barbeiro_root, _ = ProductCategory.objects.get_or_create(name="Barbershop", department="barbershop", parent=None)
        lavagem_root, _ = ProductCategory.objects.get_or_create(name="Carwash", department="carwash", parent=None)
        laminas, _ = ProductCategory.objects.get_or_create(
            name="Lâminas e descartáveis",
            department="barbershop",
            parent=barbeiro_root,
        )
        cosmeticos, _ = ProductCategory.objects.get_or_create(
            name="Cosméticos de barbearia",
            department="barbershop",
            parent=barbeiro_root,
        )
        detergentes, _ = ProductCategory.objects.get_or_create(
            name="Detergentes e químicos",
            department="carwash",
            parent=lavagem_root,
        )
        acessorios_wash, _ = ProductCategory.objects.get_or_create(
            name="Acessórios de lavagem",
            department="carwash",
            parent=lavagem_root,
        )

        product_specs = [
            (bebidas, "bar", "resale", "bottle", "Água 500ml", "BAR-001", "75.00", "55.00", 24, 6, 12),
            (bebidas, "bar", "resale", "bottle", "Refrigerante", "BAR-002", "120.00", "85.00", 18, 6, 12),
            (snacks, "bar", "resale", "pack", "Batata frita", "BAR-003", "95.00", "60.00", 10, 4, 8),
            (laminas, "barbershop", "consumable", "unit", "Lâmina descartável", "BARB-001", "0.00", "25.00", 40, 12, 24),
            (cosmeticos, "barbershop", "consumable", "unit", "Gel de barbear", "BARB-002", "0.00", "320.00", 8, 3, 6),
            (detergentes, "carwash", "consumable", "liter", "Shampoo auto", "CW-001", "0.00", "480.00", 14, 5, 10),
            (acessorios_wash, "carwash", "consumable", "unit", "Pano microfibra", "CW-002", "0.00", "150.00", 16, 6, 12),
        ]
        for category, department, item_type, unit, name, sku, sale_price, cost_price, stock_quantity, low_stock, reorder in product_specs:
            Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "category": category,
                    "department": department,
                    "item_type": item_type,
                    "name": name,
                    "unit": unit,
                    "sale_price": sale_price,
                    "cost_price": cost_price,
                    "stock_quantity": stock_quantity,
                    "low_stock_threshold": low_stock,
                    "reorder_quantity": reorder,
                    "image_url": "/branding/placeholders/product-default.svg",
                },
            )

        cortes_root, _ = ServiceCategory.objects.get_or_create(name="Cortes", department="barbershop", parent=None)
        barba_root, _ = ServiceCategory.objects.get_or_create(name="Barba", department="barbershop", parent=None)
        tratamentos_root, _ = ServiceCategory.objects.get_or_create(name="Tratamentos", department="barbershop", parent=None)
        lavagem_root_service, _ = ServiceCategory.objects.get_or_create(name="Lavagens", department="carwash", parent=None)
        detalhamento_root, _ = ServiceCategory.objects.get_or_create(name="Detalhamento", department="carwash", parent=None)

        corte_classico, _ = ServiceCategory.objects.get_or_create(
            name="Clássico",
            department="barbershop",
            parent=cortes_root,
        )
        fade_moderno, _ = ServiceCategory.objects.get_or_create(
            name="Fade e modernos",
            department="barbershop",
            parent=cortes_root,
        )
        barba_modelada, _ = ServiceCategory.objects.get_or_create(
            name="Modelada",
            department="barbershop",
            parent=barba_root,
        )
        hidratacao_capilar, _ = ServiceCategory.objects.get_or_create(
            name="Capilar",
            department="barbershop",
            parent=tratamentos_root,
        )
        lavagem_simples, _ = ServiceCategory.objects.get_or_create(
            name="Lavagem simples",
            department="carwash",
            parent=lavagem_root_service,
        )
        lavagem_premium, _ = ServiceCategory.objects.get_or_create(
            name="Lavagem premium",
            department="carwash",
            parent=lavagem_root_service,
        )
        detalhamento_interior, _ = ServiceCategory.objects.get_or_create(
            name="Interior",
            department="carwash",
            parent=detalhamento_root,
        )

        service_specs = [
            ("barbershop", "Cortes", "Clássico", corte_classico, "Corte normal", 30, "350.00"),
            ("barbershop", "Cortes", "Fade e modernos", fade_moderno, "Skin fade", 45, "500.00"),
            ("barbershop", "Barba", "Modelada", barba_modelada, "Barba", 20, "200.00"),
            ("barbershop", "Tratamentos", "Capilar", hidratacao_capilar, "Tratamento capilar", 45, "500.00"),
            ("carwash", "Lavagens", "Lavagem simples", lavagem_simples, "Lavagem simples", 40, "450.00"),
            ("carwash", "Lavagens", "Lavagem premium", lavagem_premium, "Lavagem completa", 60, "750.00"),
            ("carwash", "Detalhamento", "Interior", detalhamento_interior, "Aspiração interior", 25, "300.00"),
        ]
        for department, category, subcategory, category_ref, name, duration, price in service_specs:
            service, _ = Service.objects.get_or_create(
                name=name,
                department=department,
                defaults={
                    "category": category,
                    "subcategory": subcategory,
                    "category_ref": category_ref,
                    "duration_minutes": duration,
                    "price": price,
                    "active": True,
                },
            )
            service.category = category
            service.subcategory = subcategory
            service.category_ref = category_ref
            service.duration_minutes = duration
            service.price = price
            service.active = True
            service.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Utilizador admin criado com o PIN inicial {default_pin}."))
        self.stdout.write(self.style.SUCCESS("Seeds iniciais carregadas com sucesso."))
