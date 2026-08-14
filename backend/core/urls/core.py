"""Core shared URL patterns — users, audit log, notifications, search"""
from django.urls import path
from core import views

urlpatterns = [
    path('users/', views.UserListCreateView.as_view(), name='user_list'),
    path('users/<uuid:pk>/', views.UserDetailView.as_view(), name='user_detail'),
    path('audit-log/', views.AuditLogListView.as_view(), name='audit_log'),
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/unread_count/', views.NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('notifications/<str:pk>/read/', views.NotificationMarkReadView.as_view(), name='notification_read'),
    path('search/', views.GlobalSearchView.as_view(), name='global_search'),
]
