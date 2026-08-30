// Master configuration of all togglable features and sidebar navigation items.

export const MASTER_NAV_CONFIG = [
  // ── MANAGER DEFAULT OVERVIEW (Not togglable, always shown if MANAGER)
  { label: 'Dashboard', icon: '📊', path: '/slt/mgr/overview', roles: ['MANAGER'] },
  { label: 'Dashboard', icon: '📊', path: '/slt/hr/overview', roles: ['HR'] },
  { label: 'Dashboard', icon: '📊', path: '/slt/finance/overview', roles: ['ACCOUNTANT'] },

  // ── MANAGER CORE
  { key: 'assessment_requests', label: 'Assessment Requests', icon: '📋', path: '/slt/mgr/requests', category: 'MANAGER CORE' },
  { key: 'charity_inventory', label: 'Charity Inventory', icon: '📦', path: '/slt/mgr/inventory', category: 'MANAGER CORE' },
  { key: 'minutes_registry', label: 'Minutes Registry', icon: '📝', path: '/slt/mgr/minutes', category: 'MANAGER CORE' },

  // ── DATA ENTRY / HUB
  { label: 'Data Entry Hub', icon: '📝', path: '/slt/entry/hub', roles: ['DATA_ENTRY'] },
  
  // ── FINANCE & DONATIONS
  { key: 'donation_entry', label: 'Donation Entry', icon: '💝', path: '/slt/entry/donation', category: 'FINANCE & DONATIONS' },
  { key: 'purchase_entry', label: 'Purchase Entry', icon: '🛒', path: '/slt/entry/purchase', category: 'FINANCE & DONATIONS' },
  { key: 'promoters_verification', label: 'Verification Dashboard', icon: '✅', path: '/slt/entry/verification', category: 'FINANCE & DONATIONS' },
  { key: 'promoters_registry', label: 'Promoters Registry', icon: '🧾', path: '/slt/entry/promoters-registry', category: 'FINANCE & DONATIONS' },

  // ── PEOPLE & RELATIONS
  { key: 'membership_entry', label: 'Membership Entry', icon: '🪪', path: '/slt/entry/membership', category: 'PEOPLE & RELATIONS' },
  { key: 'partners_entry', label: 'Partners Entry', icon: '🤝', path: '/slt/entry/partners', category: 'PEOPLE & RELATIONS' },
  { key: 'events_entry', label: 'Events & News', icon: '📢', path: '/slt/entry/events', category: 'PEOPLE & RELATIONS' },

  // ── CHARITY ASSETS
  { key: 'inward_entry', label: 'Inward Entry', icon: '📥', path: '/slt/entry/inward', category: 'CHARITY ASSETS' },
  { key: 'outward_entry', label: 'Outward Entry', icon: '📤', path: '/slt/entry/outward', category: 'CHARITY ASSETS' },

  // ── MATERIAL INVENTORY
  { key: 'material_inward', label: 'Material Inward', icon: '📦', path: '/slt/entry/material-inward', category: 'MATERIAL INVENTORY' },
  { key: 'material_outward', label: 'Material Outward', icon: '📤', path: '/slt/entry/material-outward', category: 'MATERIAL INVENTORY' },

  // ── FINANCE ACCOUNTING
  { key: 'donations_view', label: 'Donations', icon: '💝', path: '/slt/finance/donations', category: 'LEDGERS' },
  { key: 'cash_book', label: 'Cash Book', icon: '💵', path: '/slt/finance/cash-ledger', category: 'LEDGERS' },
  { key: 'bank_ledger', label: 'Bank', icon: '🏦', path: '/slt/finance/bank-ledger', category: 'LEDGERS' },
  { key: 'income_view', label: 'Income', icon: '📥', path: '/slt/finance/income', category: 'LEDGERS' },
  { key: 'expenses_view', label: 'Expenses', icon: '📤', path: '/slt/finance/expenditure', category: 'LEDGERS' },
  
  // ── FINANCE TRANSACTIONS
  { key: 'cheques', label: 'Cheques', icon: '🧾', path: '/slt/finance/cheques', category: 'TRANSACTIONS' },
  { key: 'transfers', label: 'Transfers', icon: '🔄', path: '/slt/finance/transfers', category: 'TRANSACTIONS' },
  { key: 'transactions', label: 'Transactions', icon: '📋', path: '/slt/finance/transactions', category: 'TRANSACTIONS' },
  
  // ── FINANCE PAYOUTS & CLOSING
  { key: 'pending_payouts', label: 'Pending Payouts', icon: '⏳', path: '/slt/disburse/pending', category: 'PAYOUTS & CLOSING' },
  { key: 'money_requests', label: 'Money Requests', icon: '💰', path: '/slt/finance/fund-requests', category: 'PAYOUTS & CLOSING' },
  { key: 'salary_review', label: 'Pending Salaries', icon: '🧑‍💼', path: '/slt/finance/salary-review', category: 'PAYOUTS & CLOSING' },
  { key: 'payouts', label: 'Payouts', icon: '💸', path: '/slt/disburse/payouts', category: 'PAYOUTS & CLOSING' },
  { key: 'cash_closing', label: 'Cash Closing', icon: '🔒', path: '/slt/disburse/daily-close', category: 'PAYOUTS & CLOSING' },

  // ── HR: TIME & PAYROLL
  { key: 'hr_attendance', label: 'Attendance', icon: '✅', path: '/slt/hr/attendance', category: 'TIME & PAYROLL' },
  { key: 'hr_leave', label: 'Leave Management', icon: '📅', path: '/slt/hr/leave', category: 'TIME & PAYROLL' },
  { key: 'hr_payroll', label: 'Salary & Payroll', icon: '💰', path: '/slt/hr/payroll', category: 'TIME & PAYROLL' },
  { key: 'hr_payment_advances', label: 'Payment Advances', icon: '💵', path: '/slt/hr/payment-advances', category: 'TIME & PAYROLL' },

  // ── HR: DIRECTORY
  { key: 'hr_members', label: 'Members', icon: '👥', path: '/slt/hr/members', category: 'DIRECTORY' },
  { key: 'hr_volunteers', label: 'Volunteers', icon: '🙋', path: '/slt/hr/volunteers', category: 'DIRECTORY' },
  { key: 'hr_exec_members', label: 'Executive Members', icon: '👔', path: '/slt/hr/executive-members', category: 'DIRECTORY' },
  { key: 'hr_officers', label: 'Staff Members', icon: '👨‍💼', path: '/slt/hr/officers', category: 'DIRECTORY' },

  // ── HR: SUPPORT & PERFORMANCE
  { key: 'hr_complaints', label: 'Complaints', icon: '🗣️', path: '/slt/hr/complaints', category: 'SUPPORT & PERFORMANCE' },
  { key: 'hr_staff_reports', label: 'Staff Reports', icon: '📄', path: '/slt/hr/staff-reports', category: 'SUPPORT & PERFORMANCE' },
  { key: 'hr_performance', label: 'Achieved Points', icon: '🏆', path: '/slt/hr/performance', category: 'SUPPORT & PERFORMANCE' },

  // ── SHARED (Available dynamically to anyone with the feature)
  { key: 'scheduled_payouts', label: 'Scheduled Payouts', icon: '🎯', path: '/slt/shared/scheduled-payouts', category: 'SHARED FEATURES' },
  { key: 'analytics_reports', label: 'Analytics Reports', icon: '📈', path: '/slt/shared/analytics', category: 'SHARED FEATURES' },
]

export const ADMIN_NAV_CONFIG = [
  { label: 'User Management', icon: '👤', path: '/slt/sys/user-control' },
  { label: 'Feature Access', icon: '🔐', path: '/slt/sys/feature-access' },
  { label: 'Mobile Access', icon: '📱', path: '/slt/sys/mobile-access' },
  { label: 'Audit Log', icon: '🔍', path: '/slt/sys/audit-trail' },
  { label: 'Reports', icon: '📈', path: '/slt/shared/analytics' },
]
