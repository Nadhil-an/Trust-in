from django.db import migrations

def add_assets_in_stock_permission(apps, schema_editor):
    RoleFeaturePermission = apps.get_model('core', 'RoleFeaturePermission')
    for role in ['DATA_ENTRY', 'MANAGER', 'ADMIN']:
        RoleFeaturePermission.objects.get_or_create(role=role, feature_key='assets_in_stock')

def remove_assets_in_stock_permission(apps, schema_editor):
    RoleFeaturePermission = apps.get_model('core', 'RoleFeaturePermission')
    RoleFeaturePermission.objects.filter(feature_key='assets_in_stock').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_manager_hr_members_permission'),
    ]

    operations = [
        migrations.RunPython(add_assets_in_stock_permission, remove_assets_in_stock_permission),
    ]
