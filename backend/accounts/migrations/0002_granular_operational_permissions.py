from django.db import migrations


PERMISSIONS = [
    ("customers", "customers.view", "Consultar clientes"), ("customers", "customers.manage", "Gerir clientes"),
    ("appointments", "appointments.view", "Consultar agenda"), ("appointments", "appointments.manage", "Gerir agenda"),
    ("vehicles", "vehicles.view", "Consultar viaturas"), ("vehicles", "vehicles.manage", "Gerir viaturas"),
    ("purchases", "purchases.view", "Consultar fornecedores e compras"), ("purchases", "purchases.manage", "Gerir fornecedores e compras"),
    ("inventory", "stock.count", "Executar e aprovar contagens de stock"), ("inventory", "stock.transfer", "Transferir stock entre localizações"),
    ("loyalty", "loyalty.view", "Consultar fidelização"), ("loyalty", "loyalty.adjust", "Ajustar pontos de fidelização"),
    ("promotions", "promotions.view", "Consultar promoções"), ("promotions", "promotions.manage", "Gerir promoções"),
    ("sales", "sales.cancel", "Cancelar vendas"), ("sales", "sales.discount", "Aplicar descontos manuais"),
    ("reports", "reports.export", "Exportar relatórios"),
]

ROLE_CODES = {
    "admin": [code for _, code, _ in PERMISSIONS],
    "manager": [code for _, code, _ in PERMISSIONS],
    "barber": ["customers.view", "customers.manage", "appointments.view", "appointments.manage", "loyalty.view"],
    "cashier": ["customers.view", "customers.manage", "appointments.view", "appointments.manage", "vehicles.view", "vehicles.manage", "loyalty.view"],
    "washer": ["customers.view", "customers.manage", "appointments.view", "appointments.manage", "vehicles.view", "vehicles.manage"],
}


def create_permissions(apps, schema_editor):
    Permission = apps.get_model("accounts", "Permission")
    Role = apps.get_model("accounts", "Role")
    permissions = {}
    for module, code, name in PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(code=code, defaults={"module": module, "name": name})
        permissions[code] = permission
    for role_code, codes in ROLE_CODES.items():
        role = Role.objects.filter(code=role_code).first()
        if role:
            role.permissions.add(*(permissions[code] for code in codes))


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [migrations.RunPython(create_permissions, migrations.RunPython.noop)]
