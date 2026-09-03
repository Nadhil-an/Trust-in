import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useNotificationStore } from './store/notificationStore'
import { useFeatureStore } from './store/featureStore'

// Pages
import LoginPage from './pages/LoginPage'
import AppLayout from './components/AppLayout'
import ManagerDashboard from './pages/manager/Dashboard'
import Requests from './pages/manager/Requests'
import RequestDetail from './pages/manager/RequestDetail'
import Minutes from './pages/manager/Minutes'
import Partners from './pages/manager/Partners'
import Inventory from './pages/manager/Inventory'
import AccountsDashboard from './pages/accounts/Dashboard'
import AccountsOverview from './pages/accounts/AccountsOverview'
import Donations from './pages/accounts/Donations'
import MoneyRequests from './pages/accounts/MoneyRequests'
import CashBook from './pages/accounts/CashBook'
import BankAccounts from './pages/accounts/BankAccounts'
import IncomeList from './pages/accounts/Income'
import ExpenseList from './pages/accounts/Expenses'
import ChequeList from './pages/accounts/Cheques'
import TransferList from './pages/accounts/Transfers'
import TransactionList from './pages/accounts/Transactions'
import PendingSalaries from './pages/accounts/PendingSalaries'
import PendingDisbursements from './pages/cashier/PendingDisbursements'
import DisbursementList from './pages/cashier/Disbursements'
import CashClosing from './pages/cashier/CashClosing'
import DaySheet from './pages/cashier/DaySheet'
import HRDashboard from './pages/hr/Dashboard'
import Members from './pages/hr/Members'
import Volunteers from './pages/hr/Volunteers'
import ExecMembers from './pages/hr/ExecMembers'
import Officers from './pages/hr/Officers'
import AttendancePage from './pages/hr/Attendance'
import LeavePage from './pages/hr/Leave'
import PayrollPage from './pages/hr/Payroll'
import Complaints from './pages/hr/Complaints'
import StaffReports from './pages/hr/StaffReports'
import PaymentAdvances from './pages/hr/PaymentAdvances'
import PerformancePoints from './pages/hr/PerformancePoints'
import ReportsPage from './pages/Reports'
import AdminUsers from './pages/admin/Users'
import MobileAccess from './pages/admin/MobileAccess'
import FeatureAccess from './pages/admin/FeatureAccess'
import AuditLogPage from './pages/admin/AuditLog'
import ProfilePage from './pages/Profile'
import NotFoundPage from './pages/NotFound'
import DataEntryDashboard from './pages/data-entry/Dashboard'
import InwardEntry from './pages/data-entry/InwardEntry'
import VerificationDashboard from './pages/data-entry/VerificationDashboard'
import PromotorRegistry from './pages/data-entry/PromotorRegistry'
import OutwardEntry from './pages/data-entry/OutwardEntry'
import PurchaseEntry from './pages/data-entry/PurchaseEntry'
import DonationEntry from './pages/data-entry/DonationEntry'
import MembershipEntry from './pages/data-entry/MembershipEntry'
import PartnersEntry from './pages/data-entry/PartnersEntry'
import MaterialInward from './pages/data-entry/MaterialInward'
import MaterialOutward from './pages/data-entry/MaterialOutward'
import EventEntry from './pages/data-entry/EventEntry'
import ScheduledPayouts from './pages/shared/ScheduledPayouts'

// ── Protected Route ───────────────────────────────────────
function ProtectedRoute({ children, roles = [], featureKey = null }) {
  const { isAuthenticated, user } = useAuthStore()
  const { hasFeature, loading } = useFeatureStore()
  
  if (!isAuthenticated) return <Navigate to="/slt/portal/auth" replace />
  
  if (user?.role === 'ADMIN') return children
  
  if (roles.length > 0 && !roles.includes(user?.role)) return <Navigate to="/" replace />
  
  if (featureKey) {
    if (loading) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
          <div className="text-sm font-medium text-gray-500 animate-pulse">Checking access...</div>
        </div>
      )
    }
    if (!hasFeature(featureKey)) return <Navigate to="/" replace />
  }
  
  return children
}

// ── Role-based home redirect ───────────────────────────────
function HomeRedirect() {
  const { user } = useAuthStore()
  const roleHome = {
    MANAGER:    '/slt/mgr/overview',
    ACCOUNTANT: '/slt/finance/overview',
    HR:         '/slt/hr/overview',
    ADMIN:      '/slt/sys/user-control',
    DATA_ENTRY: '/slt/entry/hub',
    STAFF:      '/slt/account/profile',
    FIELD_ASSESSMENT_OFFICER: '/slt/account/profile',
    ASSESSMENT_CALCULATION_OFFICER: '/slt/account/profile',
    GENERAL_ENQUIRY_OFFICER: '/slt/account/profile',
    MEMBER:     '/slt/account/profile',
  }
  return <Navigate to={roleHome[user?.role] || '/slt/account/profile'} replace />
}

