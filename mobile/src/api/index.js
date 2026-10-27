import axios from 'axios';
import { Config } from '../constants/Config';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/authStore';
import { Alert } from 'react-native';

const api = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: Config.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ── Request Interceptor — attach Bearer token ────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(Config.ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => Promise.reject(error));

// ── Response Interceptor — auto-refresh expired token / force logout only on actual deactivation ──────────
api.interceptors.response.use((response) => response, async (error) => {
  const originalRequest = error.config;
  if (!originalRequest) return Promise.reject(error);

  const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');

  // Handle 401 Unauthorized by attempting a token refresh once
  if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
    originalRequest._retry = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(Config.REFRESH_TOKEN_KEY);
      if (refreshToken) {
        const res = await axios.post(`${Config.API_BASE_URL}/auth/refresh/`, { refresh: refreshToken });
        const newAccess = res.data.access;
        await SecureStore.setItemAsync(Config.ACCESS_TOKEN_KEY, newAccess);
        useAuthStore.getState().updateToken(newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      }
    } catch (e) {
      // Refresh token invalid/expired
      const errCode = e.response?.data?.code;
      if (errCode === 'user_inactive') {
        await SecureStore.deleteItemAsync(Config.ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(Config.REFRESH_TOKEN_KEY);
        Alert.alert(
          'Access Removed',
          'Your access has been removed. Please contact the office.',
          [{ text: 'OK', onPress: () => useAuthStore.getState().logout() }],
          { cancelable: false }
        );
      } else {
        await SecureStore.deleteItemAsync(Config.ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(Config.REFRESH_TOKEN_KEY);
        useAuthStore.getState().logout();
      }
      return Promise.reject(e);
    }
  }

  // NOTE: 403 Forbidden is a permission denial for a specific resource, NOT an account deactivation.
  // Never wipe tokens or force logout on 403!
  return Promise.reject(error);
});

// ── Staff ────────────────────────────────────────────────────────────────
export const staffApi = {
  todayStats:     (date) => api.get('/hr/staff-dashboard/', { params: { date } }),
  birthdayAlerts: () => api.get('/hr/birthday-alerts/'),
  leaderboard:    (p) => api.get('/hr/leaderboard/', { params: p }),
  vouchers: {
    get: (staffId) => api.get(`/hr/staff-vouchers/${staffId}/`),
    increment: (staffId) => api.post(`/hr/staff-vouchers/${staffId}/increment/`),
  },
  checkDayClosed: (staffId, date) => api.get('/hr/promoter-registry/is-closed/', { params: { staff_id: staffId, date } }),
};

// ── Auth  (api/auth/) ────────────────────────────────────────────────────────
export const authApi = {
  login:          (credentials) => api.post('/auth/login/', credentials),
  logout:         ()            => api.post('/auth/logout/'),
  getProfile:     ()            => api.get('/auth/profile/'),
  updateProfile:  (data)        => api.patch('/auth/profile/', data),
  changePassword: (data)        => api.post('/auth/change-password/', data),
  forgotPassword: (data)        => api.post('/auth/forgot-password/', data),
  resetPassword:  (data)        => api.post('/auth/reset-password/', data),
  signup:         (data)        => api.post('/auth/signup/', data),
};

// ── Members  (api/hr/members/) ───────────────────────────────────────────────
export const membersApi = {
  create: (data)  => api.post('/hr/members/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.patch(`/hr/members/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id)    => api.delete(`/hr/members/${id}/`),
  search: (query) => api.get('/hr/members/', { params: { search: query } }),
  get:    (id)    => api.get(`/hr/members/${id}/`),
  list:   (p)     => api.get('/hr/members/', { params: p }),
};

// ── Membership status for the logged-in member ──────────────────────────────
export const membershipApi = {
  myStatus:       () => api.get('/auth/profile/'),
  list:           (p) => api.get('/hr/members/', { params: p }),
  payOnline:      (data) => api.post('/hr/members/pay-online/', data),
  markPaidOffice: (data) => api.post('/hr/members/mark-paid-office/', data),
};

// ── Assessment / Assessment Requests ────────────────────────────────────────
export const assessmentApi = {
  create:  (data)        => api.post('/manager/requests/', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update:  (id, data)    => api.patch(`/manager/requests/${id}/`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete:  (id)          => api.delete(`/manager/requests/${id}/`),
  get:     (id)          => api.get(`/manager/requests/${id}/`),
  list:    (params)      => api.get('/manager/requests/', { params }),
  action:  (id, action, data) => api.post(`/manager/requests/${id}/action/`, { action, ...data }),
  history: (id)          => api.get(`/manager/requests/${id}/history/`),
  // Role dashboards
  stats:   (params)      => {
    const role = params?.role;
    if (role === 'FAO') return api.get('/manager/dashboard/fao/');
    if (role === 'ACO') return api.get('/manager/dashboard/aco/');
    if (role === 'GEO') return api.get('/manager/dashboard/geo/');
    return api.get('/manager/dashboard/');
  },
};

// ── FAO Report ───────────────────────────────────────────────────────────────
export const faoApi = {
  getReport:    (assessmentId)       => api.get(`/manager/requests/${assessmentId}/fao-report/`),
  submitReport: (assessmentId, data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'uploaded_photos' && Array.isArray(val)) {
        val.forEach((photo, i) => {
          const photoName = photo.uri.split('/').pop() || `fao_photo_${i}.jpg`;
          formData.append('uploaded_photos', {
            uri: photo.uri,
            type: photo.mimeType || 'image/jpeg',
            name: photoName,
          });
        });
      } else if (val !== null && val !== undefined) {
        formData.append(key, String(val));
      }
    });
    return api.post(`/manager/requests/${assessmentId}/fao-report/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── ACO Calculation ──────────────────────────────────────────────────────────
export const acoApi = {
  getCalculation:    (assessmentId)       => api.get(`/manager/requests/${assessmentId}/aco-calculation/`),
  submitCalculation: (assessmentId, data) => api.post(`/manager/requests/${assessmentId}/aco-calculation/`, data),
};

// ── GEO Report ───────────────────────────────────────────────────────────────
export const geoApi = {
  getReport:    (assessmentId)       => api.get(`/manager/requests/${assessmentId}/geo-report/`),
  submitReport: (assessmentId, data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'uploaded_photos' && Array.isArray(val)) {
        val.forEach((photo, i) => {
          const photoName = photo.uri.split('/').pop() || `geo_photo_${i}.jpg`;
          formData.append('uploaded_photos', {
            uri: photo.uri,
            type: photo.mimeType || 'image/jpeg',
            name: photoName,
          });
        });
      } else if (val !== null && val !== undefined) {
        formData.append(key, String(val));
      }
    });
    return api.post(`/manager/requests/${assessmentId}/geo-report/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Charity Inventory ────────────────────────────────────────────────────────
export const inventoryApi = {
  list:   (params) => api.get('/manager/inventory/', { params }),
  search: (q)      => api.get('/manager/inventory/', { params: { search: q } }),
  get:    (id)     => api.get(`/manager/inventory/${id}/`),
  create: (data)   => api.post('/manager/inventory/', data),
  update: (id, data) => api.patch(`/manager/inventory/${id}/`, data),
};

// ── Donations / Income  (api/accounts/income/) ──────────────────────────────
export const donationApi = {
  create:  (data)   => api.post('/accounts/income/', data),
  update:  (id, data) => api.patch(`/accounts/income/${id}/`, data),
  delete:  (id)     => api.delete(`/accounts/income/${id}/`),
  list:    (params) => api.get('/accounts/income/', { params: { my: true, source: 'DONATION', ...params } }),
  myTotal: ()       => api.get('/accounts/income/', { params: { my: true, source: 'DONATION', page_size: 1 } }),
};

// ── Payment Gateway & Autopay (api/payments/) ────────────────────────────────
export const paymentApi = {
  createDonationOrder:   (data) => api.post('/payments/create-order/', data),
  verifyDonationPayment: (data) => api.post('/payments/verify-payment/', data),
  createSubscription:    (data) => api.post('/payments/create-subscription/', data),
  verifySubscription:    (data) => api.post('/payments/verify-subscription/', data),
  getMySubscription:     ()     => api.get('/payments/my-subscription/'),
  cancelSubscription:    ()     => api.delete('/payments/my-subscription/'),
  getCheckoutUrl: (params) => {
    const qs = Object.entries(params || {})
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `${Config.API_BASE_URL}/payments/checkout-page/?${qs}`;
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifyApi = {
  list:           (params) => api.get('/core/notifications/', { params }),
  markRead:       (id)     => api.post(`/core/notifications/${id}/read/`),
  markAllRead:    ()       => api.delete(`/core/notifications/0/read/`),
  unreadCount:    ()       => api.get('/core/notifications/unread_count/'),
  checkWhatsapp:  (phone)  => api.get('/notify/check-whatsapp/', { params: { phone } }),
};

// ── Cashier  (api/cashier/) ──────────────────────────────────────────────────
export const cashierApi = {
  dashboard:     ()     => api.get('/cashier/dashboard/'),
  pending:       ()     => api.get('/cashier/pending/'),
  disburse:      (id)   => api.post(`/cashier/disburse/${id}/`),
  disbursements: (p)    => api.get('/cashier/disbursements/', { params: p }),
};


// ── Complaints ───────────────────────────────────────────────────────────────
export const complaintsApi = {
  list:   (params) => api.get('/hr/complaints/', { params }),
  create: (data)   => api.post('/hr/complaints/', data),
  update: (id, data) => api.patch(`/hr/complaints/${id}/`, data),
};

// ── Staff Reports ────────────────────────────────────────────────────────────
export const staffReportsApi = {
  list:   (params) => api.get('/hr/staff-reports/', { params }),
  submit: (data)   => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'file' && val && val.uri) {
        formData.append('file', {
          uri: val.uri,
          type: val.mimeType || 'application/pdf',
          name: val.name || 'report_doc.pdf',
        });
      } else if (val !== null && val !== undefined) {
        formData.append(key, String(val));
      }
    });
    return api.post('/hr/staff-reports/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'file' && val && val.uri) {
        formData.append('file', {
          uri: val.uri,
          type: val.mimeType || 'application/pdf',
          name: val.name || 'report_doc.pdf',
        });
      } else if (val !== null && val !== undefined) {
        formData.append(key, String(val));
      }
    });
    return api.patch(`/hr/staff-reports/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Payment Advances ─────────────────────────────────────────────────────────
export const paymentAdvanceApi = {
  list:    (params) => api.get('/hr/payment-advances/', { params }),
  balance: ()       => api.get('/hr/salary-balance/'),
  create:  (data)   => api.post('/hr/payment-advances/', data),
};

// ── Performance Points (Achieved Points) ─────────────────────────────────────
export const performancePointsApi = {
  leaderboard: (params) => api.get('/hr/performance-points/leaderboard/', { params }),
};

// ── Attendance ───────────────────────────────────────────────────────────────
export const attendanceApi = {
  myAttendance: () => api.get('/hr/attendance/my-attendance/'),
  checkIn:      (formData) => api.post('/hr/attendance/my-attendance/', formData || { action: 'check_in' }, {
    headers: formData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
  checkOut:     (formData) => api.post('/hr/attendance/my-attendance/', formData || { action: 'check_out' }, {
    headers: formData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
};

// ── Events / Newsletters ──────────────────────────────────────────────────────
export const eventsApi = {
  list:   (params) => api.get('/core/events/', { params }),
  get:    (id)     => api.get(`/core/events/${id}/`),
  create: (data)   => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'image' && val && val.uri) {
        formData.append('image', {
          uri: val.uri,
          type: val.mimeType || 'image/jpeg',
          name: val.name || 'event_image.jpg',
        });
      } else if (val !== null && val !== undefined) {
        formData.append(key, String(val));
      }
    });
    return api.post('/core/events/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const coreApi = {
  updatePushToken: (data) => api.post('/core/update-push-token/', data),
};

export const memberPostsApi = {
  list: (params) => api.get('/core/member-posts/', { params }),
  get: (id) => api.get(`/core/member-posts/${id}/`),
  create: (data) => {
    const formData = new FormData();
    if (data.description) formData.append('description', data.description);
    if (data.contact_number) formData.append('contact_number', data.contact_number);
    if (data.address) formData.append('address', data.address);
    if (data.video && data.video.uri) {
      formData.append('video', {
        uri: data.video.uri,
        type: data.video.mimeType || 'video/mp4',
        name: data.video.fileName || 'post_video.mp4',
      });
    }
    if (Array.isArray(data.images)) {
      data.images.forEach((img, index) => {
        if (img && img.uri) {
          formData.append('images', {
            uri: img.uri,
            type: img.mimeType || 'image/jpeg',
            name: img.fileName || `post_photo_${index + 1}.jpg`,
          });
        }
      });
    }
    return api.post('/core/member-posts/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  toggleLike: (id) => api.post(`/core/member-posts/${id}/toggle-like/`),
  toggleFollow: (userId) => api.post(`/core/users/${userId}/toggle-follow/`),
  getMemberProfile: (userId) => api.get(`/core/users/${userId}/member-profile/`),
  getFollowers: (userId, params) => api.get(`/core/users/${userId}/followers/`, { params }),
  getFollowing: (userId, params) => api.get(`/core/users/${userId}/following/`, { params }),
  searchMembers: (params) => {
    const p = typeof params === 'string' ? { q: params } : (params || {});
    return api.get('/core/members/search/', { params: p });
  },
  getComments: (id) => api.get(`/core/member-posts/${id}/comments/`),
  addComment: (id, text) => api.post(`/core/member-posts/${id}/comments/`, { text }),
  update: (id, data) => api.patch(`/core/member-posts/${id}/`, data),
  deletePost: (id) => api.delete(`/core/member-posts/${id}/`),
};

export default api;

