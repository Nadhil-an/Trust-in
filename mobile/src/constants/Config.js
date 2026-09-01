import Constants from 'expo-constants';

// ── Server IP & Host Configuration ──────────────────────────────────────────
const SERVER_HOST = 'trust.sreelakshmicharity.org'; // Using the main domain since internalapi is timing out

// Automatically detect host IP from Expo bundler, or fallback to SERVER_HOST
const getHost = () => {
  const manifestHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return manifestHost || SERVER_HOST;
};

const HOST = getHost();
const PROTOCOL = 'https'; // Using https since domains usually have SSL
const WS_PROTOCOL = 'wss';
const PORT_SUFFIX = ''; // Requests go through Nginx on port 80/443

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
