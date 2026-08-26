// constants/Config.js
// Configuration and constants

// IMPORTANT: For physical device testing, change localhost to your computer's local IP address (e.g. 192.168.1.5)
const LOCAL_IP = '10.108.62.21';

export const Config = {
  // Use 10.0.2.2 for Android Emulator, or your Local IP for physical device testing
  API_BASE_URL: `http://${LOCAL_IP}:8000/api`,
  WS_BASE_URL: `ws://${LOCAL_IP}:8000/ws`,
  
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
