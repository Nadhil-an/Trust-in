import os
import django
from django.utils import timezone

# Setup Django if run standalone
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from hr_module.models import Attendance

def restore_check_in_times(target_date="2026-09-15"):
    print(f"--- Restoring Check-in Times for {target_date} ---")
    
    # Get records where check_in is None but there's a photo, or just all PRESENT records for the day that have no check_in
    records = Attendance.objects.filter(date=target_date, check_in__isnull=True)
    
    updated_count = 0
    for att in records:
        # If the record has a check_in_photo or status is PRESENT, it means they likely checked in
        if att.status == 'PRESENT' and att.created_at:
            # Convert the UTC created_at time to local time (Asia/Kolkata)
            local_time = timezone.localtime(att.created_at)
            
            # Since the record might have been created around check-in, we use it as a fallback
            # (Note: If it was created via bulk marking by HR in the morning, this will reflect that time)
            att.check_in = local_time.time()
            
            # Optional: If you also want to restore check_out if a checkout photo exists, we'd need to guess
            # Usually checkout is done later, but created_at is when the record was *created*. 
            # We cannot easily guess checkout time unless we look at updated_at (which was overwritten by the bulk save).
            
            att.save(update_fields=['check_in'])
            print(f"Restored check_in for {att.employee.full_name} to {local_time.time().strftime('%I:%M %p')}")
            updated_count += 1
            
    print(f"Successfully restored {updated_count} records.")

if __name__ == "__main__":
    restore_check_in_times("2026-09-15")
