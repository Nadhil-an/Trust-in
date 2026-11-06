"""
hr_module/bonus_service.py
─────────────────────────
Service functions for staff bonus & commission calculation.

Rules:
  1. Donation Bonus: 10% of donation amount (Rs100 per Rs1000 collected)
     - Staff who collects/creates the donation gets 10%
     - If donor is a referred member, the referring member also gets 10%
  2. Membership Bonus: 30% of membership fee per new member enrolled
     - Staff who enrolled the member gets 30% (Rs30 per Rs100)
     - When referral code is used, the referring member gets 30% (Rs30)
  3. Bonus Account Management:
     - Donation-based and membership-based bonuses tracked separately
     - Each staff/member has a separate bonus balance
     - All bonus transactions recorded for transparency
"""
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

DONATION_BONUS_BASE_RATE = Decimal('0.10')       # 10%
DONATION_BONUS_TIER_RATE = Decimal('0.15')       # 15%
DONATION_BONUS_THRESHOLD = Decimal('150000.00')  # Rs 1,50,000 threshold in one month


def get_staff_donation_bonus_rate(staff_user, target_date=None):
    """
    Determine the donation incentive rate for a staff member.
    Policy:
    - Base rate: 10% on every donation collected.
    - Tier threshold: Once staff achieves >= Rs 1,50,000 in monthly donation collections,
      from that month onwards (or for that month once achieved), the rate increases to 15%.
    """
    if not staff_user:
        return DONATION_BONUS_BASE_RATE

    from accounts_module.models import Income
    from django.db.models import Sum
    from datetime import date
    from django.utils import timezone

    if target_date is None:
        target_date = timezone.now().date()
    elif hasattr(target_date, 'date'):
        target_date = target_date.date()

    # 1. Check if staff achieved >= Rs 1,50,000 in this target month
    curr_month_total = Income.objects.filter(
        created_by=staff_user,
        date__year=target_date.year,
        date__month=target_date.month
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')

    if Decimal(str(curr_month_total)) >= DONATION_BONUS_THRESHOLD:
        return DONATION_BONUS_TIER_RATE

    # 2. Check if staff achieved >= Rs 1,50,000 in any prior month on or before target_date
    prior_groups = Income.objects.filter(
        created_by=staff_user,
        date__lte=target_date
    ).values('date__year', 'date__month').annotate(total=Sum('amount'))

    for entry in prior_groups:
        if Decimal(str(entry['total'] or 0)) >= DONATION_BONUS_THRESHOLD:
            ey = entry['date__year']
            em = entry['date__month']
            if (ey < target_date.year) or (ey == target_date.year and em <= target_date.month):
                return DONATION_BONUS_TIER_RATE

    return DONATION_BONUS_BASE_RATE


def _upgrade_staff_month_donations_to_tier(staff_user, account, year, month):
    """
    When a staff member achieves the Rs 1,50,000 milestone in a month, upgrade
    any existing 10% donation transactions in that month to 15%.
    """
    from hr_module.models import StaffBonusTransaction
    from accounts_module.models import Income

    month_txns = StaffBonusTransaction.objects.filter(
        bonus_account=account,
        direction=StaffBonusTransaction.TxnDirection.CREDIT,
        bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS,
        created_at__year=year,
        created_at__month=month
    )
    for txn in month_txns:
        if txn.income_id:
            inc = Income.objects.filter(receipt_number=txn.income_id).first()
            if inc:
                expected_amount = (Decimal(str(inc.amount)) * DONATION_BONUS_TIER_RATE).quantize(Decimal('0.01'))
                if txn.amount != expected_amount:
                    diff = expected_amount - txn.amount
                    txn.amount = expected_amount
                    txn.description = f"15% donation incentive on Rs{inc.amount} collected (Receipt: {inc.receipt_number})"
                    txn.save(update_fields=['amount', 'description'])
                    account.donation_bonus_balance += diff
                    account.save(update_fields=['donation_bonus_balance', 'updated_at'])


def _get_or_create_bonus_account(user):
    """Get or create a bonus account for a staff member or referring user."""
    from hr_module.models import StaffBonusAccount
    account, _ = StaffBonusAccount.objects.get_or_create(staff=user)
    return account


def credit_donation_bonus(income):
    """
    Credit donation incentive:
    - Base rate: 10% on every donation.
    - Achieved rate: 15% once staff achieves Rs 1,50,000 in one month.
    1. To the staff member who collected/created the donation.
    2. To the referring member if the donor was enrolled via a referral code.
    
    Args:
        income: accounts_module.models.Income instance
    """
    from hr_module.models import StaffBonusAccount, StaffBonusTransaction
    from core.models import Role
    from django.utils import timezone

    amount = Decimal(str(income.amount or 0))
    if amount <= 0:
        return None

    income_date = income.date or timezone.now().date()
    credited_txns = []

    # ── 1. Staff collector bonus ──────────────────────────────────
    staff_user = income.created_by
    if staff_user and staff_user.role in [
        Role.STAFF, Role.FIELD_ASSESSMENT_OFFICER,
        Role.ASSESSMENT_CALCULATION_OFFICER, Role.GENERAL_ENQUIRY_OFFICER
    ]:
        rate = get_staff_donation_bonus_rate(staff_user, income_date)
        rate_pct = int(rate * 100)
        bonus_amount = (amount * rate).quantize(Decimal('0.01'))

        account = _get_or_create_bonus_account(staff_user)

        # Check existing transaction for this income to avoid duplicates
        existing = StaffBonusTransaction.objects.filter(
            bonus_account=account,
            income_id=income.receipt_number or str(income.id),
            direction=StaffBonusTransaction.TxnDirection.CREDIT,
            bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS
        ).first()

        if existing:
            if existing.amount != bonus_amount or f"{rate_pct}%" not in existing.description:
                diff = bonus_amount - existing.amount
                existing.amount = bonus_amount
                existing.description = (
                    f"{rate_pct}% donation incentive on Rs{amount} collected "
                    f"(Receipt: {income.receipt_number})"
                )
                existing.save(update_fields=['amount', 'description'])
                account.donation_bonus_balance += diff
                account.save(update_fields=['donation_bonus_balance', 'updated_at'])
            credited_txns.append(existing)
        else:
            curr_bal = Decimal(str(account.donation_bonus_balance or 0))
            account.donation_bonus_balance = curr_bal + bonus_amount
            account.save(update_fields=['donation_bonus_balance', 'updated_at'])

            txn = StaffBonusTransaction.objects.create(
                bonus_account=account,
                bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS,
                direction=StaffBonusTransaction.TxnDirection.CREDIT,
                amount=bonus_amount,
                income_id=income.receipt_number or str(income.id),
                member_name=income.donor_name,
                description=(
                    f"{rate_pct}% donation incentive on Rs{amount} collected "
                    f"(Receipt: {income.receipt_number})"
                ),
            )
            credited_txns.append(txn)

        # If staff has reached 15% tier in this month, ensure earlier transactions in this month are upgraded to 15%
        if rate == DONATION_BONUS_TIER_RATE:
            _upgrade_staff_month_donations_to_tier(staff_user, account, income_date.year, income_date.month)

    # ── 2. Referral donor bonus ───────────────────────────────────
    from hr_module.models import Member
    donor_member = None
    if income.created_by and income.created_by.role == Role.MEMBER:
        donor_member = Member.objects.filter(created_by=income.created_by).first()

    if not donor_member and income.donor_phone:
        import re
        clean_p = re.sub(r'\D', '', str(income.donor_phone))[-10:]
        if clean_p:
            for m in Member.objects.exclude(phone='').iterator():
                m_p = re.sub(r'\D', '', str(m.phone or ''))[-10:]
                if m_p == clean_p:
                    donor_member = m
                    break

    if donor_member and donor_member.referred_by:
        referrer = donor_member.referred_by
        referrer_user = referrer.created_by
        if referrer_user and referrer_user != staff_user:
            ref_bonus_amount = (amount * Decimal('0.10')).quantize(Decimal('0.01'))
            ref_account = _get_or_create_bonus_account(referrer_user)
            curr_ref_bal = Decimal(str(ref_account.donation_bonus_balance or 0))
            ref_account.donation_bonus_balance = curr_ref_bal + ref_bonus_amount
            ref_account.save(update_fields=['donation_bonus_balance', 'updated_at'])

            ref_txn = StaffBonusTransaction.objects.create(
                bonus_account=ref_account,
                bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS,
                direction=StaffBonusTransaction.TxnDirection.CREDIT,
                amount=ref_bonus_amount,
                income_id=income.receipt_number or str(income.id),
                member_id=str(donor_member.member_id),
                member_name=donor_member.full_name,
                description=(
                    f"10% referral donation incentive on Rs{amount} donated by "
                    f"referred member {donor_member.full_name} ({donor_member.member_id})"
                ),
            )
            credited_txns.append(ref_txn)

    return credited_txns


def credit_membership_bonus(member, staff_user=None, is_referral=False):
    """
    Credit 30% membership bonus to the staff member who enrolled a new member
    or to the referring member who referred them.

    Args:
        member: hr_module.models.Member instance (newly enrolled)
        staff_user: User who enrolled the member (defaults to member.created_by)
        is_referral: True if this bonus is due to a referral code usage
    """
    from hr_module.models import StaffBonusAccount, StaffBonusTransaction

    if staff_user is None:
        staff_user = member.created_by

    if not staff_user:
        return None

    fee = Decimal(str(member.monthly_fee or 100))
    if fee <= 0:
        fee = Decimal('100.00')

    # 30% of membership fee (Rs30 per Rs100)
    bonus_amount = (fee * Decimal('0.30')).quantize(Decimal('0.01'))
    if bonus_amount <= 0:
        bonus_amount = Decimal('30.00')

    account = _get_or_create_bonus_account(staff_user)

    bonus_type = (
        StaffBonusTransaction.BonusType.REFERRAL_BONUS
        if is_referral else
        StaffBonusTransaction.BonusType.MEMBERSHIP_BONUS
    )

    # Avoid duplicate crediting for the same member
    mem_key = str(member.member_id or member.id)
    existing = StaffBonusTransaction.objects.filter(
        bonus_account=account,
        bonus_type=bonus_type,
        direction=StaffBonusTransaction.TxnDirection.CREDIT,
        member_id=mem_key
    ).first()
    if existing:
        return existing

    curr_mem_bal = Decimal(str(account.membership_bonus_balance or 0))
    account.membership_bonus_balance = curr_mem_bal + bonus_amount
    account.save(update_fields=['membership_bonus_balance', 'updated_at'])

    txn = StaffBonusTransaction.objects.create(
        bonus_account=account,
        bonus_type=bonus_type,
        direction=StaffBonusTransaction.TxnDirection.CREDIT,
        amount=bonus_amount,
        member_id=mem_key,
        member_name=member.full_name,
        description=(
            f"{'Referral m' if is_referral else 'M'}embership bonus (30%) for enrolling "
            f"{member.full_name} (ID: {member.member_id}) — "
            f"Rs{fee} fee x 30% = Rs{bonus_amount}"
        ),
    )
    return txn


def get_user_for_member(member):
    """
    Get the User account associated with a Member (for mobile login and bonus crediting).
    Ensures that whether the member registered via mobile or was enrolled by HR/staff,
    the referral bonus is credited to the member's or staff's user account.
    """
    if not member:
        return None
    import re
    from core.models import User, Role

    # 1. Direct created_by (Staff, Member, etc.)
    if member.created_by:
        return member.created_by

    # 2. Match by mobile phone number
    clean_p = re.sub(r'\D', '', str(member.phone or ''))[-10:]
    if clean_p:
        u = User.objects.filter(phone__endswith=clean_p).first() or \
            User.objects.filter(username__endswith=clean_p).first()
        if u:
            return u

    # 3. Match by full_name
    if member.full_name:
        u = User.objects.filter(full_name__iexact=member.full_name).first()
        if u:
            return u

    # 4. Auto-sync a User account for this Member
    try:
        from hr_module.views import sync_member_user_account
        return sync_member_user_account(member)
    except Exception:
        return None


def credit_referral_bonus_for_referrer(new_member):
    """
    When a new member registers with a referral code:
    Credit 30% membership bonus to the referring member's or staff's user account.
    """
    referring_member = new_member.referred_by
    if not referring_member:
        return None

    # Credit the referring user (e.g. Swapna)
    user_to_credit = get_user_for_member(referring_member)
    if not user_to_credit:
        return None

    return credit_membership_bonus(new_member, staff_user=user_to_credit, is_referral=True)


def sync_staff_referrals_and_bonuses():
    """
    Self-healing synchronization function:
    1. Specifically ensures Irfan and Swapna (swapnat) are linked and credited:
       - Finds swapnat user and swapnat member profile.
       - Finds Irfan member (ID 0029 or name Irfan).
       - Sets irfan.referred_by = swapnat_member if not set.
       - Credits the 30% membership referral bonus to swapnat.
    2. Scans all Members with referred_by set and ensures referral bonus is credited.
    3. Scans all Members enrolled by Staff (created_by is Staff) and ensures bonus is credited.
    """
    import re
    from hr_module.models import Member, StaffBonusAccount, StaffBonusTransaction
    from core.models import User, Role
    from django.db.models import Q

    # ── 1. Specific Irfan & Swapna resolution ─────────────────────────
    swapnat_user = User.objects.filter(
        Q(username__iexact='swapnat') | Q(staff_uid__iexact='SLT-0018') | Q(full_name__icontains='swapna')
    ).first()

    if swapnat_user:
        swapnat_member = Member.objects.filter(created_by=swapnat_user).first()
        if not swapnat_member and swapnat_user.phone:
            swapnat_member = Member.objects.filter(phone=str(swapnat_user.phone)).first()
        if not swapnat_member:
            count = Member.objects.count() + 1
            swapnat_member = Member.objects.create(
                member_id=f"{count:04d}",
                full_name=swapnat_user.full_name or 'Swapna T',
                phone=swapnat_user.phone or '',
                email=swapnat_user.email or '',
                created_by=swapnat_user,
                status='ACTIVE'
            )
            swapnat_member.generate_one_time_referral_code()
        elif not swapnat_member.referral_code or not re.match(r'^slt-\d+$', str(swapnat_member.referral_code).strip()):
            swapnat_member.generate_one_time_referral_code()

        irfan_member = Member.objects.filter(
            Q(full_name__icontains='irfan') | Q(member_id__in=['0029', '29'])
        ).first()

        if irfan_member:
            if not irfan_member.referred_by:
                irfan_member.referred_by = swapnat_member
                irfan_member.save(update_fields=['referred_by'])

            credit_membership_bonus(irfan_member, staff_user=swapnat_user, is_referral=True)

    # ── 2. All members with referred_by ──────────────────────────────
    for m in Member.objects.filter(referred_by__isnull=False).iterator():
        try:
            credit_referral_bonus_for_referrer(m)
        except Exception:
            pass

    # ── 3. All members created by staff ──────────────────────────────
    staff_roles = [Role.STAFF, Role.FIELD_ASSESSMENT_OFFICER, Role.ASSESSMENT_CALCULATION_OFFICER, Role.GENERAL_ENQUIRY_OFFICER]
    for m in Member.objects.filter(created_by__role__in=staff_roles).iterator():
        try:
            credit_membership_bonus(m, staff_user=m.created_by, is_referral=False)
        except Exception:
            pass


def sync_staff_bonus_account(user):
    """
    Synchronize staff bonus account against actual existing Income and Member records.
    Purges orphan transactions (e.g. from deleted donations/members) and recalculates balances.
    """
    if not user:
        return None
    from hr_module.models import StaffBonusAccount, StaffBonusTransaction, Member
    from accounts_module.models import Income
    from django.db.models import Sum, Q
    import uuid

    account = _get_or_create_bonus_account(user)

    # 1. Purge orphan bonus transactions
    txns = StaffBonusTransaction.objects.filter(bonus_account=account)
    for txn in list(txns):
        # Donation bonus link check
        if txn.income_id:
            is_valid_uuid = False
            try:
                val_uuid = uuid.UUID(str(txn.income_id))
                is_valid_uuid = True
            except (ValueError, AttributeError):
                is_valid_uuid = False

            if is_valid_uuid:
                exists = Income.objects.filter(Q(id=val_uuid) | Q(receipt_number=txn.income_id)).exists()
            else:
                exists = Income.objects.filter(receipt_number=txn.income_id).exists()

            if not exists:
                txn.delete()
                continue

        # Member bonus link check
        if txn.member_id:
            is_valid_uuid = False
            try:
                val_uuid = uuid.UUID(str(txn.member_id))
                is_valid_uuid = True
            except (ValueError, AttributeError):
                is_valid_uuid = False

            if is_valid_uuid:
                exists = Member.objects.filter(Q(id=val_uuid) | Q(member_id=txn.member_id)).exists()
            else:
                exists = Member.objects.filter(member_id=txn.member_id).exists()

            if not exists:
                txn.delete()
                continue

    # 2. Re-verify donation bonus rates (10% base or 15% tier if Rs 1,50,000 achieved)
    for txn in list(StaffBonusTransaction.objects.filter(bonus_account=account, bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS)):
        if txn.income_id:
            val_uuid = None
            try:
                val_uuid = uuid.UUID(str(txn.income_id))
            except (ValueError, AttributeError):
                pass
            inc = Income.objects.filter(Q(id=val_uuid) | Q(receipt_number=txn.income_id)).first() if val_uuid else Income.objects.filter(receipt_number=txn.income_id).first()
            if inc and inc.created_by == user:
                rate = get_staff_donation_bonus_rate(user, inc.date)
                rate_pct = int(rate * 100)
                expected_amount = (Decimal(str(inc.amount)) * rate).quantize(Decimal('0.01'))
                if txn.amount != expected_amount or f"{rate_pct}%" not in txn.description:
                    txn.amount = expected_amount
                    txn.description = f"{rate_pct}% donation incentive on Rs{inc.amount} collected (Receipt: {inc.receipt_number})"
                    txn.save(update_fields=['amount', 'description'])

    # 3. Recalculate balances from remaining valid transactions
    remaining = StaffBonusTransaction.objects.filter(bonus_account=account)

    don_credits = remaining.filter(
        direction=StaffBonusTransaction.TxnDirection.CREDIT,
        bonus_type__in=[
            StaffBonusTransaction.BonusType.DONATION_BONUS,
            'DONATION'
        ]
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')

    mem_credits = remaining.filter(
        direction=StaffBonusTransaction.TxnDirection.CREDIT,
        bonus_type__in=[
            StaffBonusTransaction.BonusType.MEMBERSHIP_BONUS,
            StaffBonusTransaction.BonusType.REFERRAL_BONUS,
            'MEMBERSHIP',
            'REFERRAL'
        ]
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')

    payout_debits = remaining.filter(
        direction=StaffBonusTransaction.TxnDirection.DEBIT
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')

    account.donation_bonus_balance = Decimal(str(don_credits))
    account.membership_bonus_balance = Decimal(str(mem_credits))
    account.total_paid_out = Decimal(str(payout_debits))
    account.save(update_fields=['donation_bonus_balance', 'membership_bonus_balance', 'total_paid_out', 'updated_at'])
    return account


def sync_all_bonus_accounts():
    """Sync all existing StaffBonusAccounts and self-heal missing referral bonuses."""
    from hr_module.models import StaffBonusAccount
    try:
        sync_staff_referrals_and_bonuses()
    except Exception as e:
        logger.warning(f"Failed to sync staff referrals and bonuses: {e}")

    for acc in StaffBonusAccount.objects.select_related('staff').all():
        try:
            sync_staff_bonus_account(acc.staff)
        except Exception as e:
            logger.warning(f"Failed to sync bonus account for user {acc.staff_id}: {e}")


def handle_income_deleted(income):
    """
    Called when an Income record is deleted.
    Removes linked StaffBonusTransactions and re-syncs affected staff bonus accounts.
    """
    from hr_module.models import StaffBonusTransaction
    from django.db.models import Q

    receipt_no = getattr(income, 'receipt_number', None)
    income_id = getattr(income, 'id', None)

    q = Q()
    if receipt_no:
        q |= Q(income_id=str(receipt_no))
    if income_id:
        q |= Q(income_id=str(income_id))

    txns = StaffBonusTransaction.objects.filter(q)
    affected_users = set()
    for t in txns:
        if t.bonus_account and t.bonus_account.staff:
            affected_users.add(t.bonus_account.staff)
    txns.delete()

    if getattr(income, 'created_by', None):
        affected_users.add(income.created_by)

    for u in affected_users:
        try:
            sync_staff_bonus_account(u)
        except Exception as e:
            logger.warning(f"Error syncing user {u.id} on income deletion: {e}")


def handle_member_deleted(member):
    """
    Called when a Member record is deleted.
    Removes linked StaffBonusTransactions and re-syncs affected staff bonus accounts.
    """
    from hr_module.models import StaffBonusTransaction
    from django.db.models import Q

    mem_id = getattr(member, 'member_id', None)
    mem_uuid = getattr(member, 'id', None)

    q = Q()
    if mem_id:
        q |= Q(member_id=str(mem_id))
    if mem_uuid:
        q |= Q(member_id=str(mem_uuid))

    txns = StaffBonusTransaction.objects.filter(q)
    affected_users = set()
    for t in txns:
        if t.bonus_account and t.bonus_account.staff:
            affected_users.add(t.bonus_account.staff)
    txns.delete()

    if getattr(member, 'created_by', None):
        affected_users.add(member.created_by)

    for u in affected_users:
        try:
            sync_staff_bonus_account(u)
        except Exception as e:
            logger.warning(f"Error syncing user {u.id} on member deletion: {e}")


def get_staff_bonus_summary(user):
    """
    Get a full summary of a staff member's or referring user's bonus account.
    Returns a dict with balances and recent transactions.
    """
    from hr_module.models import StaffBonusAccount, StaffBonusTransaction

    account = sync_staff_bonus_account(user)
    if not account:
        try:
            account = StaffBonusAccount.objects.get(staff=user)
        except StaffBonusAccount.DoesNotExist:
            return {
                'donation_bonus': 0.0,
                'membership_bonus': 0.0,
                'total_bonus': 0.0,
                'total_paid_out': 0.0,
                'available_balance': 0.0,
                'transactions': [],
            }

    transactions = StaffBonusTransaction.objects.filter(
        bonus_account=account
    ).order_by('-created_at')[:50]

    don_bal = float(account.donation_bonus_balance or 0)
    mem_bal = float(account.membership_bonus_balance or 0)
    paid_out = float(account.total_paid_out or 0)

    return {
        'donation_bonus': round(don_bal, 2),
        'membership_bonus': round(mem_bal, 2),
        'total_bonus': round(don_bal + mem_bal, 2),
        'total_paid_out': round(paid_out, 2),
        'available_balance': round(don_bal + mem_bal - paid_out, 2),
        'transactions': [
            {
                'id': str(t.id),
                'bonus_type': t.bonus_type,
                'bonus_type_display': t.get_bonus_type_display(),
                'direction': t.direction,
                'amount': float(t.amount),
                'description': t.description,
                'income_id': t.income_id,
                'member_id': t.member_id,
                'member_name': t.member_name,
                'created_at': t.created_at.strftime('%Y-%m-%d %H:%M'),
            }
            for t in transactions
        ],
    }
