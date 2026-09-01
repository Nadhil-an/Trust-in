import Constants from 'expo-constants';

// ── Server IP & Host Configuration ──────────────────────────────────────────
const SERVER_HOST = '13.235.70.127';

// Automatically detect host IP from Expo bundler, or fallback to SERVER_HOST
const getHost = () => {
  const manifestHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return manifestHost || SERVER_HOST;
};

const HOST = getHost();
const PROTOCOL = 'http';
const WS_PROTOCOL = 'ws';
const PORT_SUFFIX = ''; // Requests go through Nginx on port 80

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
