import json
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import requests
from django.test import TestCase
from django.utils import timezone

from customers.models import Customer
from config.common.models import SyncStatus

from .backup import BackupService
from .models import SyncQueue
from .services import SyncService
from .state import suppress_sync_signals


class FakeRemoteClient:
    def __init__(self, feed=None, error=None):
        self.feed = feed or {"results": [], "server_time": timezone.now().isoformat()}
        self.error = error
        self.calls = []

    def is_online(self):
        return True

    def get_feed(self, since=None):
        return self.feed

    def request(self, method, path, payload=None):
        self.calls.append((method, path))
        if self.error:
            raise self.error
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps({"id": str(payload.get("id"))}).encode()
        return response


class SynchronizationTests(TestCase):
    def test_repeated_updates_are_compacted_into_one_pending_item(self):
        customer = Customer.objects.create(full_name="Cliente Offline", phone="841111111")
        customer.notes = "primeira alteração"
        customer.save()
        customer.notes = "última alteração"
        customer.save()
        queue = SyncQueue.objects.filter(model_label="customers.Customer", object_id=customer.id)
        self.assertEqual(queue.count(), 1)
        self.assertEqual(queue.get().payload["notes"], "última alteração")

    def test_remote_record_is_downloaded_without_creating_upload(self):
        remote_id = uuid4()
        service = SyncService()
        service.client = FakeRemoteClient({
            "results": [{
                "model_label": "customers.Customer", "object_id": str(remote_id),
                "updated_at": timezone.now().isoformat(),
                "payload": {"id": str(remote_id), "full_name": "Cliente Cloud", "phone": "842222222", "email": "", "address": "", "birth_date": None, "preferred_barber": None, "loyalty_points": 0, "notes": "", "active": True, "deleted_at": None},
            }],
            "server_time": timezone.now().isoformat(),
        })
        result = service.pull_remote()
        self.assertEqual(result["downloaded"], 1)
        self.assertTrue(Customer.objects.filter(remote_id=remote_id, full_name="Cliente Cloud").exists())
        self.assertFalse(SyncQueue.objects.filter(object_id=remote_id).exists())

    def test_simultaneous_local_and_remote_change_becomes_conflict(self):
        customer = Customer.objects.create(full_name="Conflito", phone="843333333")
        service = SyncService()
        service.client = FakeRemoteClient({
            "results": [{"model_label": "customers.Customer", "object_id": str(customer.id), "updated_at": timezone.now().isoformat(), "payload": {} }],
            "server_time": timezone.now().isoformat(),
        })
        result = service.pull_remote()
        self.assertEqual(result["conflicts"], 1)
        self.assertEqual(SyncQueue.objects.get(object_id=customer.id).status, SyncStatus.CONFLICT)

    def test_network_failure_uses_retry_backoff_not_conflict(self):
        customer = Customer.objects.create(full_name="Retry", phone="844444444")
        service = SyncService()
        service.client = FakeRemoteClient(error=requests.ConnectionError("offline"))
        result = service.sync_pending()
        item = SyncQueue.objects.get(object_id=customer.id)
        self.assertFalse(result["ok"])
        self.assertEqual(item.status, SyncStatus.PENDING)
        self.assertIsNotNone(item.next_attempt_at)

    def test_successful_reconnect_does_not_upload_same_record_twice(self):
        customer = Customer.objects.create(full_name="Idempotente", phone="845555555")
        client = FakeRemoteClient()
        service = SyncService()
        service.client = client
        first = service.sync_pending()
        second = service.sync_pending()
        self.assertTrue(first["ok"])
        self.assertTrue(second["ok"])
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(SyncQueue.objects.get(object_id=customer.id).status, SyncStatus.SYNCED)


class BackupTests(TestCase):
    def test_backup_has_checksum_and_rejects_tampering(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.sqlite3"
            with closing(sqlite3.connect(source)) as connection:
                connection.execute("CREATE TABLE sample (value TEXT)")
                connection.execute("INSERT INTO sample VALUES ('ok')")
                connection.commit()
            backup_dir = Path(directory) / "backups"
            backup_dir.mkdir()
            service = BackupService()
            service.backup_directory = lambda: backup_dir
            database = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": str(source)}}
            with patch("sync.backup.settings.DATABASES", database):
                manifest = service.create()
                backup = backup_dir / manifest["file"]
                backup.write_bytes(backup.read_bytes() + b"tampered")
                with self.assertRaises(ValueError):
                    service.restore(manifest["file"])
