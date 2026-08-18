import os
import socket
import subprocess
import threading
import time
from pathlib import Path


class CloudManager:
    """Manages the SSH tunnel to the remote MySQL server and the backend-cloud subprocess."""

    _instance = None
    _instance_lock = threading.Lock()

    def __init__(self):
        self._lock = threading.Lock()
        self._ssh_client = None
        self._tunnel_socket = None
        self._backend_process = None
        self._connected = False
        self._last_error = ""

    @classmethod
    def get(cls):
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @property
    def is_connected(self):
        return self._connected

    @property
    def last_error(self):
        return self._last_error

    def _save_credentials(self, ssh_password: str):
        try:
            import keyring
            from django.conf import settings
            keyring.set_password("O Capitao SSH", f"{settings.SSH_USER}@{settings.SSH_HOST}", ssh_password)
        except Exception as exc:
            raise RuntimeError("O Windows não permitiu guardar a credencial SSH com segurança.") from exc

    def _load_credentials(self) -> str | None:
        from django.conf import settings

        env_password = settings.SSH_PASSWORD.strip()
        if env_password:
            return env_password

        try:
            import keyring
            return keyring.get_password("O Capitao SSH", f"{settings.SSH_USER}@{settings.SSH_HOST}")
        except Exception:
            return None

    def clear_credentials(self):
        try:
            import keyring
            from django.conf import settings
            keyring.delete_password("O Capitao SSH", f"{settings.SSH_USER}@{settings.SSH_HOST}")
        except Exception:
            pass

    def connect(self, ssh_password: str) -> tuple[bool, str]:
        with self._lock:
            try:
                from django.conf import settings
                self._open_tunnel(
                    host=settings.SSH_HOST,
                    port=settings.SSH_PORT,
                    user=settings.SSH_USER,
                    password=ssh_password,
                    local_port=settings.MYSQL_PORT,
                )
                self._save_credentials(ssh_password)
                self._connected = True
                self._last_error = ""
                # Start backend-cloud in background so the HTTP request returns immediately
                threading.Thread(
                    target=self._start_backend_cloud_safe,
                    daemon=True,
                    name="cloud-backend-start",
                ).start()
                return True, "Túnel SSH aberto. O backend-cloud está a iniciar em background."
            except Exception as exc:
                self._connected = False
                self._last_error = str(exc)
                self._close_tunnel()
                return False, str(exc)

    def disconnect(self):
        with self._lock:
            self._connected = False
            self._stop_backend_cloud()
            self._close_tunnel()
            self.clear_credentials()

    def _open_tunnel(self, host: str, port: int, user: str, password: str, local_port: int):
        import paramiko

        self._close_tunnel()

        client = paramiko.SSHClient()
        known_hosts = Path(__file__).resolve().parents[2] / "data" / "known_hosts"
        known_hosts.parent.mkdir(parents=True, exist_ok=True)
        known_hosts.touch(exist_ok=True)
        client.load_host_keys(str(known_hosts))
        # Trust on first use; subsequent connections reject a changed server key.
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, port=port, username=user, password=password, timeout=20)

        transport = client.get_transport()
        if not transport or not transport.is_active():
            raise Exception("Não foi possível estabelecer o transporte SSH.")

        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_sock.bind(("127.0.0.1", local_port))
        server_sock.listen(10)
        server_sock.settimeout(1.0)

        self._ssh_client = client
        self._tunnel_socket = server_sock

        def relay(src, dst):
            try:
                while True:
                    data = src.recv(4096)
                    if not data:
                        break
                    dst.sendall(data)
            except Exception:
                pass
            finally:
                try:
                    src.close()
                except Exception:
                    pass
                try:
                    dst.close()
                except Exception:
                    pass

        def forward_loop():
            while self._tunnel_socket is server_sock:
                try:
                    client_sock, _ = server_sock.accept()
                except socket.timeout:
                    continue
                except OSError:
                    break
                try:
                    ch = transport.open_channel(
                        "direct-tcpip", ("127.0.0.1", 3306), ("127.0.0.1", 0)
                    )
                except Exception:
                    client_sock.close()
                    continue
                threading.Thread(target=relay, args=(client_sock, ch), daemon=True).start()
                threading.Thread(target=relay, args=(ch, client_sock), daemon=True).start()

        threading.Thread(target=forward_loop, daemon=True, name="ssh-tunnel").start()

    def _close_tunnel(self):
        if self._tunnel_socket:
            try:
                self._tunnel_socket.close()
            except Exception:
                pass
            self._tunnel_socket = None
        if self._ssh_client:
            try:
                self._ssh_client.close()
            except Exception:
                pass
            self._ssh_client = None

    def _start_backend_cloud_safe(self):
        """Wrapper that silently captures errors from background startup."""
        try:
            self._start_backend_cloud()
        except Exception as exc:
            self._last_error = str(exc)

    def _start_backend_cloud(self):
        import requests
        from django.conf import settings

        try:
            r = requests.get("http://127.0.0.1:8001/api/health/", timeout=2)
            if r.ok:
                return
        except Exception:
            pass

        root_dir = settings.ROOT_DIR
        python = root_dir / ".venv" / "Scripts" / "python.exe"
        if not python.exists():
            python = root_dir / ".venv" / "bin" / "python"

        env = {**os.environ, "DJANGO_SETTINGS_MODULE": "config.settings.remote"}
        backend_dir = str(root_dir / "backend")

        subprocess.run(
            [str(python), "manage.py", "migrate", "--run-syncdb"],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            timeout=60,
        )

        self._backend_process = subprocess.Popen(
            [str(python), "manage.py", "runserver", "127.0.0.1:8001", "--noreload"],
            cwd=backend_dir,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        for _ in range(40):
            time.sleep(1)
            try:
                r = requests.get("http://127.0.0.1:8001/api/health/", timeout=2)
                if r.ok:
                    return
            except Exception:
                pass

        raise Exception("O backend-cloud não respondeu a tempo. Verifique os logs.")

    def _stop_backend_cloud(self):
        if self._backend_process and self._backend_process.poll() is None:
            try:
                self._backend_process.terminate()
                self._backend_process.wait(timeout=5)
            except Exception:
                try:
                    self._backend_process.kill()
                except Exception:
                    pass
            self._backend_process = None

    def try_auto_connect(self):
        """Called at startup if credentials are saved."""
        password = self._load_credentials()
        if password:
            self.connect(password)
