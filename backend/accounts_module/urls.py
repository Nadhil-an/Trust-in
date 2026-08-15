from django.urls import path
from accounts_module import views

urlpatterns = [
    path('dashboard/', views.AccountsDashboardView.as_view()),
    path('total-funds/', views.TotalFundsView.as_view()),
    # Cash
    path('cash/', views.CashAccountListView.as_view()),
    path('cash/transactions/', views.CashTransactionListCreateView.as_view()),
    # Bank
    path('bank/', views.BankAccountListCreateView.as_view()),
    path('bank/<uuid:pk>/', views.BankAccountDetailView.as_view()),
    path('bank/transactions/', views.BankTransactionListCreateView.as_view()),
    path('bank/reconciliation/', views.BankReconciliationView.as_view()),
    # Income
    path('income/', views.IncomeListCreateView.as_view()),
    path('income/<uuid:pk>/', views.IncomeDetailView.as_view()),
    # Expenses
    path('expenses/', views.ExpenseListCreateView.as_view()),
    path('expenses/<uuid:pk>/', views.ExpenseDetailView.as_view()),
    # Cheques
    path('cheques/', views.ChequeListCreateView.as_view()),
    path('cheques/<uuid:pk>/', views.ChequeDetailView.as_view()),
    # Transfers
    path('transfers/', views.TransferListCreateView.as_view()),
    # Transactions
    path('transactions/', views.TransactionListView.as_view()),
    path('transactions/<uuid:pk>/', views.TransactionDetailView.as_view()),
    # Money Requests (Accountant view)
    path('money-requests/', views.MoneyRequestListView.as_view()),
    # Pending Salaries (Accountant view)
    path('pending-salaries/', views.PendingPayrollListView.as_view()),
    path('salaries/<uuid:pk>/pay/', views.ProcessPaymentView.as_view()),
]
