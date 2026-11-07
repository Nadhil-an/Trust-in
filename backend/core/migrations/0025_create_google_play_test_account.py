from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_google_play_tester(apps, schema_editor):
    User = apps.get_model('core', 'User')
    Member = apps.get_model('hr_module', 'Member')

    phone = '9895000001'
    username = '9895000001'
    password_hash = make_password('TrustReview@2026')

    user = User.objects.filter(username=username).first()
    if not user:
        user = User.objects.create(
            username=username,
            password=password_hash,
            full_name='Google Review Tester',
            email='tester@sreelakshmicharity.org',
            phone=phone,
            role='MEMBER',
            is_active=True,
            is_staff=False,
            is_superuser=False,
        )
    else:
        user.password = password_hash
        user.full_name = 'Google Review Tester'
        user.email = 'tester@sreelakshmicharity.org'
        user.phone = phone
        user.role = 'MEMBER'
        user.is_active = True
        user.save()

    member = Member.objects.filter(created_by=user).first()
    if not member:
        m_id = '9999'
        while Member.objects.filter(member_id=m_id).exists():
            m_id = str(int(m_id) + 1)
        Member.objects.create(
            member_id=m_id,
            full_name='Google Review Tester',
            phone=phone,
            email='tester@sreelakshmicharity.org',
            status='ACTIVE',
            is_verified=True,
            membership_type='LIFETIME',
            created_by=user,
            referral_code='slt-999999',
        )
    else:
        member.full_name = 'Google Review Tester'
        member.phone = phone
        member.email = 'tester@sreelakshmicharity.org'
        member.status = 'ACTIVE'
        member.is_verified = True
        member.save()

def remove_google_play_tester(apps, schema_editor):
    User = apps.get_model('core', 'User')
    User.objects.filter(username='9895000001').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_bestmemberbadgetier_bestmemberoffer_and_more'),
        ('hr_module', '0028_alter_staffbonusaccount_staff_memberreferralcode'),
    ]

    operations = [
        migrations.RunPython(create_google_play_tester, remove_google_play_tester),
    ]
