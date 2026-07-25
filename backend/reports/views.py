from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.common.permissions import RoleBasedPermission
from config.common.viewsets import SoftDeleteModelViewSet
from pos.models import CashSession, Sale
from sync.models import SyncLog
from sync.services import SyncService

from barbershop.models import Appointment

from .models import DailySnapshot
from .serializers import DailySnapshotSerializer


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_permissions = {"get": ["dashboard.view"]}

    def get(self, request):
        today = timezone.localdate()
        sales_today = Sale.objects.filter(created_at__date=today, status=Sale.Status.COMPLETED, deleted_at__isnull=True)
        money_field = DecimalField(max_digits=10, decimal_places=2)
        totals = sales_today.aggregate(total=Coalesce(Sum("total_amount"), Value(0), output_field=money_field))
        by_department = sales_today.values("department").annotate(
            total=Coalesce(Sum("total_amount"), Value(0), output_field=money_field)
        )
        pending_services = Appointment.objects.filter(
            scheduled_for__date=today,
            status__in=[Appointment.Status.SCHEDULED, Appointment.Status.IN_PROGRESS],
            deleted_at__isnull=True,
        ).count()
        cash_open = CashSession.objects.filter(status=CashSession.Status.OPEN, deleted_at__isnull=True).exists()
        sync_status = SyncService().status()
        last_sync = SyncLog.objects.first()

        return Response(
            {
                "data": today.isoformat(),
                "total_vendas": totals["total"],
                "totais_por_area": {item["department"]: item["total"] for item in by_department},
                "servicos_pendentes": pending_services,
                "caixa_aberto": cash_open,
                "estado_sincronizacao": sync_status,
                "ultima_sincronizacao": getattr(last_sync, "created_at", None),
            }
        )


class DailySnapshotViewSet(SoftDeleteModelViewSet):
    queryset = DailySnapshot.objects.all()
    serializer_class = DailySnapshotSerializer
    permission_classes = [IsAuthenticated, RoleBasedPermission]
    allowed_roles = {"*": ["admin", "manager"]}

# Create your views here.
