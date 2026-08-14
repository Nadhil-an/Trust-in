from django.urls import path
from cashier_module.views import (
    CashierDashboardView, PendingDisbursementsView, DisburseMoneyView,
    DisbursementListView, CashClosingListCreateView, CashHandoverListCreateView
)

urlpatterns = [
    path('dashboard/', CashierDashboardView.as_view()),
    path('pending/', PendingDisbursementsView.as_view()),
    path('disburse/<uuid:pk>/', DisburseMoneyView.as_view()),
    path('disbursements/', DisbursementListView.as_view()),
    path('cash-closing/', CashClosingListCreateView.as_view()),
    path('handover/', CashHandoverListCreateView.as_view()),
]
