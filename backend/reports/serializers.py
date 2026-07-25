from config.common.serializers import SyncableModelSerializer

from .models import DailySnapshot


class DailySnapshotSerializer(SyncableModelSerializer):
    class Meta:
        model = DailySnapshot
        fields = [
            "id",
            "remote_id",
            "sync_status",
            "deleted_at",
            "created_at",
            "updated_at",
            "date",
            "total_sales",
            "total_barbershop",
            "total_bar",
            "total_carwash",
            "pending_services",
            "cash_open",
        ]
