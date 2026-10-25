from django.db import migrations
from django.db.models import Q

def cleanup_duplicates(apps, schema_editor):
    Income = apps.get_model('accounts_module', 'Income')
    CashClosing = apps.get_model('cashier_module', 'CashClosing')

    auto_computed = {'BY CASH', 'BY ONLINE', 'BY BANK', 'TOTAL DONATION', 'TOTAL', 'OB CASH', 'OB BANK'}

    # 1. Delete rogue Income records created for auto-computed Day Book headers
    Income.objects.filter(
        Q(source__in=auto_computed) | Q(donor_name__in=auto_computed)
    ).delete()

    # 2. Clean debit_rows inside CashClosing snapshots
    clean_target = {'BY CASH', 'BY ONLINE', 'BY BANK', 'DONATION', 'TOTAL DONATION', 'TOTAL'}
    for closing in CashClosing.objects.all():
        if closing.debit_rows:
            cleaned = [
                r for r in closing.debit_rows
                if (r.get('particular') or '').strip().upper() not in clean_target
                and not r.get('isDonationHeader') and not r.get('isTotalDonation')
            ]
            if len(cleaned) != len(closing.debit_rows):
                closing.debit_rows = cleaned
                closing.save(update_fields=['debit_rows'])

def reverse_cleanup(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('cashier_module', '0005_cashclosing_credit_rows_cashclosing_debit_rows'),
        ('accounts_module', '0022_alter_banktransaction_payment_method_and_more'),
    ]

    operations = [
        migrations.RunPython(cleanup_duplicates, reverse_cleanup),
    ]
