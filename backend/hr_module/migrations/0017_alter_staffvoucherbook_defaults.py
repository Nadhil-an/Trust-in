from django.db import migrations, models

def update_unassigned_voucher_books(apps, schema_editor):
    StaffVoucherBook = apps.get_model('hr_module', 'StaffVoucherBook')
    # Update default entries where HR hasn't manually assigned a book yet
    StaffVoucherBook.objects.filter(
        book_number=1, voucher_start=1, voucher_end=100, current_voucher=1, updated_by__isnull=True
    ).update(book_number=0, voucher_start=0, voucher_end=0, current_voucher=0)

class Migration(migrations.Migration):

    dependencies = [
        ('hr_module', '0016_staffvoucherbook_next_current_voucher'),
    ]

    operations = [
        migrations.AlterField(
            model_name='staffvoucherbook',
            name='book_number',
            field=models.PositiveIntegerField(default=0, help_text='Voucher book number (e.g. 1, 2, 3)'),
        ),
        migrations.AlterField(
            model_name='staffvoucherbook',
            name='current_voucher',
            field=models.PositiveIntegerField(default=0, help_text='Next voucher to be issued'),
        ),
        migrations.AlterField(
            model_name='staffvoucherbook',
            name='voucher_end',
            field=models.PositiveIntegerField(default=0, help_text='Last voucher number in the book'),
        ),
        migrations.AlterField(
            model_name='staffvoucherbook',
            name='voucher_start',
            field=models.PositiveIntegerField(default=0, help_text='First voucher number in the book'),
        ),
        migrations.RunPython(update_unassigned_voucher_books, reverse_code=migrations.RunPython.noop),
    ]
