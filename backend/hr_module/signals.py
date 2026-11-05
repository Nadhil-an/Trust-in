"""
hr_module/signals.py
─────────────────────
Django signals that auto-credit staff bonuses when:
  1. A new donation (Income) is created by a STAFF user → Donation bonus (10%)
  2. A new Member is created by a STAFF user → Membership bonus (30%)
  3. A new Member is created with a referral code → Referral bonus (30%) to referrer's staff
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='accounts_module.Income')
def on_income_created(sender, instance, created, **kwargs):
    """Credit 10% donation bonus when a new Income record is created."""
    if not created:
        return
    try:
        from hr_module.bonus_service import credit_donation_bonus
        credit_donation_bonus(instance)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            f"Could not credit donation bonus for Income {instance.id}: {e}"
        )


@receiver(post_save, sender='hr_module.Member')
def on_member_created(sender, instance, created, **kwargs):
    """
    Credit 30% membership bonus when a new Member is registered:
    - To the staff who enrolled the member (membership_bonus)
    - To the referring member's staff (referral_bonus), if referral code was used
    """
    if not created:
        return
    try:
        from hr_module.bonus_service import credit_membership_bonus, credit_referral_bonus_for_referrer
        # 1. Standard membership bonus → staff who enrolled
        credit_membership_bonus(instance)
        # 2. Referral bonus → staff who enrolled the referring member
        if instance.referred_by_id:
            credit_referral_bonus_for_referrer(instance)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            f"Could not credit membership/referral bonus for Member {instance.id}: {e}"
        )

