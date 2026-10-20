from django.db import migrations

def add_manager_members_permission(apps, schema_editor):
    RoleFeaturePermission = apps.get_model('core', 'RoleFeaturePermission')
    RoleFeaturePermission.objects.get_or_create(role='MANAGER', feature_key='hr_members')

def remove_manager_members_permission(apps, schema_editor):
    RoleFeaturePermission = apps.get_model('core', 'RoleFeaturePermission')
    RoleFeaturePermission.objects.filter(role='MANAGER', feature_key='hr_members').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_expodevice'),
    ]

    operations = [
        migrations.RunPython(add_manager_members_permission, remove_manager_members_permission),
    ]
