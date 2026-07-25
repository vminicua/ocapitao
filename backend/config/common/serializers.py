from rest_framework import serializers


class SyncableModelSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)
    remote_id = serializers.UUIDField(required=False, allow_null=True)
    deleted_at = serializers.DateTimeField(required=False, allow_null=True)
    sync_status = serializers.CharField(required=False)
