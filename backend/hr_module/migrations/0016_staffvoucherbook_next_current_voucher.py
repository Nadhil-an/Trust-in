from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hr_module', '0015_promoterregistryentry_verification_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffvoucherbook',
            name='next_current_voucher',
            field=models.PositiveIntegerField(blank=True, help_text='Starting/Current voucher number of next book', null=True),
        ),
    ]
