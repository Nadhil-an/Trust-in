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


def _get_or_create_bonus_account(user):
    """Get or create a bonus account for a staff member or referring user."""
    from hr_module.models import StaffBonusAccount
    account, _ = StaffBonusAccount.objects.get_or_create(staff=user)
    return account


def credit_donation_bonus(income):
    """
    Credit 10% donation bonus.
    1. To the staff member who collected/created the donation.
    2. To the referring member if the donor was enrolled via a referral code.
    
    Args:
        income: accounts_module.models.Income instance
    """
    from hr_module.models import StaffBonusAccount, StaffBonusTransaction
    from core.models import Role

    amount = Decimal(str(income.amount or 0))
    if amount <= 0:
        return None

    # 10% bonus on the donation amount
    bonus_amount = (amount * Decimal('0.10')).quantize(Decimal('0.01'))
    if bonus_amount <= 0:
        return None

    credited_txns = []

    # ── 1. Staff collector bonus ──────────────────────────────────
    staff_user = income.created_by
    if staff_user and staff_user.role in [
        Role.STAFF, Role.FIELD_ASSESSMENT_OFFICER,
        Role.ASSESSMENT_CALCULATION_OFFICER, Role.GENERAL_ENQUIRY_OFFICER
    ]:
        account = _get_or_create_bonus_account(staff_user)
        curr_bal = Decimal(str(account.donation_bonus_balance or 0))
        account.donation_bonus_balance = curr_bal + bonus_amount
        account.save(update_fields=['donation_bonus_balance', 'updated_at'])

        txn = StaffBonusTransaction.objects.create(
            bonus_account=account,
            bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS,
            direction=StaffBonusTransaction.TxnDirection.CREDIT,
            amount=bonus_amount,
            income_id=income.receipt_number or str(income.id),
            description=(
                f"10% donation bonus on Rs{amount} collected "
                f"(Receipt: {income.receipt_number})"
            ),
        )
        credited_txns.append(txn)

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
            ref_account = _get_or_create_bonus_account(referrer_user)
            curr_ref_bal = Decimal(str(ref_account.donation_bonus_balance or 0))
            ref_account.donation_bonus_balance = curr_ref_bal + bonus_amount
            ref_account.save(update_fields=['donation_bonus_balance', 'updated_at'])

            ref_txn = StaffBonusTransaction.objects.create(
                bonus_account=ref_account,
                bonus_type=StaffBonusTransaction.BonusType.DONATION_BONUS,
                direction=StaffBonusTransaction.TxnDirection.CREDIT,
                amount=bonus_amount,
                income_id=income.receipt_number or str(income.id),
                member_id=str(donor_member.member_id),
                member_name=donor_member.full_name,
                description=(
                    f"10% referral donation bonus on Rs{amount} donated by "
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
        return None

    # 30% of membership fee (Rs30 per Rs100)
    bonus_amount = (fee * Decimal('0.30')).quantize(Decimal('0.01'))
    if bonus_amount <= 0:
        return None

    account = _get_or_create_bonus_account(staff_user)
    curr_mem_bal = Decimal(str(account.membership_bonus_balance or 0))
    account.membership_bonus_balance = curr_mem_bal + bonus_amount
    account.save(update_fields=['membership_bonus_balance', 'updated_at'])

    bonus_type = (
        StaffBonusTransaction.BonusType.REFERRAL_BONUS
        if is_referral else
        StaffBonusTransaction.BonusType.MEMBERSHIP_BONUS
    )

    txn = StaffBonusTransaction.objects.create(
        bonus_account=account,
        bonus_type=bonus_type,
        direction=StaffBonusTransaction.TxnDirection.CREDIT,
        amount=bonus_amount,
        member_id=str(member.member_id),
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
    the referral bonus is credited to the member's own account.
    """
    if not member:
        return None
    import re
    from core.models import User, Role

    # 1. Direct created_by if role is MEMBER
    if member.created_by and getattr(member.created_by, 'role', None) == Role.MEMBER:
        return member.created_by

    # 2. Match by mobile phone number
    clean_p = re.sub(r'\D', '', str(member.phone or ''))[-10:]
    if clean_p:
        u = User.objects.filter(role=Role.MEMBER).filter(phone__endswith=clean_p).first() or \
            User.objects.filter(role=Role.MEMBER).filter(username__endswith=clean_p).first()
        if u:
            return u
        u = User.objects.filter(phone__endswith=clean_p).first() or \
            User.objects.filter(username__endswith=clean_p).first()
        if u:
            return u

    # 3. Fallback to member.created_by
    if member.created_by:
        return member.created_by

    # 4. Auto-sync a User account for this Member
    try:
        from hr_module.views import sync_member_user_account
        return sync_member_user_account(member)
    except Exception:
        return None


def credit_referral_bonus_for_referrer(new_member):
    """
    When a new member registers with a referral code:
    Credit 30% membership bonus to the referring member's user account.
    """
    referring_member = new_member.referred_by
    if not referring_member:
        return None

    # Credit the referring member's user (e.g. Swapna)
    user_to_credit = get_user_for_member(referring_member)
    if not user_to_credit:
        return None

    return credit_membership_bonus(new_member, staff_user=user_to_credit, is_referral=True)


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

    # 2. Recalculate balances from remaining valid transactions
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
    """Sync all existing StaffBonusAccounts."""
    from hr_module.models import StaffBonusAccount
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
