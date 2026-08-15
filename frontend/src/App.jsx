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
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles.length > 0 && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

// ── Role-based home redirect ───────────────────────────────
function HomeRedirect() {
  const { user } = useAuthStore()
  const roleHome = {
    MANAGER: '/manager/dashboard',
    ACCOUNTANT: '/accounts/dashboard',
    CASHIER: '/cashier/pending',
    HR: '/hr/dashboard',
    ADMIN: '/admin/users',
    DATA_ENTRY: '/data-entry',
  }
  return <Navigate to={roleHome[user?.role] || '/login'} replace />
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
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />

        {/* Protected */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<HomeRedirect />} />

          {/* Manager */}
          <Route path="manager/dashboard" element={<ProtectedRoute roles={['MANAGER','ADMIN']}><ManagerDashboard /></ProtectedRoute>} />
          <Route path="manager/requests" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','ADMIN']}><Requests /></ProtectedRoute>} />
          <Route path="manager/requests/:id" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','CASHIER','ADMIN']}><RequestDetail /></ProtectedRoute>} />
          <Route path="manager/minutes" element={<ProtectedRoute roles={['MANAGER','ADMIN']}><Minutes /></ProtectedRoute>} />
          <Route path="manager/partners" element={<ProtectedRoute roles={['MANAGER','ADMIN']}><Partners /></ProtectedRoute>} />
          <Route path="manager/inventory" element={<ProtectedRoute roles={['MANAGER','ADMIN']}><Inventory /></ProtectedRoute>} />

          {/* Accounts */}
          <Route path="accounts/dashboard" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><AccountsDashboard /></ProtectedRoute>} />
          <Route path="accounts/overview" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><AccountsOverview /></ProtectedRoute>} />
          <Route path="accounts/money-requests" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><MoneyRequests /></ProtectedRoute>} />
          <Route path="accounts/cash" element={<ProtectedRoute roles={['ACCOUNTANT','CASHIER','ADMIN']}><CashBook /></ProtectedRoute>} />
          <Route path="accounts/bank" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><BankAccounts /></ProtectedRoute>} />
          <Route path="accounts/income" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><IncomeList /></ProtectedRoute>} />
          <Route path="accounts/expenses" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><ExpenseList /></ProtectedRoute>} />
          <Route path="accounts/cheques" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><ChequeList /></ProtectedRoute>} />
          <Route path="accounts/transfers" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><TransferList /></ProtectedRoute>} />
          <Route path="accounts/transactions" element={<ProtectedRoute roles={['ACCOUNTANT','CASHIER','ADMIN']}><TransactionList /></ProtectedRoute>} />
          <Route path="accounts/pending-salaries" element={<ProtectedRoute roles={['ACCOUNTANT','ADMIN']}><PendingSalaries /></ProtectedRoute>} />

          {/* Cashier */}
          <Route path="cashier/pending" element={<ProtectedRoute roles={['CASHIER','ACCOUNTANT','ADMIN']}><PendingDisbursements /></ProtectedRoute>} />
          <Route path="cashier/disbursements" element={<ProtectedRoute roles={['CASHIER','ACCOUNTANT','ADMIN']}><DisbursementList /></ProtectedRoute>} />
          <Route path="cashier/closing" element={<ProtectedRoute roles={['CASHIER','ACCOUNTANT','ADMIN']}><CashClosing /></ProtectedRoute>} />

          {/* HR */}
          <Route path="hr/dashboard" element={<ProtectedRoute roles={['HR','ADMIN']}><HRDashboard /></ProtectedRoute>} />
          <Route path="hr/members" element={<ProtectedRoute roles={['HR','ADMIN']}><Members /></ProtectedRoute>} />
          <Route path="hr/volunteers" element={<ProtectedRoute roles={['HR','ADMIN']}><Volunteers /></ProtectedRoute>} />
          <Route path="hr/executive-members" element={<ProtectedRoute roles={['HR','ADMIN']}><ExecMembers /></ProtectedRoute>} />
          <Route path="hr/officers" element={<ProtectedRoute roles={['HR','ADMIN']}><Officers /></ProtectedRoute>} />
          <Route path="hr/attendance" element={<ProtectedRoute roles={['HR','ADMIN']}><AttendancePage /></ProtectedRoute>} />
          <Route path="hr/leave" element={<ProtectedRoute roles={['HR','ADMIN']}><LeavePage /></ProtectedRoute>} />
          <Route path="hr/payroll" element={<ProtectedRoute roles={['HR','ADMIN']}><PayrollPage /></ProtectedRoute>} />
          <Route path="hr/complaints" element={<ProtectedRoute roles={['HR','ADMIN']}><Complaints /></ProtectedRoute>} />

          {/* Shared */}
          <Route path="payouts" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','DATA_ENTRY','ADMIN']}><ScheduledPayouts /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="admin/users" element={<ProtectedRoute roles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
          <Route path="admin/audit-log" element={<ProtectedRoute roles={['ADMIN']}><AuditLogPage /></ProtectedRoute>} />

          {/* Data Entry */}
          <Route path="data-entry" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><DataEntryDashboard /></ProtectedRoute>} />
          <Route path="data-entry/inward" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><InwardEntry /></ProtectedRoute>} />
          <Route path="data-entry/outward" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><OutwardEntry /></ProtectedRoute>} />
          <Route path="data-entry/purchase" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><PurchaseEntry /></ProtectedRoute>} />
          <Route path="data-entry/donation" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><DonationEntry /></ProtectedRoute>} />
          <Route path="data-entry/membership" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><MembershipEntry /></ProtectedRoute>} />
          <Route path="data-entry/partners" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><PartnersEntry /></ProtectedRoute>} />
          <Route path="data-entry/material-inward" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><MaterialInward /></ProtectedRoute>} />
          <Route path="data-entry/material-outward" element={<ProtectedRoute roles={['MANAGER','ACCOUNTANT','HR','ADMIN','DATA_ENTRY']}><MaterialOutward /></ProtectedRoute>} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
