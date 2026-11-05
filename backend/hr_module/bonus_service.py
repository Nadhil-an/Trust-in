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


def credit_referral_bonus_for_referrer(new_member):
    """
    When a new member registers with a referral code:
    Credit 30% membership bonus to the referring member's user account.
    """
    referring_member = new_member.referred_by
    if not referring_member:
        return None

    # Credit the referring member's user
    user_to_credit = referring_member.created_by
    if not user_to_credit:
        return None

    return credit_membership_bonus(new_member, staff_user=user_to_credit, is_referral=True)


def get_staff_bonus_summary(user):
    """
    Get a full summary of a staff member's or referring user's bonus account.
    Returns a dict with balances and recent transactions.
    """
    from hr_module.models import StaffBonusAccount, StaffBonusTransaction

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
