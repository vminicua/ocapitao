from rest_framework.routers import DefaultRouter

from accounts.views import EmployeeViewSet, PermissionViewSet, RoleViewSet, UserViewSet
from bar.views import ProductCategoryViewSet, ProductViewSet
from barbershop.views import AppointmentViewSet, ServiceCategoryViewSet, ServiceViewSet
from carwash.views import VehicleViewSet
from customers.views import CustomerViewSet
from inventory.views import StockMovementViewSet
from pos.views import CashMovementViewSet, CashSessionViewSet, PaymentViewSet, SaleItemViewSet, SaleViewSet
from reports.views import DailySnapshotViewSet
from settings_app.views import SettingsViewSet
from sync.views import SyncLogViewSet, SyncQueueViewSet

router = DefaultRouter()
router.register("permissions", PermissionViewSet)
router.register("roles", RoleViewSet)
router.register("users", UserViewSet)
router.register("employees", EmployeeViewSet)
router.register("customers", CustomerViewSet)
router.register("service-categories", ServiceCategoryViewSet)
router.register("services", ServiceViewSet)
router.register("appointments", AppointmentViewSet)
router.register("product-categories", ProductCategoryViewSet)
router.register("products", ProductViewSet)
router.register("stock-movements", StockMovementViewSet)
router.register("vehicles", VehicleViewSet)
router.register("cash-sessions", CashSessionViewSet)
router.register("cash-movements", CashMovementViewSet)
router.register("sales", SaleViewSet)
router.register("sale-items", SaleItemViewSet)
router.register("payments", PaymentViewSet)
router.register("daily-snapshots", DailySnapshotViewSet)
router.register("settings", SettingsViewSet)
router.register("sync-queue", SyncQueueViewSet)
router.register("sync-logs", SyncLogViewSet)
