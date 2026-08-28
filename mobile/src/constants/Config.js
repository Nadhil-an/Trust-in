import Constants from 'expo-constants';

// ── Server IP & Host Configuration ──────────────────────────────────────────
const LOCAL_IP = '10.108.62.21';
const PRODUCTION_HOST = 'sreelakshmicharity.org';

// Automatically detect host IP from Expo bundler, or fallback to LOCAL_IP / PRODUCTION_HOST
const getHost = () => {
  if (__DEV__) {
    const manifestHost = Constants.expoConfig?.hostUri?.split(':')[0];
    return manifestHost || LOCAL_IP;
  }
  return PRODUCTION_HOST;
};

const HOST = getHost();

export const Config = {
  API_BASE_URL: `http://${HOST}:8000/api`,
  WS_BASE_URL:  `ws://${HOST}:8000/ws`,
  
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
