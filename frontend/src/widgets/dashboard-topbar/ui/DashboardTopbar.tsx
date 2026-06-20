import React from 'react';
import { useTranslation } from 'react-i18next';

interface DashboardTopbarProps {
  serviceName: string;
  onLogout: () => void;
}

export const DashboardTopbar: React.FC<DashboardTopbarProps> = ({
  serviceName,
  onLogout,
}) => {
  const { t } = useTranslation();

  return (
    <header className='topbar'>
      <div className='topbar-left'>
        <button
          type='button'
          className='topbar-menu-button'
          aria-label={t('common.openMenu')}
        >
          &#9776;
        </button>
        <p className='topbar-title'>{serviceName || t('common.serviceCRM')}</p>
      </div>
      <div className='topbar-actions'>
        <button
          type='button'
          className='ghost-button'
          onClick={() => void onLogout()}
        >
          {t('common.logout')}
        </button>
      </div>
    </header>
  );
};