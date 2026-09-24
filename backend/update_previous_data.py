import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from accounts_module.models import Income, Expense, Transaction

def run_update():
    print("Starting data migration for past records...")
    bank_methods = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'DD', 'BANK_TRANSFER', 'ONLINE']

    # Update Incomes
    incomes = Income.objects.all()
    updated_incomes = 0
    for i in incomes:
        pm = str(i.payment_method).upper()
        correct_type = 'BANK' if pm in bank_methods else 'CASH'
        if i.account_type != correct_type:
            i.account_type = correct_type
            i.save(update_fields=['account_type'])
            updated_incomes += 1
    print(f"Updated {updated_incomes} Income records.")

    # Update Expenses
    expenses = Expense.objects.all()
    updated_expenses = 0
    for e in expenses:
        pm = str(e.payment_method).upper()
        correct_type = 'BANK' if pm in bank_methods else 'CASH'
        if e.account_type != correct_type:
            e.account_type = correct_type
            e.save(update_fields=['account_type'])
            updated_expenses += 1
    print(f"Updated {updated_expenses} Expense records.")

    # Update Transactions
    transactions = Transaction.objects.all()
    updated_transactions = 0
    for t in transactions:
        pm = str(t.payment_method).upper()
        correct_type = 'BANK' if pm in bank_methods else 'CASH'
        if getattr(t, 'account_type', '') != correct_type:
            t.account_type = correct_type
            t.save(update_fields=['account_type'])
            updated_transactions += 1
    print(f"Updated {updated_transactions} Transaction records.")

    print("Data migration completed successfully.")

if __name__ == '__main__':
    run_update()
