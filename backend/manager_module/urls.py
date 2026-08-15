"""Manager Module URL patterns"""
from django.urls import path
from manager_module import views

urlpatterns = [
    # Dashboard
    path('dashboard/', views.ManagerDashboardView.as_view(), name='manager_dashboard'),
    # Mobile Role Dashboards
    path('dashboard/fao/', views.FAODashboardView.as_view(), name='fao_dashboard'),
    path('dashboard/aco/', views.ACODashboardView.as_view(), name='aco_dashboard'),
    path('dashboard/geo/', views.GEODashboardView.as_view(), name='geo_dashboard'),

    # Assessment Requests
    path('requests/', views.AssessmentRequestListCreateView.as_view(), name='request_list'),
    path('requests/<uuid:pk>/', views.AssessmentRequestDetailView.as_view(), name='request_detail'),
    path('requests/<uuid:pk>/action/', views.RequestActionView.as_view(), name='request_action'),
    path('requests/<uuid:pk>/history/', views.RequestStatusHistoryView.as_view(), name='request_history'),

    # FAO / ACO / GEO Reports
    path('requests/<uuid:pk>/fao-report/', views.FAOReportView.as_view(), name='fao_report'),
    path('requests/<uuid:pk>/aco-calculation/', views.ACOCalculationView.as_view(), name='aco_calculation'),
    path('requests/<uuid:pk>/geo-report/', views.GEOReportView.as_view(), name='geo_report'),

    # Charity Inventory
    path('inventory/', views.CharityInventoryListCreateView.as_view(), name='inventory_list'),
    path('inventory/<uuid:pk>/', views.CharityInventoryDetailView.as_view(), name='inventory_detail'),
    path('inventory-transactions/', views.InventoryTransactionListCreateView.as_view(), name='inventory_transaction_list'),

    # Minutes
    path('minutes/', views.MinutesListCreateView.as_view(), name='minutes_list'),
    path('minutes/<uuid:pk>/', views.MinutesDetailView.as_view(), name='minutes_detail'),

    # Partners
    path('partners/', views.PartnerListCreateView.as_view(), name='partner_list'),
    path('partners/<uuid:pk>/', views.PartnerDetailView.as_view(), name='partner_detail'),

    # Scheduled Payouts
    path('payouts/', views.ScheduledPayoutListCreateView.as_view(), name='payout_list'),
    path('payouts/<uuid:pk>/', views.ScheduledPayoutDetailView.as_view(), name='payout_detail'),
]
