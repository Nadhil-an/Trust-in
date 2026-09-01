// store/authStore.js — Auth state management with Zustand
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Config, Roles } from '../constants/Config';

const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } = Config;

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  // Load tokens from SecureStore on app start
  initialize: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const userStr = await SecureStore.getItemAsync(USER_KEY);
      if (accessToken && userStr) {
        const user = JSON.parse(userStr);
        
        // Load user-specific language
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const i18n = require('../i18n').default;
        try {
          const savedLang = await AsyncStorage.getItem(`${Config.LANGUAGE_KEY}_${user.id}`);
          if (savedLang) await i18n.changeLanguage(savedLang);
        } catch (_) {}

        set({ user, accessToken, isAuthenticated: true, isLoading: false });

        // Validate account status with server asynchronously
        try {
          const { authApi } = require('../api');
          authApi.profile().catch(() => {
            get().logout();
          });
        } catch (_) {}
      } else {
        set({ isLoading: false });
      }
    } catch (_) {
      set({ isLoading: false });
    }
  },

  // Called after successful login
  login: async ({ access, refresh, user }) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));

    // Load language preference for new user
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const i18n = require('../i18n').default;
    try {
      const savedLang = await AsyncStorage.getItem(`${Config.LANGUAGE_KEY}_${user.id}`);
      if (savedLang) {
        await i18n.changeLanguage(savedLang);
      } else {
        await i18n.changeLanguage('en');
      }
    } catch (_) {}

    set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true });
  },

  // Update access token after refresh
  updateToken: async (access) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    set({ accessToken: access });
  },

  // Update user profile
  updateUser: async (user) => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  // Logout — clear everything
  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    
    // Reset language to English for login screen
    try {
      const i18n = require('../i18n').default;
      await i18n.changeLanguage('en');
    } catch (_) {}

    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  // Role helpers
  isStaff: () => get().user?.role === Roles.STAFF,
  isMember: () => get().user?.role === Roles.MEMBER,
  isFAO: () => get().user?.role === Roles.FAO,
  isACO: () => get().user?.role === Roles.ACO,
  isGEO: () => get().user?.role === Roles.GEO,
  isAdmin: () => get().user?.role === Roles.ADMIN,
  isManager: () => get().user?.role === Roles.MANAGER,
}));
