import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { languages, translations } from '../i18n/translations';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'ru');

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const dictionary = translations[language] || translations.ru;
    return {
      language,
      languages,
      setLanguage,
      t: (key) => dictionary[key] || translations.ru[key] || key,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
