from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import (
    User, Role, MemberPost, MemberPostCategory, MemberPostStatus,
    MemberVerificationRequest, VerificationStatus,
    PublicCooperationMessage, POMCategory, POMStatus,
    SocialPoll, SocialPollOption, SocialPollVote, PollStatus
)
from hr_module.models import Member

class SocialPlatformAdminTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_social',
            email='admin_social@trust.org',
            full_name='Admin Social',
            role=Role.ADMIN,
            password='Password@123'
        )
        self.member_user = User.objects.create_user(
            username='member_user1',
            email='member1@trust.org',
            full_name='Member User',
            role=Role.MEMBER,
            password='Password@123'
        )
        self.member = Member.objects.create(
            member_id='9991',
            full_name='Member User',
            created_by=self.member_user
        )

    def test_social_analytics_view(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/core/social-analytics/?period=30d')
        self.assertEqual(res.status_code, 200)
        self.assertIn('summary', res.data)
        self.assertIn('charts', res.data)
        self.assertIn('total_members', res.data['summary'])

    def test_member_verification_flow(self):
        req = MemberVerificationRequest.objects.create(
            user=self.member_user,
            member=self.member,
            full_name='Member User',
            id_proof_type='AADHAAR',
            id_proof_number='1234-5678-9012'
        )
        self.client.force_authenticate(user=self.admin)
        
        # Test Approve
        res = self.client.post(f'/api/core/verifications/{req.id}/approve/')
        self.assertEqual(res.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, VerificationStatus.APPROVED)
        self.member_user.refresh_from_db()
        self.assertTrue(self.member_user.is_verified)

    def test_pom_message_flow(self):
        self.client.force_authenticate(user=self.admin)
        pom = PublicCooperationMessage.objects.create(
            title='Emergency Blood Needed',
            category=POMCategory.EMERGENCY_BLOOD,
            description='O+ blood required urgently',
            status=POMStatus.PUBLISHED,
            created_by=self.admin
        )
        # Test increment view
        res = self.client.post(f'/api/core/pom-messages/{pom.id}/increment-view/')
        self.assertEqual(res.status_code, 200)
        pom.refresh_from_db()
        self.assertEqual(pom.views_count, 1)

    def test_social_poll_voting_and_duplicate_prevention(self):
        poll = SocialPoll.objects.create(
            title='Community Project Priority',
            description='Choose the main project',
            status=PollStatus.ACTIVE,
            created_by=self.admin
        )
        opt1 = SocialPollOption.objects.create(poll=poll, option_text='Water Purification', order=0)
        opt2 = SocialPollOption.objects.create(poll=poll, option_text='Solar Power', order=1)

        # Cast first vote
        self.client.force_authenticate(user=self.member_user)
        res = self.client.post(f'/api/core/social-polls/{poll.id}/vote/', {'option_id': str(opt1.id)})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(SocialPollVote.objects.filter(poll=poll).count(), 1)

        # Switch vote to second option (must succeed and maintain exactly 1 total vote)
        res2 = self.client.post(f'/api/core/social-polls/{poll.id}/vote/', {'option_id': str(opt2.id)})
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(SocialPollVote.objects.filter(poll=poll).count(), 1)
        vote = SocialPollVote.objects.get(poll=poll, voter=self.member_user)
        self.assertEqual(str(vote.option_id), str(opt2.id))
        opt1.refresh_from_db()
        opt2.refresh_from_db()
        self.assertEqual(opt1.votes_count, 0)
        self.assertEqual(opt2.votes_count, 1)

