// constants/Config.js
// Configuration and constants

// ── Production Server ─────────────────────────────────────────────────────────
// Domain: sreelakshmicharity.org
// Backend Django/Daphne runs on port 8000
const PRODUCTION_HOST = 'sreelakshmicharity.org';

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
