"""
Free Offers for Best Members Reward Views — Sree Lakshmi Charitable Trust
API endpoints for member reward tracking, redemption, and administrative dashboard management.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db.models import Count, Sum, Q
from django.utils import timezone
from decimal import Decimal

from core.models import (
    User,
    BestMemberBadgeTier,
    BestMemberOffer,
    MemberRewardCycle,
    MemberSelfServiceEvent,
    MemberOfferRedemption,
    RewardRedemptionStatus,
    RewardAuditLog,
)
from core.reward_service import (
    is_member_verified,
    get_or_create_active_cycle,
    evaluate_member_rewards,
    get_member_reward_summary,
    redeem_member_offer,
)


class IsRewardAdmin(permissions.BasePermission):
    """Allows access to administrators, managers, and social media team."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return (
            request.user.role in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA'] or
            request.user.is_staff or
            request.user.is_superuser
        )


class MemberRewardSummaryView(APIView):
    """
    GET /api/core/rewards/summary/
    Returns the authenticated member's active cycle progress, earned badge tier,
    metrics (subscription + self-service), and available free offers with cooldowns.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            summary = get_member_reward_summary(request.user)
            return Response(summary, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MemberOfferRedeemView(APIView):
    """
    POST /api/core/rewards/offers/<offer_id>/redeem/
    Allows a verified member to redeem an eligible free offer.
    Enforces independent 20-day cooldown for Petrol and monthly cycle redemption for Recharge/Tour.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, offer_id):
        notes = request.data.get('notes', '').strip()
        try:
            redemption = redeem_member_offer(request.user, offer_id, notes=notes)
            # Fetch fresh summary to return updated statuses
            summary = get_member_reward_summary(request.user)
            return Response({
                'success': True,
                'message': f"Successfully claimed {redemption.offer.title}! Status: {redemption.get_status_display()}.",
                'redemption_id': str(redemption.id),
                'cooldown_until': redemption.cooldown_until.isoformat() if redemption.cooldown_until else None,
                'summary': summary
            }, status=status.HTTP_201_CREATED)
        except ValueError as ve:
            return Response({'error': str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f"Failed to redeem offer: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminRewardOverviewView(APIView):
    """
    GET /api/core/rewards/admin/overview/
    Admin metrics overview for the Social Media / Trust Dashboard.
    """
    permission_classes = [IsRewardAdmin]

    def get(self, request):
        today = timezone.localdate()
        total_verified_members = User.objects.filter(
            Q(is_verified=True) |
            Q(verification_requests__status='APPROVED')
        ).distinct().count()

        active_cycles = MemberRewardCycle.objects.filter(is_active=True).count()
        total_redemptions = MemberOfferRedemption.objects.count()
        pending_redemptions = MemberOfferRedemption.objects.filter(
            status=RewardRedemptionStatus.PENDING_FULFILLMENT
        ).count()

        # Breakdown by badge tier
        tier_counts = []
        for tier in BestMemberBadgeTier.objects.filter(is_active=True).order_by('level_order'):
            count = MemberRewardCycle.objects.filter(is_active=True, earned_badge=tier).count()
            tier_counts.append({
                'tier_key': tier.tier_key,
                'name': tier.name,
                'icon': tier.icon,
                'color': tier.color,
                'active_members': count,
                'min_subscription': float(tier.min_subscription_amount),
                'min_services': tier.min_self_service_count
            })

        # Total subscription collected in active cycles
        sub_sum = MemberRewardCycle.objects.filter(is_active=True).aggregate(total=Sum('subscription_amount'))['total'] or Decimal('0.00')
        srv_sum = MemberRewardCycle.objects.filter(is_active=True).aggregate(total=Sum('self_service_count'))['total'] or 0

        return Response({
            'total_verified_members': total_verified_members,
            'active_cycles': active_cycles,
            'total_redemptions': total_redemptions,
            'pending_redemptions': pending_redemptions,
            'total_subscription_amount': float(sub_sum),
            'total_self_service_actions': srv_sum,
            'tier_distribution': tier_counts
        }, status=status.HTTP_200_OK)


class AdminRewardMembersView(APIView):
    """
    GET /api/core/rewards/admin/members/
    Paginated/searchable list of members, their verification, badge level, and cycle metrics.
    """
    permission_classes = [IsRewardAdmin]

    def get(self, request):
        query = request.query_params.get('search', '').strip()
        tier_filter = request.query_params.get('tier', '').strip()

        users_qs = User.objects.select_related().prefetch_related('reward_cycles__earned_badge').order_by('username')

        if query:
            users_qs = users_qs.filter(
                Q(username__icontains=query) |
                Q(full_name__icontains=query) |
                Q(email__icontains=query)
            )

        members_data = []
        for u in users_qs[:100]:  # limit to top 100 for responsiveness
            verified = is_member_verified(u)
            cycle = MemberRewardCycle.objects.filter(user=u, is_active=True).first()
            badge = cycle.earned_badge if cycle else None

            if tier_filter and (not badge or badge.tier_key != tier_filter):
                continue

            members_data.append({
                'id': str(u.id),
                'username': u.username,
                'full_name': u.full_name,
                'email': u.email,
                'role': u.role,
                'is_verified': verified,
                'badge': {
                    'tier_key': badge.tier_key if badge else 'NONE',
                    'name': badge.name if badge else 'Unranked',
                    'icon': badge.icon if badge else '⭐',
                    'color': badge.color if badge else '#94A3B8'
                } if badge else None,
                'cycle': {
                    'cycle_number': cycle.cycle_number if cycle else 0,
                    'start_date': str(cycle.start_date) if cycle else None,
                    'end_date': str(cycle.end_date) if cycle else None,
                    'subscription_amount': float(cycle.subscription_amount) if cycle else 0.0,
                    'self_service_count': cycle.self_service_count if cycle else 0,
                } if cycle else None,
                'redemptions_count': MemberOfferRedemption.objects.filter(user=u).count()
            })

        return Response({'results': members_data, 'total': len(members_data)}, status=status.HTTP_200_OK)


class AdminBadgeTiersView(APIView):
    """
    GET /api/core/rewards/admin/tiers/
    PUT /api/core/rewards/admin/tiers/<id>/
    Configures badge levels and qualification thresholds without hard-coding.
    """
    permission_classes = [IsRewardAdmin]

    def get(self, request):
        tiers = BestMemberBadgeTier.objects.all().order_by('level_order')
        data = [
            {
                'id': str(t.id),
                'tier_key': t.tier_key,
                'name': t.name,
                'icon': t.icon,
                'color': t.color,
                'min_subscription_amount': float(t.min_subscription_amount),
                'min_self_service_count': t.min_self_service_count,
                'level_order': t.level_order,
                'description': t.description,
                'is_active': t.is_active,
            }
            for t in tiers
        ]
        return Response(data, status=status.HTTP_200_OK)

    def put(self, request, tier_id=None):
        pk = tier_id or request.data.get('id')
        try:
            tier = BestMemberBadgeTier.objects.get(id=pk)
        except BestMemberBadgeTier.DoesNotExist:
            return Response({'error': 'Badge tier not found'}, status=status.HTTP_404_NOT_FOUND)

        if 'min_subscription_amount' in request.data:
            tier.min_subscription_amount = Decimal(str(request.data['min_subscription_amount']))
        if 'min_self_service_count' in request.data:
            tier.min_self_service_count = int(request.data['min_self_service_count'])
        if 'name' in request.data:
            tier.name = request.data['name'].strip()
        if 'icon' in request.data:
            tier.icon = request.data['icon'].strip()
        if 'color' in request.data:
            tier.color = request.data['color'].strip()
        if 'description' in request.data:
            tier.description = request.data['description'].strip()
        if 'is_active' in request.data:
            tier.is_active = bool(request.data['is_active'])

        tier.save()
        return Response({
            'success': True,
            'message': f"Updated {tier.name} badge qualification thresholds.",
            'tier': {
                'id': str(tier.id),
                'tier_key': tier.tier_key,
                'name': tier.name,
                'min_subscription_amount': float(tier.min_subscription_amount),
                'min_self_service_count': tier.min_self_service_count
            }
        }, status=status.HTTP_200_OK)


class AdminRewardOffersView(APIView):
    """
    GET /api/core/rewards/admin/offers/
    PUT /api/core/rewards/admin/offers/<id>/
    Configures reward offers, reward values, and cooldown policies.
    """
    permission_classes = [IsRewardAdmin]

    def get(self, request):
        offers = BestMemberOffer.objects.select_related('min_badge_tier').all().order_by('reward_value')
        data = [
            {
                'id': str(o.id),
                'offer_key': o.offer_key,
                'title': o.title,
                'reward_value': float(o.reward_value),
                'cooldown_days': o.cooldown_days,
                'cooldown_independent': o.cooldown_independent,
                'min_badge_tier_id': str(o.min_badge_tier_id) if o.min_badge_tier_id else None,
                'min_badge_tier_name': o.min_badge_tier.name if o.min_badge_tier else 'Any Verified',
                'description': o.description,
                'terms_conditions': o.terms_conditions,
                'is_active': o.is_active,
            }
            for o in offers
        ]
        return Response(data, status=status.HTTP_200_OK)

    def put(self, request, offer_id=None):
        pk = offer_id or request.data.get('id')
        try:
            offer = BestMemberOffer.objects.get(id=pk)
        except BestMemberOffer.DoesNotExist:
            return Response({'error': 'Offer not found'}, status=status.HTTP_404_NOT_FOUND)

        if 'reward_value' in request.data:
            offer.reward_value = Decimal(str(request.data['reward_value']))
        if 'cooldown_days' in request.data:
            offer.cooldown_days = int(request.data['cooldown_days'])
        if 'cooldown_independent' in request.data:
            offer.cooldown_independent = bool(request.data['cooldown_independent'])
        if 'title' in request.data:
            offer.title = request.data['title'].strip()
        if 'description' in request.data:
            offer.description = request.data['description'].strip()
        if 'terms_conditions' in request.data:
            offer.terms_conditions = request.data['terms_conditions'].strip()
        if 'is_active' in request.data:
            offer.is_active = bool(request.data['is_active'])
        if 'min_badge_tier_id' in request.data:
            tier_id = request.data['min_badge_tier_id']
            offer.min_badge_tier_id = tier_id if tier_id else None

        offer.save()
        return Response({
            'success': True,
            'message': f"Updated {offer.title} offer settings.",
            'offer': {
                'id': str(offer.id),
                'title': offer.title,
                'reward_value': float(offer.reward_value),
                'cooldown_days': offer.cooldown_days
            }
        }, status=status.HTTP_200_OK)


class AdminRedemptionsView(APIView):
    """
    GET /api/core/rewards/admin/redemptions/
    POST /api/core/rewards/admin/redemptions/<id>/fulfill/
    Monitors and fulfills member reward claims.
    """
    permission_classes = [IsRewardAdmin]

    def get(self, request):
        status_filter = request.query_params.get('status', '').strip()
        redemptions_qs = MemberOfferRedemption.objects.select_related(
            'user', 'offer', 'cycle', 'fulfilled_by'
        ).order_by('-redeemed_at')

        if status_filter:
            redemptions_qs = redemptions_qs.filter(status=status_filter)

        data = [
            {
                'id': str(r.id),
                'user': {
                    'id': str(r.user.id),
                    'username': r.user.username,
                    'full_name': r.user.full_name,
                },
                'offer': {
                    'id': str(r.offer.id),
                    'offer_key': r.offer.offer_key,
                    'title': r.offer.title,
                },
                'reward_value': float(r.reward_value),
                'status': r.status,
                'status_display': r.get_status_display(),
                'redeemed_at': r.redeemed_at.isoformat(),
                'cooldown_until': r.cooldown_until.isoformat() if r.cooldown_until else None,
                'fulfilled_at': r.fulfilled_at.isoformat() if r.fulfilled_at else None,
                'fulfilled_by_name': r.fulfilled_by.full_name if r.fulfilled_by else None,
                'notes': r.notes,
                'admin_remarks': r.admin_remarks,
            }
            for r in redemptions_qs[:100]
        ]
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, redemption_id):
        action = request.data.get('action', 'FULFILL')  # 'FULFILL' or 'REJECT'
        admin_remarks = request.data.get('admin_remarks', '').strip()

        try:
            redemption = MemberOfferRedemption.objects.select_related('user', 'offer').get(id=redemption_id)
        except MemberOfferRedemption.DoesNotExist:
            return Response({'error': 'Redemption record not found'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'FULFILL':
            redemption.status = RewardRedemptionStatus.FULFILLED
            redemption.fulfilled_at = timezone.now()
            redemption.fulfilled_by = request.user
            redemption.admin_remarks = admin_remarks
            redemption.save(update_fields=['status', 'fulfilled_at', 'fulfilled_by', 'admin_remarks', 'updated_at'])

            RewardAuditLog.objects.create(
                user=redemption.user,
                actor=request.user,
                action='OFFER_FULFILLED',
                description=f"Admin {request.user.full_name} marked {redemption.offer.title} (₹{redemption.reward_value}) as Fulfilled for {redemption.user.username}.",
                metadata={'redemption_id': str(redemption.id), 'remarks': admin_remarks}
            )
            return Response({'success': True, 'message': 'Reward marked as fulfilled.'}, status=status.HTTP_200_OK)

        elif action == 'REJECT':
            redemption.status = RewardRedemptionStatus.REJECTED
            redemption.admin_remarks = admin_remarks
            # Clear cooldown on rejection so member can re-claim if rejected due to typo
            redemption.cooldown_until = None
            redemption.save(update_fields=['status', 'cooldown_until', 'admin_remarks', 'updated_at'])

            RewardAuditLog.objects.create(
                user=redemption.user,
                actor=request.user,
                action='OFFER_REJECTED',
                description=f"Admin {request.user.full_name} rejected reward claim for {redemption.offer.title} of {redemption.user.username}. Reason: {admin_remarks}",
                metadata={'redemption_id': str(redemption.id), 'remarks': admin_remarks}
            )
            return Response({'success': True, 'message': 'Reward claim rejected.'}, status=status.HTTP_200_OK)

        return Response({'error': 'Invalid action. Choose FULFILL or REJECT.'}, status=status.HTTP_400_BAD_REQUEST)

