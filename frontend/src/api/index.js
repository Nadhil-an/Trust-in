import axios from 'axios'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') + '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor ────────────────────────────────────
api.interceptors.request.use(config => {
  // If sending FormData, delete Content-Type header so the browser automatically sets multipart/form-data with the correct boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  // CSRF token (if needed for non-GET)
  const csrfToken = document.cookie
    .split(';')
    .find(c => c.trim().startsWith('csrftoken='))
    ?.split('=')[1]
  if (csrfToken) config.headers['X-CSRFToken'] = csrfToken
  return config
})

// ── Response interceptor — auto refresh on 401 ─────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config
    if (!originalRequest) return Promise.reject(error)

    const url = originalRequest.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest)).catch(err => Promise.reject(err))
      }
      originalRequest._retry = true
      isRefreshing = true
      try {
        await api.post('/auth/refresh/', {}, { _retry: true })
        processQueue(null)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('slt-auth')
          if (window.location.pathname !== '/slt/portal/auth') {
            window.location.href = '/slt/portal/auth'
          }
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ── Auth ───────────────────────────────────────────────────
export const authApi = {
  login: (credentials) => api.post('/auth/login/', credentials),
  logout: () => api.post('/auth/logout/'),
  profile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.patch('/auth/profile/', data),
  changePassword: (data) => api.post('/auth/change-password/', data),
}

// ── Manager ────────────────────────────────────────────────
export const managerApi = {
  dashboard: () => api.get('/manager/dashboard/'),
  requests: {
    list: (params) => api.get('/manager/requests/', { params }),
    create: (data) => api.post('/manager/requests/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    get: (id) => api.get(`/manager/requests/${id}/`),
    update: (id, data) => api.patch(`/manager/requests/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    delete: (id) => api.delete(`/manager/requests/${id}/`),
    // action now takes action in the body
    action: (id, action, data) => api.post(`/manager/requests/${id}/action/`, { action, ...data }),
    history: (id) => api.get(`/manager/requests/${id}/history/`),
  },
  // FAO / ACO / GEO reports
  faoReport: {
    get: (id) => api.get(`/manager/requests/${id}/fao-report/`),
  },
  acoCalculation: {
    get: (id) => api.get(`/manager/requests/${id}/aco-calculation/`),
  },
  geoReport: {
    get: (id) => api.get(`/manager/requests/${id}/geo-report/`),
  },
  // Charity inventory
  inventory: {
    list: (params) => api.get('/manager/inventory/', { params }),
    get: (id) => api.get(`/manager/inventory/${id}/`),
    create: (data) => api.post('/manager/inventory/', data),
    update: (id, data) => api.patch(`/manager/inventory/${id}/`, data),
    delete: (id) => api.delete(`/manager/inventory/${id}/`),
  },
  inventoryTransactions: {
    list: (params) => api.get('/manager/inventory-transactions/', { params }),
    create: (data) => api.post('/manager/inventory-transactions/', data),
    update: (id, data) => api.patch(`/manager/inventory-transactions/${id}/`, data),
    delete: (id) => api.delete(`/manager/inventory-transactions/${id}/`),
  },
  stockInwardPurchase: {
    list: (params) => api.get('/manager/stock-inward-purchase/', { params }),
    get: (id) => api.get(`/manager/stock-inward-purchase/${id}/`),
    create: (data) => api.post('/manager/stock-inward-purchase/', data),
    update: (id, data) => api.patch(`/manager/stock-inward-purchase/${id}/`, data),
    delete: (id) => api.delete(`/manager/stock-inward-purchase/${id}/`),
  },
  minutes: {
    list: (params) => api.get('/manager/minutes/', { params }),
    create: (data) => api.post('/manager/minutes/', data),
    get: (id) => api.get(`/manager/minutes/${id}/`),
    update: (id, data) => api.patch(`/manager/minutes/${id}/`, data),
    delete: (id) => api.delete(`/manager/minutes/${id}/`),
  },
  partners: {
    list: (params) => api.get('/manager/partners/', { params }),
    create: (data) => api.post('/manager/partners/', data),
    get: (id) => api.get(`/manager/partners/${id}/`),
    update: (id, data) => api.patch(`/manager/partners/${id}/`, data),
    delete: (id) => api.delete(`/manager/partners/${id}/`),
  },
  scheduledPayouts: {
    list: (params) => api.get('/manager/payouts/', { params }),
    create: (data) => api.post('/manager/payouts/', data),
    get: (id) => api.get(`/manager/payouts/${id}/`),
    update: (id, data) => api.patch(`/manager/payouts/${id}/`, data),
    delete: (id) => api.delete(`/manager/payouts/${id}/`),
  },
}


// ── Accounts ───────────────────────────────────────────────
export const accountsApi = {
  dashboard: (params) => api.get('/accounts/dashboard/', { params }),
  totalFunds: () => api.get('/accounts/total-funds/'),
  cash: {
    accounts: () => api.get('/accounts/cash/'),
    transactions: (params) => api.get('/accounts/cash/transactions/', { params }),
    addTransaction: (data) => api.post('/accounts/cash/transactions/', data),
  },
  bank: {
    accounts: () => api.get('/accounts/bank/'),
    createAccount: (data) => api.post('/accounts/bank/', data),
    transactions: (params) => api.get('/accounts/bank/transactions/', { params }),
    addTransaction: (data) => api.post('/accounts/bank/transactions/', data),
    reconciliation: (params) => api.get('/accounts/bank/reconciliation/', { params }),
  },
  income: {
    list: (params) => api.get('/accounts/income/', { params }),
    create: (data) => api.post('/accounts/income/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    get: (id) => api.get(`/accounts/income/${id}/`),
    update: (id, data) => api.patch(`/accounts/income/${id}/`, data),
    delete: (id) => api.delete(`/accounts/income/${id}/`),
  },
  expenses: {
    list: (params) => api.get('/accounts/expenses/', { params }),
    create: (data) => api.post('/accounts/expenses/', data),
    get: (id) => api.get(`/accounts/expenses/${id}/`),
    update: (id, data) => api.patch(`/accounts/expenses/${id}/`, data),
    delete: (id) => api.delete(`/accounts/expenses/${id}/`),
  },
  cheques: {
    list: (params) => api.get('/accounts/cheques/', { params }),
    create: (data) => api.post('/accounts/cheques/', data),
    update: (id, data) => api.patch(`/accounts/cheques/${id}/`, data),
  },
  transfers: {
    list: (params) => api.get('/accounts/transfers/', { params }),
    create: (data) => api.post('/accounts/transfers/', data),
  },
  transactions: {
    list: (params) => api.get('/accounts/transactions/', { params }),
    get: (id) => api.get(`/accounts/transactions/${id}/`),
  },
  moneyRequests: () => api.get('/accounts/money-requests/'),
  daySheet: (params) => api.get('/accounts/day-sheet/', { params }),
  pendingSalaries: {
    list: () => api.get('/accounts/pending-salaries/'),
    pay: (id, data) => api.post(`/accounts/salaries/${id}/pay/`, data),
  }
}

// ── Cashier ────────────────────────────────────────────────
export const cashierApi = {
  dashboard: () => api.get('/cashier/dashboard/'),
  pending: () => api.get('/cashier/pending/'),
  disburse: (id, data) => api.post(`/cashier/disburse/${id}/`, data),
  disbursements: (params) => api.get('/cashier/disbursements/', { params }),
  cashClosing: {
    list: () => api.get('/cashier/cash-closing/'),
    create: (data) => api.post('/cashier/cash-closing/', data),
  },
  handover: {
    list: () => api.get('/cashier/handover/'),
    create: (data) => api.post('/cashier/handover/', data),
  },
}

// ── HR ─────────────────────────────────────────────────────
export const hrApi = {
  dashboard:      () => api.get('/hr/dashboard/'),
  birthdayAlerts: () => api.get('/hr/birthday-alerts/'),
  members: {
    list: (params) => api.get('/hr/members/', { params }),
    create: (data) => api.post('/hr/members/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    get: (id) => api.get(`/hr/members/${id}/`),
    update: (id, data) => api.patch(`/hr/members/${id}/`, data),
    resetPassword: (id, data) => api.post(`/hr/members/${id}/reset-password/`, data),
    delete: (id) => api.delete(`/hr/members/${id}/`),
    documents: (id) => api.get(`/hr/members/${id}/documents/`),
  },
  volunteers: {
    list: (params) => api.get('/hr/volunteers/', { params }),
    create: (data) => api.post('/hr/volunteers/', data),
    get: (id) => api.get(`/hr/volunteers/${id}/`),
    update: (id, data) => api.patch(`/hr/volunteers/${id}/`, data),
    delete: (id) => api.delete(`/hr/volunteers/${id}/`),
    approve: (id) => api.post(`/hr/volunteers/${id}/approve/`),
    reject: (id, data) => api.post(`/hr/volunteers/${id}/reject/`, data),
  },
  execMembers: {
    list: (params) => api.get('/hr/executive-members/', { params }),
    create: (data) => api.post('/hr/executive-members/', data),
    get: (id) => api.get(`/hr/executive-members/${id}/`),
    update: (id, data) => api.patch(`/hr/executive-members/${id}/`, data),
    delete: (id) => api.delete(`/hr/executive-members/${id}/`),
  },
  officers: {
    list: (params) => api.get('/hr/officers/', { params }),
    designations: () => api.get('/hr/officers/designations/'),
    create: (data) => api.post('/hr/officers/', data),
    get: (id) => api.get(`/hr/officers/${id}/`),
    update: (id, data) => api.patch(`/hr/officers/${id}/`, data),
    delete: (id, data) => api.delete(`/hr/officers/${id}/`, { data }),
    reactivate: (id, data) => api.post(`/hr/officers/${id}/reactivate/`, data),
    resetPassword: (id, data) => api.post(`/hr/officers/${id}/reset-password/`, data),
    documents: (id) => api.get(`/hr/officers/${id}/documents/`),
    attendanceGraph: (id, params) => api.get(`/hr/officers/${id}/attendance-graph/`, { params }),
    payrollData: (id, params) => api.get(`/hr/officers/${id}/payroll-data/`, { params }),
  },
  attendance: {
    list: (params) => api.get('/hr/attendance/', { params }),
    mark: (data) => api.post('/hr/attendance/', data),
    bulk: (data) => api.post('/hr/attendance/bulk/', data),
  },
  leave: {
    list: (params) => api.get('/hr/leave/', { params }),
    get: (id) => api.get(`/hr/leave/${id}/`),
    create: (data) => api.post('/hr/leave/', data),
    action: (id, data) => api.post(`/hr/leave/${id}/action/`, data),
    getNotes: (id) => api.get(`/hr/leave/${id}/notes/`),
    addNote: (id, data) => api.post(`/hr/leave/${id}/notes/`, data),
    getCommunications: (id) => api.get(`/hr/leave/${id}/communicate/`),
    sendCommunication: (id, data) => api.post(`/hr/leave/${id}/communicate/`, data),
  },
  payroll: {
    list: (params) => api.get('/hr/payroll/', { params }),
    create: (data) => api.post('/hr/payroll/', data),
    get: (id) => api.get(`/hr/payroll/${id}/`),
    update: (id, data) => api.patch(`/hr/payroll/${id}/`, data),
  },
  salaryStructures: {
    list: (params) => api.get('/hr/salary-structures/', { params }),
    create: (data) => api.post('/hr/salary-structures/', data),
  },
  complaints: {
    list: (params) => api.get('/hr/complaints/', { params }),
    create: (data) => api.post('/hr/complaints/', data),
    get: (id) => api.get(`/hr/complaints/${id}/`),
    update: (id, data) => api.patch(`/hr/complaints/${id}/`, data),
  },
  staffReports: {
    list: (params) => api.get('/hr/staff-reports/', { params }),
    create: (data) => api.post('/hr/staff-reports/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    get: (id) => api.get(`/hr/staff-reports/${id}/`),
    update: (id, data) => api.patch(`/hr/staff-reports/${id}/`, data),
  },
  paymentAdvances: {
    list: (params) => api.get('/hr/payment-advances/', { params }),
    create: (data) => api.post('/hr/payment-advances/', data),
    get: (id) => api.get(`/hr/payment-advances/${id}/`),
    update: (id, data) => api.patch(`/hr/payment-advances/${id}/`, data),
    action: (id, data) => api.post(`/hr/payment-advances/${id}/action/`, data),
  },
  performancePoints: {
    list: (params) => api.get('/hr/performance-points/', { params }),
    create: (data) => api.post('/hr/performance-points/', data),
    leaderboard: (params) => api.get('/hr/performance-points/leaderboard/', { params }),
  },
  vouchers: {
    list: () => api.get('/hr/staff-vouchers/'),
    get: (staffId) => api.get(`/hr/staff-vouchers/${staffId}/`),
    update: (staffId, data) => api.patch(`/hr/staff-vouchers/${staffId}/`, data),
    increment: (staffId) => api.post(`/hr/staff-vouchers/${staffId}/increment/`),
    activateNext: (staffId) => api.post(`/hr/staff-vouchers/${staffId}/activate-next/`),
  },
  promoterRegistry: {
    list: (params) => api.get('/hr/promoter-registry/', { params }),
    create: (data) => api.post('/hr/promoter-registry/', data),
    update: (id, data) => api.patch(`/hr/promoter-registry/${id}/`, data),
    get: (id) => api.get(`/hr/promoter-registry/${id}/`),
    delete: (id) => api.delete(`/hr/promoter-registry/${id}/`),
    dailySummary: (date, extraParams = {}) => api.get('/hr/promoter-registry/daily-summary/', { params: { date, ...extraParams } }),
    checkClosed: (staffId, date) => api.get('/hr/promoter-registry/is-closed/', { params: { staff_id: staffId, date } }),
    closeDay: (id, cashSubmitted) => api.patch(`/hr/promoter-registry/${id}/`, { is_closed: true, cash_submitted: cashSubmitted }),
    transactions: (staffId, date) => api.get('/hr/promoter-registry/transactions/', { params: { staff_id: staffId, date } }),
  },
}


// ── Reports ────────────────────────────────────────────────
export const reportsApi = {
  requests: (params) => api.get('/reports/requests/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  cashBook: (params) => api.get('/reports/cash-book/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  income: (params) => api.get('/reports/income/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  expenses: (params) => api.get('/reports/expenses/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  members: (params) => api.get('/reports/members/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  payroll: (params) => api.get('/reports/payroll/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  transactions: (params) => api.get('/reports/transactions/', { params, responseType: params.format === 'json' ? 'json' : 'blob' }),
  staffPerformance: (params) => api.get('/reports/staff-performance/', { params }),
}

// ── Core ───────────────────────────────────────────────────
export const coreApi = {
  users: {
    list: (params) => api.get('/core/users/', { params }),
    create: (data) => api.post('/core/users/', data),
    update: (id, data) => api.patch(`/core/users/${id}/`, data),
    delete: (id) => api.delete(`/core/users/${id}/`),
  },
  auditLog: (params) => api.get('/core/audit-log/', { params }),
  notifications: () => api.get('/core/notifications/'),
  markRead: (id) => api.post(`/core/notifications/${id}/read/`),
  markAllRead: (id) => api.delete(`/core/notifications/${id}/read/`),
  search: (q) => api.get('/core/search/', { params: { q } }),
  events: {
    list: (params) => api.get('/core/events/', { params }),
    get: (id) => api.get(`/core/events/${id}/`),
    create: (data) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (key === 'image' && val instanceof File) {
          formData.append('image', val);
        } else if (val !== null && val !== undefined) {
          formData.append(key, String(val));
        }
      });
      return api.post('/core/events/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    update: (id, data) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (key === 'image' && val instanceof File) {
          formData.append('image', val);
        } else if (val !== null && val !== undefined) {
          formData.append(key, String(val));
        }
      });
      return api.patch(`/core/events/${id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    delete: (id) => api.delete(`/core/events/${id}/`),
  },
  features: {
    listMyFeatures: () => api.get('/core/features/'),
    listAllFeatures: () => api.get('/core/features/?all=true'),
    updateFeatureRoles: (data) => api.post('/core/features/', data),
  },
  socialAnalytics: {
    get: (params) => api.get('/core/social-analytics/', { params }),
  },
  memberPosts: {
    list: (params) => api.get('/core/member-posts/', { params }),
    get: (id) => api.get(`/core/member-posts/${id}/`),
    create: (data) => api.post('/core/member-posts/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    approve: (id) => api.post(`/core/member-posts/${id}/approve/`),
    reject: (id, data) => api.post(`/core/member-posts/${id}/reject/`, data || {}),
    togglePin: (id) => api.post(`/core/member-posts/${id}/toggle-pin/`),
    forwardToFao: (id, data) => api.post(`/core/member-posts/${id}/forward-to-fao/`, data),
    delete: (id) => api.delete(`/core/member-posts/${id}/`),
  },
  verifications: {
    list: (params) => api.get('/core/verifications/', { params }),
    get: (id) => api.get(`/core/verifications/${id}/`),
    approve: (id) => api.post(`/core/verifications/${id}/approve/`),
    reject: (id, data) => api.post(`/core/verifications/${id}/reject/`, data),
  },
  pomMessages: {
    list: (params) => api.get('/core/pom-messages/', { params }),
    get: (id) => api.get(`/core/pom-messages/${id}/`),
    create: (data) => api.post('/core/pom-messages/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    update: (id, data) => api.put(`/core/pom-messages/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    delete: (id) => api.delete(`/core/pom-messages/${id}/`),
    togglePin: (id) => api.post(`/core/pom-messages/${id}/toggle-pin/`),
    changeStatus: (id, data) => api.post(`/core/pom-messages/${id}/change-status/`, data),
  },
  socialPolls: {
    list: (params) => api.get('/core/social-polls/', { params }),
    get: (id) => api.get(`/core/social-polls/${id}/`),
    create: (data) => api.post('/core/social-polls/', data),
    vote: (id, data) => api.post(`/core/social-polls/${id}/vote/`, data),
    close: (id) => api.post(`/core/social-polls/${id}/close/`),
    delete: (id) => api.delete(`/core/social-polls/${id}/`),
    results: (id) => api.get(`/core/social-polls/${id}/results/`),
  }
}

export const mrmApi = {
  overview: () => api.get('/mrm/overview/'),
  members: {
    list: (params) => api.get('/mrm/members/', { params }),
    get: (id) => api.get(`/mrm/members/${id}/`),
    getInteractions: (memberId) => api.get(`/mrm/members/${memberId}/interactions/`),
    createInteraction: (memberId, data) => api.post(`/mrm/members/${memberId}/interactions/`, data),
  },
  tasks: {
    list: (params) => api.get('/mrm/tasks/', { params }),
    get: (id) => api.get(`/mrm/tasks/${id}/`),
    create: (data) => api.post('/mrm/tasks/', data),
    update: (id, data) => api.patch(`/mrm/tasks/${id}/`, data),
    delete: (id) => api.delete(`/mrm/tasks/${id}/`),
    submit: (id, data) => api.post(`/mrm/tasks/${id}/submit/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    review: (id, data) => api.post(`/mrm/tasks/${id}/review/`, data),
    myTasks: () => api.get('/mrm/tasks/my-tasks/'),
  },
  badges: {
    list: () => api.get('/mrm/badges/'),
    update: (badgeKey, data) => api.patch(`/mrm/badges/${badgeKey}/`, data),
    awards: (params) => api.get('/mrm/badges-awards/', { params }),
    awardManual: (data) => api.post('/mrm/badges-awards/manual/', data),
    evaluate: (data) => api.post('/mrm/badges-evaluate/', data || {}),
  },
  achievements: {
    list: (params) => api.get('/mrm/achievements/', { params }),
    grant: (data) => api.post('/mrm/achievements/', data),
  },
  volunteers: {
    list: (params) => api.get('/mrm/volunteers/', { params }),
    updateStatus: (id, data) => api.patch(`/mrm/volunteers/${id}/status/`, data),
    allowances: (params) => api.get('/mrm/volunteers/allowances/', { params }),
    saveAllowance: (data) => api.post('/mrm/volunteers/allowances/', data),
    approveAllowance: (id, data) => api.post(`/mrm/volunteers/allowances/${id}/approve/`, data),
  },
  appreciations: {
    list: () => api.get('/mrm/appreciations/'),
    publish: (data) => api.post('/mrm/appreciations/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  }
};
