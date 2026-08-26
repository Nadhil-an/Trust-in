// i18n/index.js — i18n setup
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import ml from './ml';
import { Config } from '../constants/Config';

const LANG_KEY = Config.LANGUAGE_KEY;

export const initI18n = async () => {
  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      ml: { translation: ml },
    },
    lng: 'en', // Default to English for login screen
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

  return i18n;
};

export const changeLanguage = async (lang, userId = null) => {
  await i18n.changeLanguage(lang);
  if (userId) {
    await AsyncStorage.setItem(`${LANG_KEY}_${userId}`, lang);
  }
};

export default i18n;
