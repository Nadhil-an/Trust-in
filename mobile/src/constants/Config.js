// constants/Config.js
// Configuration and constants

// ── Production EC2 Server ─────────────────────────────────────────────────────
// EC2 Public IP: 13.235.70.127
// Backend runs on port 8000 inside Docker, exposed to host
const PRODUCTION_HOST = '13.235.70.127';

export const Config = {
  API_BASE_URL: `http://${PRODUCTION_HOST}:8000/api`,
  WS_BASE_URL:  `ws://${PRODUCTION_HOST}:8000/ws`,
  
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
