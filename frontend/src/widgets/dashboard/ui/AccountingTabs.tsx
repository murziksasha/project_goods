import { useTranslation } from 'react-i18next';
import type { AccountingTab } from '../model/accounting';

type AccountingTabsProps = {
  activeTab: AccountingTab;
  canManageCashboxes: boolean;
  isFinanceSettingsOpen: boolean;
  onOpenSettings: () => void;
  onTabChange: (tab: AccountingTab) => void;
};

const accountingTabs: Array<[AccountingTab, string]> = [
  ['cashboxes', 'accounting.tabs.cashboxes'],
  ['transactions', 'accounting.tabs.transactions'],
  ['orders', 'accounting.tabs.orders'],
  ['reports', 'accounting.tabs.information'],
];

export const AccountingTabs = ({
  activeTab,
  canManageCashboxes,
  isFinanceSettingsOpen,
  onOpenSettings,
  onTabChange,
}: AccountingTabsProps) => {
  const { t } = useTranslation();

  return (
  <div className='finance-tabs-row'>
    <div className='orders-tabs' role='tablist' aria-label={t('accounting.tabs.ariaLabel')}>
      {accountingTabs.map(([key, labelKey]) => (
        <button
          key={key}
          type='button'
          className={activeTab === key ? 'orders-tab orders-tab-active' : 'orders-tab'}
          onClick={() => onTabChange(key)}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
    {canManageCashboxes ? (
      <div className='toolbar-settings'>
        <button
          type='button'
          className='toolbar-square-button'
          aria-label={t('accounting.tabs.settingsAriaLabel')}
          aria-expanded={isFinanceSettingsOpen}
          onClick={onOpenSettings}
        >
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            className='toolbar-square-button-icon'
            fill='currentColor'
          >
            <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
          </svg>
        </button>
      </div>
    ) : null}
  </div>
  );
};
