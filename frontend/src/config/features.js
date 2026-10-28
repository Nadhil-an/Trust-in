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
  { key: 'volunteers', label: 'Volunteers', icon: '🙋', path: '/slt/mgr/volunteers', category: 'MANAGER CORE', roles: ['MANAGER', 'ADMIN', 'HR'] },

  // ── DATA ENTRY / HUB
  { label: 'Data Entry Hub', icon: '📝', path: '/slt/entry/hub', roles: ['DATA_ENTRY'] },
  
  // ── FINANCE & DONATIONS
  { key: 'donation_entry', label: 'Donation Entry', icon: '💝', path: '/slt/entry/donation', category: 'FINANCE & DONATIONS' },
  { key: 'donation_registry', label: 'Donation Registry', icon: '📖', path: '/slt/entry/donation-registry', category: 'FINANCE & DONATIONS' },
  { key: 'purchase_entry', label: 'Purchase Entry', icon: '🛒', path: '/slt/entry/purchase', category: 'FINANCE & DONATIONS' },
  { key: 'promoters_verification', label: 'Verification Dashboard', icon: '✅', path: '/slt/entry/verification', category: 'FINANCE & DONATIONS' },
  { key: 'promoters_registry', label: 'Promoters Registry', icon: '🧾', path: '/slt/entry/promoters-registry', category: 'FINANCE & DONATIONS' },

  // ── SOCIAL MEDIA MODULE (Only these 4 sections and 11 elements)
  { key: 'social_analytics', label: 'Platform Analytics', icon: '📊', path: '/slt/social/overview?tab=analytics', category: 'PLATFORM INSIGHTS', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },

  // ── MEMBER MANAGEMENT (MRM)
  { key: 'social_mrm_members', label: 'Member Directory', icon: '👥', path: '/slt/social/overview?tab=mrm_members', category: 'MEMBER MANAGEMENT (MRM)', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_mrm_tasks', label: 'Tasks & Targets', icon: '🎯', path: '/slt/social/overview?tab=mrm_tasks', category: 'MEMBER MANAGEMENT (MRM)', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_mrm_badges', label: 'Badges & Recognition', icon: '🎖️', path: '/slt/social/overview?tab=mrm_badges', category: 'MEMBER MANAGEMENT (MRM)', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_mrm_volunteers', label: 'Volunteers & Desk', icon: '🤝', path: '/slt/social/overview?tab=mrm_volunteers', category: 'MEMBER MANAGEMENT (MRM)', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_mrm_appreciation', label: 'Appreciation Studio', icon: '🏆', path: '/slt/social/overview?tab=mrm_appreciation', category: 'MEMBER MANAGEMENT (MRM)', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },

  // ── MODERATION & GOVERNANCE
  { key: 'social_posts', label: 'Post Moderation', icon: '🛡️', path: '/slt/social/overview?tab=posts', category: 'MODERATION & GOVERNANCE', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_verifications', label: 'Account Verification', icon: '🪪', path: '/slt/social/overview?tab=verifications', category: 'MODERATION & GOVERNANCE', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },

  // ── BROADCASTS & PARTICIPATION
  { key: 'social_official', label: 'Official Trust Publishing', icon: '📢', path: '/slt/social/overview?tab=official', category: 'BROADCASTS & PARTICIPATION', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_pom', label: 'Public Cooperation (POM)', icon: '🤝', path: '/slt/social/overview?tab=pom', category: 'BROADCASTS & PARTICIPATION', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'social_voting', label: 'Voting & Polls', icon: '🗳️', path: '/slt/social/overview?tab=voting', category: 'BROADCASTS & PARTICIPATION', roles: ['SOCIAL_MEDIA', 'MANAGER', 'ADMIN'] },
  { key: 'membership_entry', label: 'Membership Entry', icon: '🪪', path: '/slt/entry/membership', category: 'PEOPLE & RELATIONS' },
  { label: 'Assessment Entry', icon: '📋', path: '/slt/entry/assessment', category: 'PEOPLE & RELATIONS', roles: ['DATA_ENTRY', 'MANAGER', 'ADMIN'] },
  { key: 'partners_entry', label: 'Partners Entry', icon: '🤝', path: '/slt/entry/partners', category: 'PEOPLE & RELATIONS' },
  { key: 'events_entry', label: 'Events & News', icon: '📢', path: '/slt/entry/events', category: 'PEOPLE & RELATIONS' },

  // ── STOCK MANAGEMENT
  { key: 'inward_entry', label: 'Inward / Purchase Entry', icon: '📥', path: '/slt/entry/inward', category: 'STOCK MANAGEMENT' },
  { key: 'material_outward', label: 'Material Outward Entry', icon: '📤', path: '/slt/entry/material-outward', category: 'STOCK MANAGEMENT' },
  { key: 'assets_in_stock', label: 'Assets in Stock', icon: '📦', path: '/slt/entry/assets-in-stock', category: 'STOCK MANAGEMENT' },


  // ── FINANCE ACCOUNTING
  { key: 'donations_view', label: 'Donations', icon: '💝', path: '/slt/finance/donations', category: 'LEDGERS' },
  { key: 'cash_book', label: 'Cash Book', icon: '💵', path: '/slt/finance/cash-ledger', category: 'LEDGERS' },
  { key: 'bank_ledger', label: 'Bank', icon: '🏦', path: '/slt/finance/bank-ledger', category: 'LEDGERS' },
  { key: 'income_view', label: 'Income', icon: '📥', path: '/slt/finance/income', category: 'LEDGERS' },
  { key: 'expenses_view', label: 'Expenses', icon: '📤', path: '/slt/finance/expenditure', category: 'LEDGERS' },
  { key: 'cash_closing', label: 'Day Book', icon: '📖', path: '/slt/disburse/day-sheet', category: 'LEDGERS' },
  
  // ── FINANCE TRANSACTIONS
  { key: 'cheques', label: 'Cheques', icon: '🧾', path: '/slt/finance/cheques', category: 'TRANSACTIONS' },
  { key: 'transfers', label: 'Transfers', icon: '🔄', path: '/slt/finance/transfers', category: 'TRANSACTIONS' },
  { key: 'transactions', label: 'Transactions', icon: '📋', path: '/slt/finance/transactions', category: 'TRANSACTIONS' },
  
  // ── FINANCE PAYOUTS & CLOSING
  { key: 'pending_payouts', label: 'Pending Payouts', icon: '⏳', path: '/slt/disburse/pending', category: 'PAYOUTS & CLOSING' },
  { key: 'money_requests', label: 'Money Requests', icon: '💰', path: '/slt/finance/fund-requests', category: 'PAYOUTS & CLOSING' },
  { key: 'salary_review', label: 'Pending Salaries', icon: '🧑‍💼', path: '/slt/finance/salary-review', category: 'PAYOUTS & CLOSING' },
  { key: 'payouts', label: 'Payouts', icon: '💸', path: '/slt/disburse/payouts', category: 'PAYOUTS & CLOSING' },

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
  { label: 'Platform Analytics', icon: '📊', path: '/slt/social/overview?tab=analytics' },
  { label: 'Member Directory', icon: '👥', path: '/slt/social/overview?tab=mrm_members' },
  { label: 'Tasks & Targets', icon: '🎯', path: '/slt/social/overview?tab=mrm_tasks' },
  { label: 'Badges & Recognition', icon: '🎖️', path: '/slt/social/overview?tab=mrm_badges' },
  { label: 'Volunteers & Desk', icon: '🤝', path: '/slt/social/overview?tab=mrm_volunteers' },
  { label: 'Appreciation Studio', icon: '🏆', path: '/slt/social/overview?tab=mrm_appreciation' },
  { label: 'Post Moderation', icon: '🛡️', path: '/slt/social/overview?tab=posts' },
  { label: 'Account Verification', icon: '🪪', path: '/slt/social/overview?tab=verifications' },
  { label: 'Official Trust Publishing', icon: '📢', path: '/slt/social/overview?tab=official' },
  { label: 'Public Cooperation (POM)', icon: '🤝', path: '/slt/social/overview?tab=pom' },
  { label: 'Voting & Polls', icon: '🗳️', path: '/slt/social/overview?tab=voting' },
  { label: 'User Management', icon: '👤', path: '/slt/sys/user-control' },
  { label: 'Feature Access', icon: '🔐', path: '/slt/sys/feature-access' },
  { label: 'Mobile Access', icon: '📱', path: '/slt/sys/mobile-access' },
  { label: 'Audit Log', icon: '🔍', path: '/slt/sys/audit-trail' },
  { label: 'Reports', icon: '📈', path: '/slt/shared/analytics' },
]

export const SOCIAL_MEDIA_NAV_CONFIG = [
  // ── PLATFORM INSIGHTS
  { key: 'social_analytics', label: 'Platform Analytics', icon: '📊', path: '/slt/social/overview?tab=analytics', category: 'PLATFORM INSIGHTS' },

  // ── MEMBER MANAGEMENT (MRM)
  { key: 'social_mrm_members', label: 'Member Directory', icon: '👥', path: '/slt/social/overview?tab=mrm_members', category: 'MEMBER MANAGEMENT (MRM)' },
  { key: 'social_mrm_tasks', label: 'Tasks & Targets', icon: '🎯', path: '/slt/social/overview?tab=mrm_tasks', category: 'MEMBER MANAGEMENT (MRM)' },
  { key: 'social_mrm_badges', label: 'Badges & Recognition', icon: '🎖️', path: '/slt/social/overview?tab=mrm_badges', category: 'MEMBER MANAGEMENT (MRM)' },
  { key: 'social_mrm_volunteers', label: 'Volunteers & Desk', icon: '🤝', path: '/slt/social/overview?tab=mrm_volunteers', category: 'MEMBER MANAGEMENT (MRM)' },
  { key: 'social_mrm_appreciation', label: 'Appreciation Studio', icon: '🏆', path: '/slt/social/overview?tab=mrm_appreciation', category: 'MEMBER MANAGEMENT (MRM)' },

  // ── MODERATION & GOVERNANCE
  { key: 'social_posts', label: 'Post Moderation', icon: '🛡️', path: '/slt/social/overview?tab=posts', category: 'MODERATION & GOVERNANCE' },
  { key: 'social_verifications', label: 'Account Verification', icon: '🪪', path: '/slt/social/overview?tab=verifications', category: 'MODERATION & GOVERNANCE' },

  // ── BROADCASTS & PARTICIPATION
  { key: 'social_official', label: 'Official Trust Publishing', icon: '📢', path: '/slt/social/overview?tab=official', category: 'BROADCASTS & PARTICIPATION' },
  { key: 'social_pom', label: 'Public Cooperation (POM)', icon: '🤝', path: '/slt/social/overview?tab=pom', category: 'BROADCASTS & PARTICIPATION' },
  { key: 'social_voting', label: 'Voting & Polls', icon: '🗳️', path: '/slt/social/overview?tab=voting', category: 'BROADCASTS & PARTICIPATION' },
]
