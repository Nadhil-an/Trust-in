import logging
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q, Count, Sum
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from core.models import (
    MemberInteraction,
    MemberTask,
    BadgeDefinition,
    MemberBadge,
    MemberAchievement,
    VolunteerAllowanceRecord,
    MemberAppreciation,
    MemberPost,
    MemberPostImage,
    User,
    TaskStatus,
    AuditLog,
)
from hr_module.models import Member, Volunteer
from core.mrm_serializers import (
    MemberInteractionSerializer,
    MemberTaskSerializer,
    BadgeDefinitionSerializer,
    MemberBadgeSerializer,
    MemberAchievementSerializer,
    VolunteerAllowanceRecordSerializer,
    MemberAppreciationSerializer,
    MRMMemberDetailSerializer,
)
from core.mrm_services import BadgeEngine, TaskWorkflowService, VolunteerAllowanceService
from notify.service import push_notification

logger = logging.getLogger(__name__)


class MRMOverviewView(APIView):
    """
    Overview analytics cards for Social Media Dashboard MRM hub.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        current_period = f"{today.year}-{today.month:02d}"

        total_members = Member.objects.count()
        verified_members = Member.objects.filter(is_verified=True).count()
        active_tasks = MemberTask.objects.filter(status__in=[TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]).count()
        pending_reviews = MemberTask.objects.filter(status=TaskStatus.SUBMITTED).count()
        overdue_tasks = MemberTask.objects.filter(due_date__lt=today, status__in=[TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED]).count()
        
        badges_distributed = MemberBadge.objects.count()
        period_badges = MemberBadge.objects.filter(qualifying_period=current_period).count()
        
        active_volunteers = Volunteer.objects.filter(status='APPROVED').count()
        pending_volunteers = Volunteer.objects.filter(status='PENDING').count()
        pending_allowances = VolunteerAllowanceRecord.objects.filter(status='PENDING').count()
        
        recent_appreciations = MemberAppreciation.objects.select_related('member', 'badge', 'post').order_by('-created_at')[:5]
        appreciations_data = MemberAppreciationSerializer(recent_appreciations, many=True, context={'request': request}).data

        # Badge counts by tier
        badge_distribution = {}
        for b in BadgeDefinition.objects.all():
            count = MemberBadge.objects.filter(badge=b).count()
            badge_distribution[b.badge_key] = {
                'name': b.name,
                'icon': b.icon,
                'color': b.color,
                'count': count
            }

        return Response({
            'period': current_period,
            'members': {
                'total': total_members,
                'verified': verified_members,
            },
            'tasks': {
                'active': active_tasks,
                'pending_review': pending_reviews,
                'overdue': overdue_tasks,
            },
            'badges': {
                'total_distributed': badges_distributed,
                'period_awarded': period_badges,
                'distribution': badge_distribution,
            },
            'volunteers': {
                'active': active_volunteers,
                'pending_applications': pending_volunteers,
                'pending_allowances': pending_allowances,
            },
            'recent_appreciations': appreciations_data
        })


class MRMMemberDirectoryView(APIView):
    """
    Search and filter registered members for MRM directory.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        status_filter = request.query_params.get('status')
        verified_filter = request.query_params.get('is_verified')
        badge_filter = request.query_params.get('badge')
        membership_type = request.query_params.get('membership_type')

        qs = Member.objects.all().order_by('-joining_date')

        if q:
            qs = qs.filter(
                Q(member_id__icontains=q) |
                Q(full_name__icontains=q) |
                Q(email__icontains=q)
            )

        if status_filter:
            qs = qs.filter(status=status_filter)

        if verified_filter is not None and verified_filter != '':
            is_v = verified_filter.lower() in ['true', '1', 'yes']
            qs = qs.filter(is_verified=is_v)

        if membership_type:
            qs = qs.filter(membership_type=membership_type)

        if badge_filter:
            member_ids_with_badge = MemberBadge.objects.filter(
                badge__badge_key__iexact=badge_filter
            ).values_list('member_id', flat=True)
            qs = qs.filter(id__in=member_ids_with_badge)

        # Pagination limit
        limit = int(request.query_params.get('limit', 50))
        members = qs[:limit]

        serializer = MRMMemberDetailSerializer(members, many=True, context={'request': request})
        return Response({
            'count': qs.count(),
            'results': serializer.data
        })


