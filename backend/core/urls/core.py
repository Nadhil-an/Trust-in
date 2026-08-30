"""Core shared URL patterns — users, audit log, notifications, search"""
from django.urls import path
from core import views

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'events', views.EventViewSet, basename='events')

urlpatterns = [
    path('users/', views.UserListCreateView.as_view(), name='user_list'),
    path('users/<uuid:pk>/', views.UserDetailView.as_view(), name='user_detail'),
    path('audit-log/', views.AuditLogListView.as_view(), name='audit_log'),
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/unread_count/', views.NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('notifications/<str:pk>/read/', views.NotificationMarkReadView.as_view(), name='notification_read'),
    path('search/', views.GlobalSearchView.as_view(), name='global_search'),
    path('features/', views.RoleFeaturePermissionView.as_view(), name='features'),
    path('update-push-token/', views.ExpoPushTokenView.as_view(), name='update_push_token'),
] + router.urls
