import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  readUiTheme,
  writeUiTheme,
  type UiTheme,
} from '../lib/uiTheme';

export const ThemeSwitcher = () => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<UiTheme>(() => readUiTheme());

  const setNext = (next: UiTheme) => {
    writeUiTheme(next);
    setTheme(next);
  };

  return (
    <div
      className="theme-switcher"
      role="group"
      aria-label={t('common.theme.label')}
    >
      <button
        type="button"
        className={
          theme === 'light' ? 'theme-btn theme-btn-active' : 'theme-btn'
        }
        aria-pressed={theme === 'light'}
        aria-label={t('common.theme.switchToLight')}
        title={t('common.theme.light')}
        onClick={() => setNext('light')}
      >
        {t('common.theme.lightShort')}
      </button>
      <button
        type="button"
        className={
          theme === 'dark' ? 'theme-btn theme-btn-active' : 'theme-btn'
        }
        aria-pressed={theme === 'dark'}
        aria-label={t('common.theme.switchToDark')}
        title={t('common.theme.dark')}
        onClick={() => setNext('dark')}
      >
        {t('common.theme.darkShort')}
      </button>
    </div>
  );
};
