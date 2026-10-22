from django.db import migrations

def update_empty_addresses(apps, schema_editor):
    MemberPost = apps.get_model('core', 'MemberPost')
    for post in MemberPost.objects.all():
        if not post.address or post.address.strip() in ['', 'Sjjeej']:
            post.address = 'Palakkad, Kerala'
            post.save(update_fields=['address'])

def reverse_update(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0014_memberpost_memberpostcomment_memberpostimage_and_more'),
    ]

    operations = [
        migrations.RunPython(update_empty_addresses, reverse_update),
    ]
