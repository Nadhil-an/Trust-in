import os
import django
from django.conf import settings

# Setup Django if run standalone
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sreelakshmi_trust.settings')
django.setup()

from core.models import User
from hr_module.models import Attendance

def verify_connection():
    print("=========================================")
    print("  DATABASE CONNECTION VERIFICATION")
    print("=========================================")
    
    # 1. Print current DB engine configuration
    db_config = settings.DATABASES['default']
    print(f"\n[1] Database Engine: {db_config.get('ENGINE')}")
    print(f"[2] Database Name:   {db_config.get('NAME')}")
    
    if 'sqlite' in db_config.get('ENGINE'):
        print("\nWARNING: You are currently connected to a LOCAL SQLite database.")
        print("This is NOT your production database. If you want to fix the production data,")
        print("you must update your 'backend/.env' file with the production DATABASE_URL.")
    else:
        print(f"[3] Database Host:   {db_config.get('HOST', 'localhost')}")
        print("\nSUCCESS: You appear to be connected to an external/production database (Postgres/MySQL)!")
        
    print("\n[ Live Data Snapshot ]")
    try:
        total_users = User.objects.count()
        today = django.utils.timezone.now().date()
        total_att = Attendance.objects.filter(date=today).count()
        
        print(f"Total Users in this DB: {total_users}")
        print(f"Total Attendance records for today ({today}): {total_att}")
        print("\nTIP: Compare these numbers with your live production dashboard.")
        print("If the numbers match your live dashboard exactly, you are definitely connected to production!")
    except Exception as e:
        print(f"\nFailed to query database: {e}")

if __name__ == "__main__":
    verify_connection()
