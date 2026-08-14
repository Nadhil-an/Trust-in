from django.urls import path
from reports_module import views

urlpatterns = [
    path('requests/', views.AssessmentRequestReportView.as_view()),
    path('cash-book/', views.CashBookReportView.as_view()),
    path('income/', views.IncomeReportView.as_view()),
    path('expenses/', views.ExpenseReportView.as_view()),
    path('members/', views.MemberReportView.as_view()),
    path('payroll/', views.PayrollReportView.as_view()),
    path('transactions/', views.TransactionReportView.as_view()),
]
