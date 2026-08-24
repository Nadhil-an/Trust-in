import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import { useNotificationStore } from './store/notificationStore'

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
import AuditLogPage from './pages/admin/AuditLog'
import ProfilePage from './pages/Profile'
import NotFoundPage from './pages/NotFound'
import DataEntryDashboard from './pages/data-entry/Dashboard'
import InwardEntry from './pages/data-entry/InwardEntry'
import OutwardEntry from './pages/data-entry/OutwardEntry'
import PurchaseEntry from './pages/data-entry/PurchaseEntry'
import DonationEntry from './pages/data-entry/DonationEntry'
import MembershipEntry from './pages/data-entry/MembershipEntry'
import PartnersEntry from './pages/data-entry/PartnersEntry'
import MaterialInward from './pages/data-entry/MaterialInward'
import MaterialOutward from './pages/data-entry/MaterialOutward'
import ScheduledPayouts from './pages/shared/ScheduledPayouts'

// ── Protected Route ───────────────────────────────────────
function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/slt/portal/auth" replace />
  if (roles.length > 0 && !roles.includes(user?.role)) return <Navigate to="/" replace />
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
  }
  return <Navigate to={roleHome[user?.role] || '/slt/portal/auth'} replace />
}

export default function App() {
  const { isAuthenticated, user, fetchProfile } = useAuthStore()
  const { connectWebSocket, disconnect } = useNotificationStore()

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile()
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
          <Route path="slt/mgr/overview"         element={<ProtectedRoute roles={['MANAGER','ADMIN']}><ManagerDashboard /></ProtectedRoute>} />
          <Route path="slt/mgr/requests"         element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','ADMIN']}><Requests /></ProtectedRoute>} />
          <Route path="slt/mgr/requests/:id"     element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','ADMIN']}><RequestDetail /></ProtectedRoute>} />
          <Route path="slt/mgr/minutes"          element={<ProtectedRoute roles={['MANAGER','ADMIN']}><Minutes /></ProtectedRoute>} />
          <Route path="slt/mgr/partners"         element={<ProtectedRoute roles={['MANAGER','ADMIN']}><Partners /></ProtectedRoute>} />
          <Route path="slt/mgr/inventory"        element={<ProtectedRoute roles={['MANAGER','ADMIN']}><Inventory /></ProtectedRoute>} />

          {/* Accounts */}
          <Route path="slt/finance/overview"         element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><AccountsDashboard /></ProtectedRoute>} />
          <Route path="slt/finance/summary"          element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><AccountsOverview /></ProtectedRoute>} />
          <Route path="slt/finance/donations"        element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><Donations /></ProtectedRoute>} />
          <Route path="slt/finance/fund-requests"    element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><MoneyRequests /></ProtectedRoute>} />
          <Route path="slt/finance/cash-ledger"      element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><CashBook /></ProtectedRoute>} />
          <Route path="slt/finance/bank-ledger"      element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><BankAccounts /></ProtectedRoute>} />
          <Route path="slt/finance/income"           element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><IncomeList /></ProtectedRoute>} />
          <Route path="slt/finance/expenditure"      element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><ExpenseList /></ProtectedRoute>} />
          <Route path="slt/finance/cheques"          element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><ChequeList /></ProtectedRoute>} />
          <Route path="slt/finance/transfers"        element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><TransferList /></ProtectedRoute>} />
          <Route path="slt/finance/transactions"     element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><TransactionList /></ProtectedRoute>} />
          <Route path="slt/finance/salary-review"    element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><PendingSalaries /></ProtectedRoute>} />

          {/* Cashier / Disbursements (Accountant) */}
          <Route path="slt/disburse/pending"         element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><PendingDisbursements /></ProtectedRoute>} />
          <Route path="slt/disburse/payouts"         element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><DisbursementList /></ProtectedRoute>} />
          <Route path="slt/disburse/daily-close"     element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><CashClosing /></ProtectedRoute>} />

          {/* HR */}
          <Route path="slt/hr/overview"              element={<ProtectedRoute roles={['HR','ADMIN']}><HRDashboard /></ProtectedRoute>} />
          <Route path="slt/hr/members"               element={<ProtectedRoute roles={['HR','ADMIN']}><Members /></ProtectedRoute>} />
          <Route path="slt/hr/volunteers"            element={<ProtectedRoute roles={['HR','ADMIN']}><Volunteers /></ProtectedRoute>} />
          <Route path="slt/hr/executive-members"     element={<ProtectedRoute roles={['HR','ADMIN']}><ExecMembers /></ProtectedRoute>} />
          <Route path="slt/hr/officers"              element={<ProtectedRoute roles={['HR','ADMIN']}><Officers /></ProtectedRoute>} />
          <Route path="slt/hr/attendance"            element={<ProtectedRoute roles={['HR','ADMIN']}><AttendancePage /></ProtectedRoute>} />
          <Route path="slt/hr/leave"                 element={<ProtectedRoute roles={['HR','ADMIN']}><LeavePage /></ProtectedRoute>} />
          <Route path="slt/hr/payroll"               element={<ProtectedRoute roles={['HR','ADMIN']}><PayrollPage /></ProtectedRoute>} />
          <Route path="slt/hr/complaints"            element={<ProtectedRoute roles={['HR','ADMIN']}><Complaints /></ProtectedRoute>} />
          <Route path="slt/hr/staff-reports"         element={<ProtectedRoute roles={['HR','ADMIN']}><StaffReports /></ProtectedRoute>} />
          <Route path="slt/hr/payment-advances"      element={<ProtectedRoute roles={['HR','ADMIN']}><PaymentAdvances /></ProtectedRoute>} />
          <Route path="slt/hr/performance"           element={<ProtectedRoute roles={['HR','ADMIN']}><PerformancePoints /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="slt/shared/scheduled-payouts" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','DATA_ENTRY','ADMIN']}><ScheduledPayouts /></ProtectedRoute>} />
          <Route path="slt/shared/analytics"         element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="slt/account/profile"          element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="slt/sys/user-control"         element={<ProtectedRoute roles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
          <Route path="slt/sys/audit-trail"          element={<ProtectedRoute roles={['ADMIN']}><AuditLogPage /></ProtectedRoute>} />

          {/* Data Entry */}
          <Route path="slt/entry/hub"                element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><DataEntryDashboard /></ProtectedRoute>} />
          <Route path="slt/entry/inward"             element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><InwardEntry /></ProtectedRoute>} />
          <Route path="slt/entry/outward"            element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><OutwardEntry /></ProtectedRoute>} />
          <Route path="slt/entry/purchase"           element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><PurchaseEntry /></ProtectedRoute>} />
          <Route path="slt/entry/donation"           element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><DonationEntry /></ProtectedRoute>} />
          <Route path="slt/entry/membership"         element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><MembershipEntry /></ProtectedRoute>} />
          <Route path="slt/entry/partners"           element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><PartnersEntry /></ProtectedRoute>} />
          <Route path="slt/entry/material-inward"    element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><MaterialInward /></ProtectedRoute>} />
          <Route path="slt/entry/material-outward"   element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><MaterialOutward /></ProtectedRoute>} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
