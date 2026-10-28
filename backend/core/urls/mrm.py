from django.urls import path
from core import mrm_views

urlpatterns = [
    # Overview
    path('overview/', mrm_views.MRMOverviewView.as_view(), name='mrm_overview'),
    
    # Member Directory & 360 Profiles
    path('members/', mrm_views.MRMMemberDirectoryView.as_view(), name='mrm_members'),
    path('members/<uuid:pk>/', mrm_views.MRMMemberDetailView.as_view(), name='mrm_member_detail'),
    path('members/<uuid:member_id>/interactions/', mrm_views.MRMMemberInteractionsView.as_view(), name='mrm_member_interactions'),
    
    # Tasks & Target Management
    path('tasks/', mrm_views.MRMTasksView.as_view(), name='mrm_tasks'),
    path('tasks/my-tasks/', mrm_views.MRMMyTasksView.as_view(), name='mrm_my_tasks'),
    path('tasks/<uuid:pk>/', mrm_views.MRMTaskDetailView.as_view(), name='mrm_task_detail'),
    path('tasks/<uuid:pk>/submit/', mrm_views.MRMTaskSubmitView.as_view(), name='mrm_task_submit'),
    path('tasks/<uuid:pk>/review/', mrm_views.MRMTaskReviewView.as_view(), name='mrm_task_review'),
    
    # Badges & Recognition
    path('badges/', mrm_views.MRMBadgeDefinitionsView.as_view(), name='mrm_badges'),
    path('badges/<str:badge_key>/', mrm_views.MRMBadgeDefinitionsView.as_view(), name='mrm_badge_detail'),
    path('badges-awards/', mrm_views.MRMBadgeAwardsView.as_view(), name='mrm_badge_awards'),
    path('badges-awards/manual/', mrm_views.MRMBadgeManualAwardView.as_view(), name='mrm_badge_manual_award'),
    path('badges-evaluate/', mrm_views.MRMBadgeEvaluateView.as_view(), name='mrm_badge_evaluate'),
    
    # Achievements
    path('achievements/', mrm_views.MRMAchievementsView.as_view(), name='mrm_achievements'),
    
    # Volunteer Management & Allowances
    path('volunteers/', mrm_views.MRMVolunteersView.as_view(), name='mrm_volunteers'),
    path('volunteers/<uuid:pk>/status/', mrm_views.MRMVolunteersView.as_view(), name='mrm_volunteer_status'),
    path('volunteers/allowances/', mrm_views.MRMVolunteerAllowancesView.as_view(), name='mrm_volunteer_allowances'),
    path('volunteers/allowances/<uuid:pk>/approve/', mrm_views.MRMVolunteerAllowanceApproveView.as_view(), name='mrm_volunteer_allowance_approve'),
    
    # Appreciation Publishing
    path('appreciations/', mrm_views.MRMAppreciationsView.as_view(), name='mrm_appreciations'),
]
