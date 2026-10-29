"""Core shared URL patterns — users, audit log, notifications, search, social platform admin"""
from django.urls import path
from core import views, reward_views

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'events', views.EventViewSet, basename='events')
router.register(r'member-posts', views.MemberPostViewSet, basename='member-posts')
router.register(r'verifications', views.MemberVerificationViewSet, basename='verifications')
router.register(r'pom-messages', views.PublicCooperationMessageViewSet, basename='pom-messages')
router.register(r'social-polls', views.SocialPollViewSet, basename='social-polls')

urlpatterns = [
    path('users/', views.UserListCreateView.as_view(), name='user_list'),
    path('users/<uuid:pk>/', views.UserDetailView.as_view(), name='user_detail'),
    path('users/<uuid:pk>/toggle-follow/', views.ToggleFollowView.as_view(), name='toggle_follow'),
    path('users/<uuid:pk>/member-profile/', views.MemberProfileView.as_view(), name='member_profile'),
    path('users/<uuid:pk>/followers/', views.UserFollowersListView.as_view(), name='user_followers'),
    path('users/<uuid:pk>/following/', views.UserFollowingListView.as_view(), name='user_following'),
    path('members/search/', views.MemberSearchView.as_view(), name='member_search'),
    path('audit-log/', views.AuditLogListView.as_view(), name='audit_log'),
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/unread_count/', views.NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('notifications/<str:pk>/read/', views.NotificationMarkReadView.as_view(), name='notification_read'),
    path('search/', views.GlobalSearchView.as_view(), name='global_search'),
    path('features/', views.RoleFeaturePermissionView.as_view(), name='features'),
    path('update-push-token/', views.ExpoPushTokenView.as_view(), name='update_push_token'),
    path('social-analytics/', views.SocialAnalyticsView.as_view(), name='social_analytics'),

    # ─── Free Offers for Best Members Reward Endpoints ─────────────────────────
    path('rewards/summary/', reward_views.MemberRewardSummaryView.as_view(), name='member_reward_summary'),
    path('rewards/offers/<uuid:offer_id>/redeem/', reward_views.MemberOfferRedeemView.as_view(), name='member_offer_redeem'),
    path('rewards/admin/overview/', reward_views.AdminRewardOverviewView.as_view(), name='admin_reward_overview'),
    path('rewards/admin/members/', reward_views.AdminRewardMembersView.as_view(), name='admin_reward_members'),
    path('rewards/admin/tiers/', reward_views.AdminBadgeTiersView.as_view(), name='admin_badge_tiers'),
    path('rewards/admin/tiers/<uuid:tier_id>/', reward_views.AdminBadgeTiersView.as_view(), name='admin_badge_tier_detail'),
    path('rewards/admin/offers/', reward_views.AdminRewardOffersView.as_view(), name='admin_reward_offers'),
    path('rewards/admin/offers/<uuid:offer_id>/', reward_views.AdminRewardOffersView.as_view(), name='admin_reward_offer_detail'),
    path('rewards/admin/redemptions/', reward_views.AdminRedemptionsView.as_view(), name='admin_redemptions'),
    path('rewards/admin/redemptions/<uuid:redemption_id>/fulfill/', reward_views.AdminRedemptionsView.as_view(), name='admin_redemption_fulfill'),
] + router.urls
