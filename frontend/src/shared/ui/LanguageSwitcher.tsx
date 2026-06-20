import React from 'react';
import { useTranslation } from 'react-i18next';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith('uk') ? 'uk' : 'en';

  const setLang = (lng: 'en' | 'uk') => {
    void i18n.changeLanguage(lng);
  };

  return (
    <div className="language-switcher" style={{ display: 'inline-flex', gap: 4, marginRight: 8 }}>
      <button
        type="button"
        className={`lang-btn ${current === 'en' ? 'lang-btn-active' : ''}`}
        onClick={() => setLang('en')}
        aria-label={t('common.languageSwitcher.switchToEnglish')}
        title={t('common.languageSwitcher.english')}
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-btn ${current === 'uk' ? 'lang-btn-active' : ''}`}
        onClick={() => setLang('uk')}
        aria-label={t('common.languageSwitcher.switchToUkrainian')}
        title={t('common.languageSwitcher.ukrainian')}
      >
        UA
      </button>
    </div>
  );
};
