import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from accounts_module.models import Income, Expense, CashAccount, CashTransaction
from django.db import transaction

@transaction.atomic
def sync_historical_data():
    main_cash, _ = CashAccount.objects.get_or_create(name='Main Cash')
    if not main_cash.is_active:
        main_cash.is_active = True
        main_cash.save()
    
    incomes = Income.objects.filter(account_type='CASH').order_by('date', 'created_at')
    expenses = Expense.objects.filter(account_type='CASH').order_by('date', 'created_at')
    
    created_count = 0
    
    for inc in incomes:
        # Check if a cash transaction already exists for this receipt
        exists = CashTransaction.objects.filter(reference_id=inc.receipt_number).exists()
        if not exists:
            CashTransaction.objects.create(
                cash_account=main_cash,
                transaction_type='RECEIPT',
                date=inc.date,
                description=f"Income: {inc.source} — {inc.donor_name}",
                reference_id=inc.receipt_number,
                amount=inc.amount,
                balance_after=0, # We'll recalculate balances later
                created_by=inc.created_by,
                created_at=inc.created_at
            )
            created_count += 1
            
    for exp in expenses:
        exists = CashTransaction.objects.filter(reference_id=exp.expense_id).exists()
        if not exists:
            CashTransaction.objects.create(
                cash_account=main_cash,
                transaction_type='PAYMENT',
                date=exp.date,
                description=f"Expense: {exp.category} — {exp.payee}",
                reference_id=exp.expense_id,
                amount=exp.amount,
                balance_after=0,
                created_by=exp.created_by,
                created_at=exp.created_at
            )
            created_count += 1
            
    # Now recalculate running balances for the cash account chronologically
    all_txns = CashTransaction.objects.filter(cash_account=main_cash).order_by('date', 'created_at')
    running_balance = main_cash.opening_balance
    
    for txn in all_txns:
        if txn.transaction_type in ['RECEIPT', 'TRANSFER_IN', 'OPENING']:
            running_balance += txn.amount
        else:
            running_balance -= txn.amount
            
        txn.balance_after = running_balance
        txn.save(update_fields=['balance_after'])
        
    main_cash.current_balance = running_balance
    main_cash.save(update_fields=['current_balance'])
    
    print(f"Sync complete. Created {created_count} missing cash transactions. Final balance: Rs. {running_balance}")

if __name__ == '__main__':
    sync_historical_data()
