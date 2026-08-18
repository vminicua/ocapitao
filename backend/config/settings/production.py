from .remote import *  # noqa: F401,F403

DEBUG = False
if SECRET_KEY == "ocapitao-dev-secret-key-com-mais-de-32-bytes" or len(SECRET_KEY) < 50:
    raise RuntimeError("DJANGO_SECRET_KEY forte e única é obrigatória em produção.")

SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
