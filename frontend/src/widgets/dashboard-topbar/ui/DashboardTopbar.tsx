import React from 'react';

interface DashboardTopbarProps {
  serviceName: string;
  onLogout: () => void;
}

export const DashboardTopbar: React.FC<DashboardTopbarProps> = ({
  serviceName,
  onLogout,
}) => {
  return (
    <header className='topbar'>
      <button
        type='button'
        className='topbar-menu-button'
        aria-label='Open menu'
      >
        &#9776;
      </button>
      <p className='topbar-title'>{serviceName || 'Service CRM'}</p>
      <div className='topbar-actions'>
        <button
          type='button'
          className='ghost-button'
          onClick={() => void onLogout()}
        >
          Logout
        </button>
      </div>
    </header>
  );
};
