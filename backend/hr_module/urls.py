from django.urls import path
from hr_module import views

urlpatterns = [
    path('dashboard/', views.HRDashboardView.as_view()),
    path('staff-dashboard/', views.StaffDashboardView.as_view()),
    # Members
    path('members/', views.MemberListCreateView.as_view()),
    path('members/<uuid:pk>/', views.MemberDetailView.as_view()),
    path('members/<uuid:pk>/certificate/', views.MemberCertificateView.as_view()),
    path('members/<uuid:pk>/receipt-pdf/', views.MemberPdfView.as_view()),
    path('members/<uuid:pk>/receipt-image/', views.MemberImageView.as_view()),
    path('members/<uuid:member_pk>/documents/', views.MemberDocumentView.as_view()),
    path('receipts/<uuid:pk>/retry-whatsapp/', views.RetryWhatsAppView.as_view()),
    # Volunteers
    path('volunteers/', views.VolunteerListCreateView.as_view()),
    path('volunteers/<uuid:pk>/', views.VolunteerDetailView.as_view()),
    # Executive Members
    path('executive-members/', views.ExecutiveMemberListCreateView.as_view()),
    path('executive-members/<uuid:pk>/', views.ExecutiveMemberDetailView.as_view()),
    # Executive Officers
    path('officers/', views.ExecutiveOfficerListCreateView.as_view()),
    path('officers/<uuid:pk>/', views.ExecutiveOfficerDetailView.as_view()),
    path('officers/<uuid:pk>/attendance-graph/', views.OfficerAttendanceGraphView.as_view()),
    path('officers/<uuid:pk>/payroll-data/', views.OfficerPayrollDataView.as_view()),
    path('officers/<uuid:emp_pk>/documents/', views.EmployeeDocumentView.as_view()),
    # Salary
    path('salary-structures/', views.SalaryStructureListCreateView.as_view()),
    path('salary-structures/<uuid:pk>/', views.SalaryStructureDetailView.as_view()),
    # Attendance
    path('attendance/', views.AttendanceListCreateView.as_view()),
    path('attendance/<uuid:pk>/', views.AttendanceDetailView.as_view()),
    path('attendance/bulk/', views.BulkAttendanceView.as_view()),
    path('attendance/my-attendance/', views.StaffAttendanceView.as_view()),
    # Leave
    path('leave/', views.LeaveRequestListCreateView.as_view()),
    path('leave/<uuid:pk>/', views.LeaveRequestDetailView.as_view()),
    path('leave/<uuid:pk>/action/', views.LeaveApprovalView.as_view()),
    # Payroll
    path('payroll/', views.PayrollListCreateView.as_view()),
    path('payroll/<uuid:pk>/', views.PayrollDetailView.as_view()),
    # Complaints
    path('complaints/', views.ComplaintListCreateView.as_view()),
    path('complaints/<uuid:pk>/', views.ComplaintDetailView.as_view()),
    # Staff Reports
    path('staff-reports/', views.StaffReportListCreateView.as_view()),
    path('staff-reports/<uuid:pk>/', views.StaffReportDetailView.as_view()),

    path('salary-balance/', views.SalaryBalanceView.as_view(), name='salary-balance'),

    # Payment Advances
    path('payment-advances/', views.PaymentAdvanceListCreateView.as_view()),
    path('payment-advances/<uuid:pk>/', views.PaymentAdvanceDetailView.as_view()),
    path('payment-advances/<uuid:pk>/action/', views.PaymentAdvanceApprovalView.as_view()),
    # Performance Points
    path('performance-points/', views.PerformancePointListCreateView.as_view()),
    path('performance-points/leaderboard/', views.PerformancePointLeaderboardView.as_view()),
    # Birthday Alerts
    path('birthday-alerts/', views.BirthdayAlertView.as_view()),
]