class MRMMemberDetailView(APIView):
    """
    Detailed 360 profile for a single member.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            member = Member.objects.get(pk=pk)
        except Member.DoesNotExist:
            return Response({'detail': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MRMMemberDetailSerializer(member, context={'request': request})
        return Response(serializer.data)


class MRMMemberInteractionsView(APIView):
    """
    Follow-up interactions and confidential administrative notes.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, member_id):
        try:
            member = Member.objects.get(pk=member_id)
        except Member.DoesNotExist:
            return Response({'detail': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

        interactions = MemberInteraction.objects.filter(member=member).order_by('-created_at')
        serializer = MemberInteractionSerializer(interactions, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, member_id):
        try:
            member = Member.objects.get(pk=member_id)
        except Member.DoesNotExist:
            return Response({'detail': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MemberInteractionSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            interaction = serializer.save(
                member=member,
                created_by=request.user
            )
            return Response(MemberInteractionSerializer(interaction, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MRMTasksView(APIView):
    """
    Member task management: creation, assignment, filtering.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        member_id = request.query_params.get('member_id')
        status_filter = request.query_params.get('status')
        category_filter = request.query_params.get('category')
        responsible_staff = request.query_params.get('responsible_staff')

        qs = MemberTask.objects.all().select_related('member', 'assigned_by', 'responsible_staff', 'reviewed_by').order_by('-due_date')

        if member_id:
            qs = qs.filter(member_id=member_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if category_filter:
            qs = qs.filter(category=category_filter)
        if responsible_staff:
            qs = qs.filter(responsible_staff_id=responsible_staff)

        serializer = MemberTaskSerializer(qs[:100], many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MemberTaskSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            task = serializer.save(assigned_by=request.user)
            
            # Send notification to assigned member if linked to User
            user_match = getattr(task.member, 'created_by', None) or User.objects.filter(full_name__iexact=task.member.full_name).first()
            if user_match:
                try:
                    push_notification(
                        recipient=user_match,
                        title=f"📋 New Task Assigned: {task.title}",
                        message=f"You have been assigned task #{task.task_number}. Target: {task.target_value} {task.target_unit}. Deadline: {task.due_date}.",
                        notification_type='SYSTEM'
                    )
                except Exception as e:
                    logger.warning(f"Could not send task notification: {e}")

            return Response(MemberTaskSerializer(task, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MRMTaskDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            task = MemberTask.objects.get(pk=pk)
        except MemberTask.DoesNotExist:
            return Response({'detail': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(MemberTaskSerializer(task, context={'request': request}).data)

    def patch(self, request, pk):
        try:
            task = MemberTask.objects.get(pk=pk)
        except MemberTask.DoesNotExist:
            return Response({'detail': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = MemberTaskSerializer(task, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated = serializer.save()
            return Response(MemberTaskSerializer(updated, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            task = MemberTask.objects.get(pk=pk)
            task.delete()
            return Response({'detail': 'Task deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)
        except MemberTask.DoesNotExist:
            return Response({'detail': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)


class MRMTaskSubmitView(APIView):
    """
    Member submits progress or evidence.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        try:
            task = MemberTask.objects.get(pk=pk)
        except MemberTask.DoesNotExist:
            return Response({'detail': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        achieved_value = request.data.get('achieved_value', task.achieved_value)
        evidence_notes = request.data.get('evidence_notes', '')
        evidence_file = request.FILES.get('evidence_file')

        updated = TaskWorkflowService.submit_task_progress(
            task=task,
            achieved_value=achieved_value,
            evidence_notes=evidence_notes,
            evidence_file=evidence_file
        )

        # Notify responsible staff or manager
        if updated.responsible_staff:
            try:
                push_notification(
                    recipient=updated.responsible_staff,
                    title=f"Task Submitted for Review: #{updated.task_number}",
                    message=f"{updated.member.full_name} has submitted progress for '{updated.title}'.",
                    notification_type='SYSTEM'
                )
            except Exception:
                pass

        return Response(MemberTaskSerializer(updated, context={'request': request}).data)


class MRMTaskReviewView(APIView):
    """
    Staff reviews and approves/rejects submitted tasks.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            task = MemberTask.objects.get(pk=pk)
        except MemberTask.DoesNotExist:
            return Response({'detail': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)

        target_status = request.data.get('status')
        review_notes = request.data.get('review_notes', '')
        achieved_value = request.data.get('achieved_value')

        try:
            updated = TaskWorkflowService.review_task(
                task=task,
                reviewer=request.user,
                status=target_status,
                review_notes=review_notes,
                achieved_value=achieved_value
            )
            return Response(MemberTaskSerializer(updated, context={'request': request}).data)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MRMMyTasksView(APIView):
    """
    Assigned tasks for the authenticated user/member.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        member = None
        from core.serializers import get_user_member
        member = get_user_member(request.user)
        if not member:
            return Response([])

        tasks = MemberTask.objects.filter(member=member).order_by('-due_date')
        return Response(MemberTaskSerializer(tasks, many=True, context={'request': request}).data)


class MRMBadgeDefinitionsView(APIView):
    """
    List and configure badge definitions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        badges = BadgeDefinition.objects.all().order_by('daily_collection_target')
        return Response(BadgeDefinitionSerializer(badges, many=True).data)

    def patch(self, request, badge_key):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            badge = BadgeDefinition.objects.get(badge_key=badge_key)
        except BadgeDefinition.DoesNotExist:
            return Response({'detail': 'Badge not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BadgeDefinitionSerializer(badge, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            return Response(BadgeDefinitionSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MRMBadgeAwardsView(APIView):
    """
    List of earned badges across members.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        member_id = request.query_params.get('member_id')
        badge_key = request.query_params.get('badge_key')
        period = request.query_params.get('period')

        qs = MemberBadge.objects.all().select_related('member', 'badge', 'awarded_by').order_by('-awarded_at')
        if member_id:
            qs = qs.filter(member_id=member_id)
        if badge_key:
            qs = qs.filter(badge__badge_key=badge_key)
        if period:
            qs = qs.filter(qualifying_period=period)

        return Response(MemberBadgeSerializer(qs[:100], many=True, context={'request': request}).data)


class MRMBadgeManualAwardView(APIView):
    """
    Manually award badge with mandatory reason.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get('member_id')
        badge_key = request.data.get('badge_key')
        reason = request.data.get('reason')
        is_permanent = bool(request.data.get('is_permanent', False))
        period_str = request.data.get('period_str')

        if not member_id or not badge_key or not reason:
            return Response({'detail': 'member_id, badge_key, and a mandatory reason are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = Member.objects.get(pk=member_id)
        except Member.DoesNotExist:
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            award = BadgeEngine.award_badge_manually(
                member=member,
                badge_key=badge_key,
                awarded_by=request.user,
                reason=reason,
                period_str=period_str,
                is_permanent=is_permanent
            )
            return Response(MemberBadgeSerializer(award, context={'request': request}).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MRMBadgeEvaluateView(APIView):
    """
    Trigger automatic badge evaluation for a member or all members.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get('member_id')
        period_str = request.data.get('period_str') or BadgeEngine.get_current_period()

        if member_id:
            try:
                member = Member.objects.get(pk=member_id)
                awards = BadgeEngine.evaluate_member(member, period_str, awarded_by=request.user)
                return Response({
                    'message': f"Evaluated member {member.full_name}",
                    'new_awards_count': len(awards),
                    'awards': MemberBadgeSerializer(awards, many=True, context={'request': request}).data
                })
            except Member.DoesNotExist:
                return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            total_awarded = 0
            for member in Member.objects.filter(status='ACTIVE')[:200]:
                awards = BadgeEngine.evaluate_member(member, period_str, awarded_by=request.user)
                total_awarded += len(awards)

            return Response({
                'message': f"Batch badge evaluation completed for {period_str}.",
                'total_new_awards': total_awarded
            })


class MRMAchievementsView(APIView):
    """
    List and grant achievements.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        member_id = request.query_params.get('member_id')
        qs = MemberAchievement.objects.all().select_related('member', 'awarded_by').order_by('-awarded_at')
        if member_id:
            qs = qs.filter(member_id=member_id)
        return Response(MemberAchievementSerializer(qs[:100], many=True).data)

    def post(self, request):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MemberAchievementSerializer(data=request.data)
        if serializer.is_valid():
            ach = serializer.save(
                awarded_by=request.user,
                award_source='MANUAL'
            )
            return Response(MemberAchievementSerializer(ach).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MRMVolunteersView(APIView):
    """
    Volunteer application review and management.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status')
        qs = Volunteer.objects.all().order_by('-created_at')
        if status_filter:
            qs = qs.filter(status=status_filter)

        results = []
        for v in qs[:100]:
            # Check if this volunteer has Green Badge
            member_match = Member.objects.filter(Q(full_name__iexact=v.full_name) | Q(phone=v.phone)).first()
            has_green = False
            if member_match:
                has_green = MemberBadge.objects.filter(member=member_match, badge__badge_key='GREEN').exists()

            results.append({
                'id': str(v.id),
                'volunteer_id': v.volunteer_id,
                'full_name': v.full_name,
                'status': v.status,
                'phone': str(v.phone or ''),
                'email': v.email,
                'skills': v.skills,
                'availability': v.availability,
                'total_hours': str(v.total_hours),
                'joining_date': str(v.joining_date),
                'has_green_badge': has_green,
                'created_at': v.created_at.isoformat() if v.created_at else None
            })
        return Response(results)

    def patch(self, request, pk):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            vol = Volunteer.objects.get(pk=pk)
        except Volunteer.DoesNotExist:
            return Response({'detail': 'Volunteer not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        rejection_reason = request.data.get('rejection_reason', '')

        if new_status == 'APPROVED':
            new_status = 'ACTIVE'

        if new_status in ['ACTIVE', 'REJECTED', 'INACTIVE', 'SUSPENDED', 'PENDING']:
            vol.status = new_status
            if new_status == 'ACTIVE':
                vol.approved_by = request.user
                vol.approved_at = timezone.now()
                # Check Maroon Badge qualification
                member_match = Member.objects.filter(Q(full_name__iexact=vol.full_name) | Q(phone=vol.phone)).first()
                if member_match:
                    try:
                        BadgeEngine.evaluate_member(member_match)
                    except Exception as e:
                        logger.warning(f"Badge evaluation failed: {e}")
            elif new_status == 'REJECTED':
                vol.rejection_reason = rejection_reason
            vol.save()
            return Response({'detail': f'Volunteer status updated to {new_status}'})
        return Response({'detail': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


class MRMVolunteerAllowancesView(APIView):
    """
    Volunteer monthly allowance tracker:
    Petrol ₹2,000 | Mobile ₹399 | Trip ₹3,000 | Total Limit ₹5,399
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        status_filter = request.query_params.get('status')

        qs = VolunteerAllowanceRecord.objects.all().select_related('volunteer', 'approved_by').order_by('-year', '-month')
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response(VolunteerAllowanceRecordSerializer(qs[:100], many=True).data)

    def post(self, request):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        volunteer_id = request.data.get('volunteer_id')
        month = int(request.data.get('month', timezone.localdate().month))
        year = int(request.data.get('year', timezone.localdate().year))
        petrol = request.data.get('petrol_allowance', 2000.00)
        recharge = request.data.get('recharge_allowance', 399.00)
        trip = request.data.get('trip_allowance', 3000.00)
        notes = request.data.get('notes', '')

        try:
            vol = Volunteer.objects.get(pk=volunteer_id)
        except Volunteer.DoesNotExist:
            return Response({'detail': 'Volunteer not found.'}, status=status.HTTP_404_NOT_FOUND)

        record = VolunteerAllowanceService.create_or_update_record(
            volunteer=vol,
            month=month,
            year=year,
            petrol=petrol,
            recharge=recharge,
            trip=trip,
            notes=notes,
            requested_by=request.user
        )
        return Response(VolunteerAllowanceRecordSerializer(record).data, status=status.HTTP_201_CREATED)


class MRMVolunteerAllowanceApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA', 'HR']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        status_choice = request.data.get('status', 'APPROVED')
        notes = request.data.get('notes', '')

        try:
            record = VolunteerAllowanceService.approve_allowance(
                record_id=pk,
                approved_by=request.user,
                status=status_choice,
                notes=notes
            )
            return Response(VolunteerAllowanceRecordSerializer(record).data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MRMAppreciationsView(APIView):
    """
    Official Trust Appreciation Publishing:
    Creates an official recognition post using Phase 1 MemberPost infrastructure,
    linked with MemberAppreciation, badge selection, and sends notification to member.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = MemberAppreciation.objects.all().select_related('member', 'badge', 'post', 'approved_by').order_by('-created_at')
        return Response(MemberAppreciationSerializer(qs[:50], many=True, context={'request': request}).data)

    def post(self, request):
        if request.user.role not in ['ADMIN', 'MANAGER', 'SOCIAL_MEDIA']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get('member_id')
        badge_key = request.data.get('badge_key')
        title = request.data.get('title', '').strip()
        description = request.data.get('description', '').strip()
        category = request.data.get('recognition_category', 'COMMUNITY_SERVICE')
        image = request.FILES.get('image')

        if not member_id or not title:
            return Response({'detail': 'member_id and title are required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = Member.objects.get(pk=member_id)
        except Member.DoesNotExist:
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        badge = None
        if badge_key:
            badge = BadgeDefinition.objects.filter(badge_key=badge_key).first()

        badge_badge_text = f" [{badge.icon} {badge.name}]" if badge else ""
        post_caption = f"🏆 OFFICIAL TRUST APPRECIATION{badge_badge_text}\n\nRecognizing: {member.full_name}\n\n{description}"

        # Create Official Post using existing Phase 1 MemberPost infrastructure
        post = MemberPost.objects.create(
            author=request.user,
            title=title,
            description=post_caption,
            post_type='OFFICIAL',
            post_category='ANNOUNCEMENT',
            approval_status='APPROVED',
            approved_by=request.user,
            approved_at=timezone.now(),
            is_active=True
        )

        if image:
            MemberPostImage.objects.create(post=post, image=image)

        appreciation = MemberAppreciation.objects.create(
            post=post,
            member=member,
            badge=badge,
            recognition_category=category,
            approval_status='APPROVED',
            approved_by=request.user,
            approved_at=timezone.now()
        )

        # Notify recognized member
        user_match = getattr(member, 'created_by', None) or User.objects.filter(full_name__iexact=member.full_name).first()
        if user_match:
            try:
                push_notification(
                    recipient=user_match,
                    title=f"🌟 Trust Appreciation: {title}",
                    message=f"You have been officially recognized by the Trust: {title}",
                    notification_type='SYSTEM'
                )
            except Exception:
                pass

        return Response(MemberAppreciationSerializer(appreciation, context={'request': request}).data, status=status.HTTP_201_CREATED)
