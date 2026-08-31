import Constants from 'expo-constants';

// ── Server IP & Host Configuration ──────────────────────────────────────────
const LOCAL_IP = '192.168.1.34';
// ⬇️  UPDATE THIS to your EC2 domain or IP when deploying
const PRODUCTION_HOST = 'internalapi.sreelakshmicharity.org';

// Automatically detect host IP from Expo bundler, or fallback to LOCAL_IP / PRODUCTION_HOST
const getHost = () => {
  if (__DEV__) {
    const manifestHost = Constants.expoConfig?.hostUri?.split(':')[0];
    return manifestHost || LOCAL_IP;
  }
  return PRODUCTION_HOST;
};

const HOST = getHost();

// In production: HTTPS + WSS (secure) — no port needed (Nginx handles it on 443)
// In dev: HTTP + WS with port 8000
const PROTOCOL = __DEV__ ? 'http' : 'https';
const WS_PROTOCOL = __DEV__ ? 'ws' : 'wss';
const PORT_SUFFIX = __DEV__ ? ':8000' : '';

export const Config = {
  API_BASE_URL: `${PROTOCOL}://${HOST}${PORT_SUFFIX}/api`,
  WS_BASE_URL:  `${WS_PROTOCOL}://${HOST}${PORT_SUFFIX}/ws`,
  
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
