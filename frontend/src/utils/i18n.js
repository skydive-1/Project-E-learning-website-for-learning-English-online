import { globalUiTranslations } from '../i18n/global-ui-translations';
import { externalUiTranslations } from '../i18n/external-ui-translations';
import { aiQuotaTranslations } from '../i18n/ai-quota-translations';

// Merge all translation maps
const allTranslations = {
  ...globalUiTranslations,
  ...externalUiTranslations,
  ...aiQuotaTranslations
};

/**
 * Get translation for a key
 * @param {string} key - Translation key (Vietnamese text)
 * @param {string} language - Target language ('vi' or 'en')
 * @returns {string} Translated text
 */
export const t = (key, language = 'vi') => {
  if (!key) return '';
  
  const translation = allTranslations[key];
  
  if (!translation) {
    // In development, warn about missing translations
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Missing translation for key: "${key}"`);
    }
    return key;
  }
  
  return language === 'vi' ? translation : translation;
};

/**
 * Translate with interpolation
 * @param {string} key - Translation key
 * @param {Object} params - Parameters to interpolate
 * @param {string} language - Target language
 * @returns {string} Translated and interpolated string
 */
export const tpl = (key, params = {}, language = 'vi') => {
  let translation = t(key, language);
  
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      translation = translation.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      translation = translation.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
  }
  
  return translation;
};

/**
 * Get all translations for a language
 * @param {string} language - Target language
 * @returns {Object} All translations
 */
export const getAllTranslations = (language = 'vi') => {
  if (language === 'vi') {
    return allTranslations;
  }
  
  // Return English translations (values)
  const englishTranslations = {};
  Object.entries(allTranslations).forEach(([key, value]) => {
    englishTranslations[key] = value;
  });
  return englishTranslations;
};

/**
 * Check if a key has translation
 * @param {string} key - Translation key
 * @returns {boolean}
 */
export const hasTranslation = (key) => {
  return key in allTranslations;
};

/**
 * Add or update translation
 * @param {string} key - Translation key
 * @param {string} value - Translation value
 * @param {string} language - Language ('vi' or 'en')
 */
export const setTranslation = (key, value, language = 'vi') => {
  if (language === 'vi') {
    allTranslations[key] = value;
  } else {
    // For English, we store the reverse mapping
    // Find the Vietnamese key for this English value
    const vnKey = Object.keys(allTranslations).find(k => allTranslations[k] === value);
    if (vnKey) {
      allTranslations[vnKey] = value;
    } else {
      allTranslations[key] = value;
    }
  }
};

/**
 * Get available languages
 * @returns {string[]}
 */
export const getAvailableLanguages = () => ['vi', 'en'];

/**
 * Hook for using translations in React components
 */
export const useTranslation = () => {
  // This would be implemented with React context
  // For now, return the t function
  return { t, tpl, language: 'vi' };
};

export { allTranslations };
export default { t, tpl, getAllTranslations, hasTranslation, setTranslation, getAvailableLanguages, useTranslation };