export default function App() {
  const { isAuthenticated, user, fetchProfile } = useAuthStore()
  const { connectWebSocket, disconnect } = useNotificationStore()
  const { fetchFeatures } = useFeatureStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile()
      fetchFeatures()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connectWebSocket(user.id)

      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }

      return () => disconnect()
    }
  }, [isAuthenticated, user?.id])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize: '13px', borderRadius: '8px', fontFamily: 'Inter, sans-serif' },
          success: { iconTheme: { primary: '#16A34A', secondary: 'white' } },
          error: { iconTheme: { primary: '#DC2626', secondary: 'white' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/slt/portal/auth" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />

        {/* Legacy redirects so old /login still works */}
        <Route path="/login" element={<Navigate to="/slt/portal/auth" replace />} />

        {/* Protected */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<HomeRedirect />} />

          {/* Manager */}
          <Route path="slt/mgr/overview"         element={<ProtectedRoute roles={['MANAGER']}><ManagerDashboard /></ProtectedRoute>} />
          <Route path="slt/mgr/requests"         element={<ProtectedRoute featureKey="assessment_requests"><Requests /></ProtectedRoute>} />
          <Route path="slt/mgr/requests/:id"     element={<ProtectedRoute featureKey="assessment_requests"><RequestDetail /></ProtectedRoute>} />
          <Route path="slt/mgr/minutes"          element={<ProtectedRoute featureKey="minutes_registry"><Minutes /></ProtectedRoute>} />
          <Route path="slt/mgr/partners"         element={<ProtectedRoute featureKey="partners_entry"><Partners /></ProtectedRoute>} />
          <Route path="slt/mgr/inventory"        element={<ProtectedRoute featureKey="charity_inventory"><Inventory /></ProtectedRoute>} />

          {/* Accounts */}
          <Route path="slt/finance/overview"         element={<ProtectedRoute roles={['ACCOUNTANT']}><AccountsDashboard /></ProtectedRoute>} />
          <Route path="slt/finance/summary"          element={<ProtectedRoute roles={['ACCOUNTANT']}><AccountsOverview /></ProtectedRoute>} />
          <Route path="slt/finance/donations"        element={<ProtectedRoute featureKey="donations_view"><Donations /></ProtectedRoute>} />
          <Route path="slt/finance/fund-requests"    element={<ProtectedRoute featureKey="money_requests"><MoneyRequests /></ProtectedRoute>} />
          <Route path="slt/finance/cash-ledger"      element={<ProtectedRoute featureKey="cash_book"><CashBook /></ProtectedRoute>} />
          <Route path="slt/finance/bank-ledger"      element={<ProtectedRoute featureKey="bank_ledger"><BankAccounts /></ProtectedRoute>} />
          <Route path="slt/finance/income"           element={<ProtectedRoute featureKey="income_view"><IncomeList /></ProtectedRoute>} />
          <Route path="slt/finance/expenditure"      element={<ProtectedRoute featureKey="expenses_view"><ExpenseList /></ProtectedRoute>} />
          <Route path="slt/finance/cheques"          element={<ProtectedRoute featureKey="cheques"><ChequeList /></ProtectedRoute>} />
          <Route path="slt/finance/transfers"        element={<ProtectedRoute featureKey="transfers"><TransferList /></ProtectedRoute>} />
          <Route path="slt/finance/transactions"     element={<ProtectedRoute featureKey="transactions"><TransactionList /></ProtectedRoute>} />
          <Route path="slt/finance/salary-review"    element={<ProtectedRoute featureKey="salary_review"><PendingSalaries /></ProtectedRoute>} />

          {/* Cashier / Disbursements (Accountant) */}
          <Route path="slt/disburse/pending"         element={<ProtectedRoute featureKey="pending_payouts"><PendingDisbursements /></ProtectedRoute>} />
          <Route path="slt/disburse/payouts"         element={<ProtectedRoute featureKey="payouts"><DisbursementList /></ProtectedRoute>} />
          <Route path="slt/disburse/daily-close"     element={<ProtectedRoute featureKey="cash_closing"><CashClosing /></ProtectedRoute>} />
          <Route path="slt/disburse/day-sheet"        element={<ProtectedRoute featureKey="cash_closing"><DaySheet /></ProtectedRoute>} />

          {/* HR */}
          <Route path="slt/hr/overview"              element={<ProtectedRoute roles={['HR']}><HRDashboard /></ProtectedRoute>} />
          <Route path="slt/hr/members"               element={<ProtectedRoute featureKey="hr_members"><Members /></ProtectedRoute>} />
          <Route path="slt/hr/volunteers"            element={<ProtectedRoute featureKey="hr_volunteers"><Volunteers /></ProtectedRoute>} />
          <Route path="slt/hr/executive-members"     element={<ProtectedRoute featureKey="hr_exec_members"><ExecMembers /></ProtectedRoute>} />
          <Route path="slt/hr/officers"              element={<ProtectedRoute featureKey="hr_officers"><Officers /></ProtectedRoute>} />
          <Route path="slt/hr/attendance"            element={<ProtectedRoute featureKey="hr_attendance"><AttendancePage /></ProtectedRoute>} />
          <Route path="slt/hr/leave"                 element={<ProtectedRoute featureKey="hr_leave"><LeavePage /></ProtectedRoute>} />
          <Route path="slt/hr/payroll"               element={<ProtectedRoute featureKey="hr_payroll"><PayrollPage /></ProtectedRoute>} />
          <Route path="slt/hr/complaints"            element={<ProtectedRoute featureKey="hr_complaints"><Complaints /></ProtectedRoute>} />
          <Route path="slt/hr/staff-reports"         element={<ProtectedRoute featureKey="hr_staff_reports"><StaffReports /></ProtectedRoute>} />
          <Route path="slt/hr/payment-advances"      element={<ProtectedRoute featureKey="hr_payment_advances"><PaymentAdvances /></ProtectedRoute>} />
          <Route path="slt/hr/performance"           element={<ProtectedRoute featureKey="hr_performance"><PerformancePoints /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="slt/shared/scheduled-payouts" element={<ProtectedRoute featureKey="scheduled_payouts"><ScheduledPayouts /></ProtectedRoute>} />
          <Route path="slt/shared/analytics"         element={<ProtectedRoute featureKey="analytics_reports"><ReportsPage /></ProtectedRoute>} />
          <Route path="slt/account/profile"          element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="slt/sys/user-control"         element={<ProtectedRoute roles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
          <Route path="slt/sys/feature-access"       element={<ProtectedRoute roles={['ADMIN']}><FeatureAccess /></ProtectedRoute>} />
          <Route path="slt/sys/mobile-access"        element={<ProtectedRoute roles={['ADMIN']}><MobileAccess /></ProtectedRoute>} />
          <Route path="slt/sys/audit-trail"          element={<ProtectedRoute roles={['ADMIN']}><AuditLogPage /></ProtectedRoute>} />

          {/* Data Entry */}
          <Route path="slt/entry/hub"                element={<ProtectedRoute roles={['DATA_ENTRY']}><DataEntryDashboard /></ProtectedRoute>} />
          <Route path="slt/entry/inward"             element={<ProtectedRoute featureKey="inward_entry"><InwardEntry /></ProtectedRoute>} />
          <Route path="slt/entry/outward"            element={<ProtectedRoute featureKey="outward_entry"><OutwardEntry /></ProtectedRoute>} />
          <Route path="slt/entry/purchase"           element={<ProtectedRoute featureKey="purchase_entry"><PurchaseEntry /></ProtectedRoute>} />
          <Route path="slt/entry/verification" element={<ProtectedRoute featureKey="promoters_verification"><VerificationDashboard /></ProtectedRoute>} />
          <Route path="slt/entry/promoters-registry" element={<ProtectedRoute featureKey="promoters_registry"><PromotorRegistry /></ProtectedRoute>} />
          <Route path="slt/entry/donation"           element={<ProtectedRoute featureKey="donation_entry"><DonationEntry /></ProtectedRoute>} />
          <Route path="slt/entry/membership"         element={<ProtectedRoute featureKey="membership_entry"><MembershipEntry /></ProtectedRoute>} />
          <Route path="slt/entry/partners"           element={<ProtectedRoute featureKey="partners_entry"><PartnersEntry /></ProtectedRoute>} />
          <Route path="slt/entry/material-inward"    element={<ProtectedRoute featureKey="material_inward"><MaterialInward /></ProtectedRoute>} />
          <Route path="slt/entry/material-outward"   element={<ProtectedRoute featureKey="material_outward"><MaterialOutward /></ProtectedRoute>} />
          <Route path="slt/entry/events"             element={<ProtectedRoute featureKey="events_entry"><EventEntry /></ProtectedRoute>} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
