from datetime import timedelta
from pathlib import Path

import environ


BASE_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BASE_DIR.parent

env = environ.Env(
    APP_MODE=(str, "local"),
    APP_TIME_ZONE=(str, "Africa/Maputo"),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1", "testserver"]),
    DJANGO_CORS_ALLOWED_ORIGINS=(list, ["http://localhost:1420", "http://127.0.0.1:1420", "http://localhost:5173", "http://127.0.0.1:5173"]),
    DJANGO_DEBUG=(bool, True),
    DJANGO_SECRET_KEY=(str, "ocapitao-dev-secret-key-com-mais-de-32-bytes"),
    INITIAL_ADMIN_PIN=(str, ""),
    MYSQL_DB=(str, ""),
    MYSQL_HOST=(str, ""),
    MYSQL_PASSWORD=(str, ""),
    MYSQL_PORT=(int, 5523),
    MYSQL_USER=(str, ""),
    POSTGRES_DB=(str, "salacsth_ocapitao"),
    POSTGRES_HOST=(str, "127.0.0.1"),
    POSTGRES_PASSWORD=(str, ""),
    POSTGRES_PORT=(int, 5523),
    POSTGRES_USER=(str, "salacsth_ocapitaomaster"),
    REMOTE_API_BASE_URL=(str, "http://127.0.0.1:8001/api"),
    SQLITE_PATH=(str, "./data/ocapitao.sqlite"),
    SSH_HOST=(str, "premium342.web-hosting.com"),
    SSH_PASSWORD=(str, ""),
    SSH_PORT=(int, 21098),
    SSH_USER=(str, "salacsth"),
    SYNC_API_EMAIL=(str, ""),
    SYNC_API_PASSWORD=(str, ""),
    SYNC_BATCH_SIZE=(int, 50),
    SYNC_HEALTH_TIMEOUT=(int, 2),
    SYNC_REQUEST_TIMEOUT=(int, 15),
)

environ.Env.read_env(ROOT_DIR / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = env.list("DJANGO_CORS_ALLOWED_ORIGINS")
POSTGRES_HOST = env("POSTGRES_HOST")
POSTGRES_PORT = env("POSTGRES_PORT")
POSTGRES_DB = env("POSTGRES_DB")
POSTGRES_USER = env("POSTGRES_USER")
POSTGRES_PASSWORD = env("POSTGRES_PASSWORD")
MYSQL_HOST = env("MYSQL_HOST", default=POSTGRES_HOST)
MYSQL_PORT = env("MYSQL_PORT", default=POSTGRES_PORT)
MYSQL_DB = env("MYSQL_DB", default=POSTGRES_DB)
MYSQL_USER = env("MYSQL_USER", default=POSTGRES_USER)
MYSQL_PASSWORD = env("MYSQL_PASSWORD", default=POSTGRES_PASSWORD)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "accounts",
    "customers",
    "barbershop",
    "bar",
    "carwash",
    "pos",
    "inventory",
    "sync",
    "reports",
    "settings_app",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-pt"
TIME_ZONE = env("APP_TIME_ZONE")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = ROOT_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = ROOT_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SQLITE_PATH = Path(env("SQLITE_PATH"))
if not SQLITE_PATH.is_absolute():
    SQLITE_PATH = (ROOT_DIR / SQLITE_PATH).resolve()
SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)

REMOTE_API_BASE_URL = env("REMOTE_API_BASE_URL").rstrip("/")
SYNC_API_EMAIL = env("SYNC_API_EMAIL")
SYNC_API_PASSWORD = env("SYNC_API_PASSWORD")
SYNC_BATCH_SIZE = env("SYNC_BATCH_SIZE")
SYNC_HEALTH_TIMEOUT = env("SYNC_HEALTH_TIMEOUT")
SYNC_REQUEST_TIMEOUT = env("SYNC_REQUEST_TIMEOUT")
APP_MODE = env("APP_MODE")
SSH_HOST = env("SSH_HOST")
SSH_PASSWORD = env("SSH_PASSWORD")
SSH_PORT = env("SSH_PORT")
SSH_USER = env("SSH_USER")
INITIAL_ADMIN_PIN = env("INITIAL_ADMIN_PIN")
