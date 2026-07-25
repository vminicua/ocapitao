"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import CurrentUserView, LoginUserListView, PinTokenObtainPairView
from config.api.router import router
from reports.views import DashboardSummaryView
from sync.views import CloudConnectView, CloudDisconnectView, HealthView, PingView, SyncNowView, SyncStatusView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/ping/", PingView.as_view(), name="ping"),
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/cloud/connect/", CloudConnectView.as_view(), name="cloud_connect"),
    path("api/cloud/disconnect/", CloudDisconnectView.as_view(), name="cloud_disconnect"),
    path("api/auth/users/", LoginUserListView.as_view(), name="login_users"),
    path("api/auth/token/", PinTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("api/dashboard/resumo/", DashboardSummaryView.as_view(), name="dashboard_summary"),
    path("api/sync/status/", SyncStatusView.as_view(), name="sync_status"),
    path("api/sync/run/", SyncNowView.as_view(), name="sync_run"),
    path("api/", include(router.urls)),
]
