from hr_module.models import Attendance, ExecutiveOfficer
from hr_module.serializers import AttendanceSerializer

print("Testing Attendance List:")
qs = Attendance.objects.select_related('employee', 'marked_by').all()
try:
    data = AttendanceSerializer(qs, many=True).data
    print("Success, length:", len(data))
except Exception as e:
    import traceback
    traceback.print_exc()

print("Testing Officer List:")
qs_o = ExecutiveOfficer.objects.all()
try:
    from hr_module.serializers import ExecutiveOfficerSerializer
    data_o = ExecutiveOfficerSerializer(qs_o, many=True).data
    print("Officer Success, length:", len(data_o))
except Exception as e:
    import traceback
    traceback.print_exc()
