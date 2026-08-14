import sys
from core.models import User, Role

role_map = {
    'FAO': Role.FIELD_ASSESSMENT_OFFICER,
    'ACO': Role.ASSESSMENT_CALCULATION_OFFICER,
    'GEO': Role.GENERAL_ENQUIRY_OFFICER,
    'STAFF': Role.STAFF,
    'MEMBER': Role.MEMBER
}

for short_name, role_val in role_map.items():
    username = f"{short_name.lower()}_user"
    password = f"password123"
    full_name = f"Sample {short_name}"
    email = f"{short_name.lower()}@sreelakshmi.org"
    
    if not User.objects.filter(username=username).exists():
        try:
            User.objects.create_user(
                username=username, 
                email=email,
                password=password, 
                role=role_val, 
                full_name=full_name, 
                phone=f"90000000{list(role_map.keys()).index(short_name)}"
            )
            print(f"Created {short_name} user: {username} / {password}")
        except Exception as e:
            print(f"Failed to create {short_name} user: {e}")
    else:
        print(f"User {username} already exists.")
