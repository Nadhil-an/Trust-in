from django.db import migrations

SOCIAL_FEATURES = [
    'social_analytics',
    'social_mrm_members',
    'social_mrm_tasks',
    'social_mrm_badges',
    'social_mrm_volunteers',
    'social_mrm_appreciation',
    'social_posts',
    'social_verifications',
    'social_official',
    'social_pom',
    'social_voting',
]

def seed_social_permissions(apps, schema_editor):
    RoleFeaturePermission = apps.get_model('core', 'RoleFeaturePermission')
    for feat in SOCIAL_FEATURES:
        for role in ['SOCIAL_MEDIA', 'MANAGER']:
            RoleFeaturePermission.objects.get_or_create(role=role, feature_key=feat)

def unseed_social_permissions(apps, schema_editor):
    RoleFeaturePermission = apps.get_model('core', 'RoleFeaturePermission')
    RoleFeaturePermission.objects.filter(feature_key__in=SOCIAL_FEATURES).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_memberpost_is_pinned_memberpost_post_category_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_social_permissions, unseed_social_permissions),
    ]
