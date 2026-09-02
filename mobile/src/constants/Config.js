import Constants from 'expo-constants';

// ── Environment Detection ─────────────────────────────────────────────────────
// __DEV__ is true when running via Expo Go or `npx expo start`
// It is false when building a production APK/AAB

const PRODUCTION_HOST = 'trust.sreelakshmicharity.org';

const getApiConfig = () => {
  if (__DEV__) {
    // In local development: the phone must reach your PC's Django backend
    // Expo tells us your PC's IP via Constants.expoConfig.hostUri (e.g. "192.168.x.x:8081")
    const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
    const localHost = expoHost || '10.57.111.21'; // fallback to your PC's IP
    return {
      apiBase:  `http://${localHost}:8000/api`,
      wsBase:   `ws://${localHost}:8000/ws`,
    };
  }
  // Production APK: always connect to the live EC2 server over HTTPS
  return {
    apiBase: `https://${PRODUCTION_HOST}/api`,
    wsBase:  `wss://${PRODUCTION_HOST}/ws`,
  };
};

const { apiBase, wsBase } = getApiConfig();

export const Config = {
  API_BASE_URL: apiBase,
  WS_BASE_URL:  wsBase,

  // Storage Keys
  ACCESS_TOKEN_KEY: 'sl_access_token',
  REFRESH_TOKEN_KEY: 'sl_refresh_token',
  USER_KEY: 'sl_user_data',
  LANGUAGE_KEY: 'sl_language',
  OFFLINE_QUEUE_KEY: 'sl_offline_queue',

  // Settings
  TIMEOUT: 15000,
};

export const Roles = {
  STAFF: 'STAFF',
  MEMBER: 'MEMBER',
  FAO: 'FIELD_ASSESSMENT_OFFICER',
  ACO: 'ASSESSMENT_CALCULATION_OFFICER',
  GEO: 'GENERAL_ENQUIRY_OFFICER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
};
