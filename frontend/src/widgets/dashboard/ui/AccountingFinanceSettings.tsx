import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Cashbox } from '../../../entities/finance/model/types';

type FinanceSettingsTab = 'cashboxes' | 'currencies';

type AccountingFinanceSettingsProps = {
  activeTab: FinanceSettingsTab;
  allCashboxes: Cashbox[];
  allCurrencyCodes: string[];
  editingCashboxId: string | null;
  editingCashboxName: string;
  expandedCard: string | null;
  isSaving: boolean;
  newCashboxName: string;
  newCurrencyCode: string;
  getCurrencyBalance: (cashbox: Cashbox, currencyCode: string) => number;
  isCashboxCurrencyActive: (cashboxId: string, currencyCode: string) => boolean;
  isGlobalCurrencyActive: (currencyCode: string) => boolean;
  onAddCurrency: () => void;
  onCancelCashboxEdit: () => void;
  onCreateCashbox: () => void;
  onEditingCashboxNameChange: (value: string) => void;
  onNewCashboxNameChange: (value: string) => void;
  onNewCurrencyCodeChange: (value: string) => void;
  onRemoveCurrency: (currency: string) => void;
  onSaveCashbox: () => void;
  onStartEditCashbox: (cashbox: Cashbox) => void;
  onTabChange: (tab: FinanceSettingsTab) => void;
  onToggleCard: (cardId: string) => void;
  onToggleCashboxArchived: (cashbox: Cashbox) => void;
  onToggleCashboxCurrencyActivity: (cashboxId: string, currencyCode: string) => void;
  onToggleCurrencyActivity: (currencyCode: string) => void;
};

export const AccountingFinanceSettings = ({
  activeTab,
  allCashboxes,
  allCurrencyCodes,
  editingCashboxId,
  editingCashboxName,
  expandedCard,
  isSaving,
  newCashboxName,
  newCurrencyCode,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
  onAddCurrency,
  onCancelCashboxEdit,
  onCreateCashbox,
  onEditingCashboxNameChange,
  onNewCashboxNameChange,
  onNewCurrencyCodeChange,
  onRemoveCurrency,
  onSaveCashbox,
  onStartEditCashbox,
  onTabChange,
  onToggleCard,
  onToggleCashboxArchived,
  onToggleCashboxCurrencyActivity,
  onToggleCurrencyActivity,
}: AccountingFinanceSettingsProps) => {
  const { t } = useTranslation();

  return (
    <section className='warehouse-settings-panel finance-settings-panel'>
      <div className='warehouse-settings-tabs'>
        <button
          type='button'
          className={
            activeTab === 'cashboxes'
              ? 'warehouse-settings-tab warehouse-settings-tab-active'
              : 'warehouse-settings-tab'
          }
          onClick={() => onTabChange('cashboxes')}
        >
          {t('accounting.financeSettings.cashboxes')}
        </button>
        <button
          type='button'
          className={
            activeTab === 'currencies'
              ? 'warehouse-settings-tab warehouse-settings-tab-active'
              : 'warehouse-settings-tab'
          }
          onClick={() => onTabChange('currencies')}
        >
          {t('accounting.financeSettings.currencies')}
        </button>
      </div>

      {activeTab === 'cashboxes' ? (
        <CashboxSettings
          allCashboxes={allCashboxes}
          allCurrencyCodes={allCurrencyCodes}
          editingCashboxId={editingCashboxId}
          editingCashboxName={editingCashboxName}
          expandedCard={expandedCard}
          isSaving={isSaving}
          newCashboxName={newCashboxName}
          getCurrencyBalance={getCurrencyBalance}
          isCashboxCurrencyActive={isCashboxCurrencyActive}
          isGlobalCurrencyActive={isGlobalCurrencyActive}
          onCancelCashboxEdit={onCancelCashboxEdit}
          onCreateCashbox={onCreateCashbox}
          onEditingCashboxNameChange={onEditingCashboxNameChange}
          onNewCashboxNameChange={onNewCashboxNameChange}
          onSaveCashbox={onSaveCashbox}
          onStartEditCashbox={onStartEditCashbox}
          onToggleCard={onToggleCard}
          onToggleCashboxArchived={onToggleCashboxArchived}
          onToggleCashboxCurrencyActivity={onToggleCashboxCurrencyActivity}
        />
      ) : (
        <CurrencySettings
          allCurrencyCodes={allCurrencyCodes}
          expandedCard={expandedCard}
          newCurrencyCode={newCurrencyCode}
          isGlobalCurrencyActive={isGlobalCurrencyActive}
          onAddCurrency={onAddCurrency}
          onNewCurrencyCodeChange={onNewCurrencyCodeChange}
          onRemoveCurrency={onRemoveCurrency}
          onToggleCard={onToggleCard}
          onToggleCurrencyActivity={onToggleCurrencyActivity}
        />
      )}
    </section>
  );
};

type CashboxSettingsProps = Pick<
  AccountingFinanceSettingsProps,
  | 'allCashboxes'
  | 'allCurrencyCodes'
  | 'editingCashboxId'
  | 'editingCashboxName'
  | 'expandedCard'
  | 'isSaving'
  | 'newCashboxName'
  | 'getCurrencyBalance'
  | 'isCashboxCurrencyActive'
  | 'isGlobalCurrencyActive'
  | 'onCancelCashboxEdit'
  | 'onCreateCashbox'
  | 'onEditingCashboxNameChange'
  | 'onNewCashboxNameChange'
  | 'onSaveCashbox'
  | 'onStartEditCashbox'
  | 'onToggleCard'
  | 'onToggleCashboxArchived'
  | 'onToggleCashboxCurrencyActivity'
>;

const CashboxSettings = ({
  allCashboxes,
  allCurrencyCodes,
  editingCashboxId,
  editingCashboxName,
  expandedCard,
  isSaving,
  newCashboxName,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
  onCancelCashboxEdit,
  onCreateCashbox,
  onEditingCashboxNameChange,
  onNewCashboxNameChange,
  onSaveCashbox,
  onStartEditCashbox,
  onToggleCard,
  onToggleCashboxArchived,
  onToggleCashboxCurrencyActivity,
}: CashboxSettingsProps) => {
  const { t } = useTranslation();

  return (
    <div className='finance-settings-body'>
      <SettingsCard
        cardId='cashboxes-create'
        expandedCard={expandedCard}
        title={t('accounting.financeSettings.createCashbox')}
        onToggleCard={onToggleCard}
      >
        <div className='catalog-edit-body'>
          <label className='field'>
            <span>{t('common.name')}</span>
            <input
              value={newCashboxName}
              onChange={(event) => onNewCashboxNameChange(event.target.value)}
              placeholder={t('accounting.financeSettings.enterCashboxNamePlaceholder')}
            />
          </label>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='primary-button'
            disabled={isSaving || newCashboxName.trim().length < 2}
            onClick={onCreateCashbox}
          >
            {t('common.create')}
          </button>
        </footer>
      </SettingsCard>

      {allCashboxes.map((cashbox) => (
        <CashboxSettingsCard
          key={`settings-${cashbox.id}`}
          allCurrencyCodes={allCurrencyCodes}
          cashbox={cashbox}
          editingCashboxId={editingCashboxId}
          editingCashboxName={editingCashboxName}
          expandedCard={expandedCard}
          isSaving={isSaving}
          getCurrencyBalance={getCurrencyBalance}
          isCashboxCurrencyActive={isCashboxCurrencyActive}
          isGlobalCurrencyActive={isGlobalCurrencyActive}
          onCancelCashboxEdit={onCancelCashboxEdit}
          onEditingCashboxNameChange={onEditingCashboxNameChange}
          onSaveCashbox={onSaveCashbox}
          onStartEditCashbox={onStartEditCashbox}
          onToggleCard={onToggleCard}
          onToggleCashboxArchived={onToggleCashboxArchived}
          onToggleCashboxCurrencyActivity={onToggleCashboxCurrencyActivity}
        />
      ))}
    </div>
  );
};

type CashboxSettingsCardProps = Omit<
  CashboxSettingsProps,
  'allCashboxes' | 'newCashboxName' | 'onCreateCashbox' | 'onNewCashboxNameChange'
> & {
  cashbox: Cashbox;
};

const CashboxSettingsCard = ({
  allCurrencyCodes,
  cashbox,
  editingCashboxId,
  editingCashboxName,
  expandedCard,
  isSaving,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
  onCancelCashboxEdit,
  onEditingCashboxNameChange,
  onSaveCashbox,
  onStartEditCashbox,
  onToggleCard,
  onToggleCashboxArchived,
  onToggleCashboxCurrencyActivity,
}: CashboxSettingsCardProps) => {
  const { t } = useTranslation();
  const cardId = `cashbox-${cashbox.id}`;

  return (
    <SettingsCard
      cardId={cardId}
      expandedCard={expandedCard}
      title={t('accounting.financeSettings.editCashboxTitle', { name: cashbox.name })}
      className={
        cashbox.isArchived
          ? 'catalog-edit-modal finance-settings-cashbox finance-settings-cashbox-archived'
          : 'catalog-edit-modal finance-settings-cashbox'
      }
      onToggleCard={onToggleCard}
    >
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>{t('common.name')}</span>
          <input
            disabled={editingCashboxId !== cashbox.id || isSaving}
            value={editingCashboxId === cashbox.id ? editingCashboxName : cashbox.name}
            onChange={(event) => onEditingCashboxNameChange(event.target.value)}
          />
        </label>
        <label className='field-inline'>
          <input
            type='checkbox'
            checked={!cashbox.isArchived}
            disabled={cashbox.isDefault || isSaving}
            onChange={() => onToggleCashboxArchived(cashbox)}
          />
          <span>
            {cashbox.isDefault
              ? t('accounting.financeSettings.activeDefault')
              : t('accounting.financeSettings.active')}
          </span>
        </label>
        <div className='finance-currency-activity-list'>
          {allCurrencyCodes.map((currencyCode) => (
            <CashboxCurrencyToggle
              key={`cashbox-currency-${cashbox.id}-${currencyCode}`}
              cashbox={cashbox}
              currencyCode={currencyCode}
              getCurrencyBalance={getCurrencyBalance}
              isCashboxCurrencyActive={isCashboxCurrencyActive}
              isGlobalCurrencyActive={isGlobalCurrencyActive}
              onToggleCashboxCurrencyActivity={onToggleCashboxCurrencyActivity}
            />
          ))}
        </div>
      </div>
      <footer className='catalog-edit-footer'>
        {editingCashboxId === cashbox.id ? (
          <>
            <button
              type='button'
              className='primary-button'
              disabled={isSaving || editingCashboxName.trim().length < 2}
              onClick={onSaveCashbox}
            >
              {t('common.save')}
            </button>
            <button
              type='button'
              className='secondary-button'
              disabled={isSaving}
              onClick={onCancelCashboxEdit}
            >
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => onStartEditCashbox(cashbox)}
          >
            {t('accounting.financeSettings.editCashbox')}
          </button>
        )}
      </footer>
    </SettingsCard>
  );
};

type CashboxCurrencyToggleProps = Pick<
  AccountingFinanceSettingsProps,
  | 'getCurrencyBalance'
  | 'isCashboxCurrencyActive'
  | 'isGlobalCurrencyActive'
  | 'onToggleCashboxCurrencyActivity'
> & {
  cashbox: Cashbox;
  currencyCode: string;
};

const CashboxCurrencyToggle = ({
  cashbox,
  currencyCode,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
  onToggleCashboxCurrencyActivity,
}: CashboxCurrencyToggleProps) => {
  const { t } = useTranslation();
  const isGloballyActive = isGlobalCurrencyActive(currencyCode);
  const isCashboxActive = isCashboxCurrencyActive(cashbox.id, currencyCode);
  const isAcceptActive = isGloballyActive && isCashboxActive;
  const balance = getCurrencyBalance(cashbox, currencyCode);
  const canWithdrawOnly = !isAcceptActive && balance > 0;

  return (
    <div className='finance-currency-activity-item'>
      <label className='field-inline finance-currency-activity-toggle'>
        <input
          type='checkbox'
          checked={isAcceptActive}
          disabled={currencyCode === 'UAH'}
          onChange={() => onToggleCashboxCurrencyActivity(cashbox.id, currencyCode)}
        />
        <span>{currencyCode}</span>
        <span
          className={
            isAcceptActive
              ? 'finance-currency-activity-badge'
              : 'finance-currency-activity-badge finance-currency-activity-badge-off'
          }
          title={
            canWithdrawOnly
              ? t('accounting.financeSettings.withdrawOnlyCashboxTitle')
              : isGloballyActive
                ? t('accounting.financeSettings.inactiveForCashboxTitle')
                : t('accounting.financeSettings.globallyInactiveTitle')
          }
        >
          {isAcceptActive
            ? t('accounting.financeSettings.active')
            : canWithdrawOnly
              ? t('accounting.cashboxes.withdrawOnly')
              : t('accounting.financeSettings.inactive')}
        </span>
      </label>
    </div>
  );
};

type CurrencySettingsProps = Pick<
  AccountingFinanceSettingsProps,
  | 'allCurrencyCodes'
  | 'expandedCard'
  | 'newCurrencyCode'
  | 'isGlobalCurrencyActive'
  | 'onAddCurrency'
  | 'onNewCurrencyCodeChange'
  | 'onRemoveCurrency'
  | 'onToggleCard'
  | 'onToggleCurrencyActivity'
>;

const CurrencySettings = ({
  allCurrencyCodes,
  expandedCard,
  newCurrencyCode,
  isGlobalCurrencyActive,
  onAddCurrency,
  onNewCurrencyCodeChange,
  onRemoveCurrency,
  onToggleCard,
  onToggleCurrencyActivity,
}: CurrencySettingsProps) => {
  const { t } = useTranslation();

  return (
    <div className='finance-settings-body'>
      <SettingsCard
        cardId='currencies-create'
        expandedCard={expandedCard}
        title={t('accounting.financeSettings.createCurrency')}
        onToggleCard={onToggleCard}
      >
        <div className='catalog-edit-body'>
          <p className='section-label'>
            {t('accounting.financeSettings.createCurrencyHint')}
          </p>
          <label className='field'>
            <span>{t('accounting.financeSettings.currencyCode')}</span>
            <input
              value={newCurrencyCode}
              onChange={(event) => onNewCurrencyCodeChange(event.target.value)}
              placeholder={t('accounting.financeSettings.currencyCodePlaceholder')}
            />
          </label>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='primary-button'
            onClick={onAddCurrency}
            disabled={newCurrencyCode.trim().length < 3}
          >
            {t('accounting.financeSettings.addCurrency')}
          </button>
        </footer>
      </SettingsCard>

      <SettingsCard
        cardId='currency-activity'
        expandedCard={expandedCard}
        title={t('accounting.financeSettings.currencyActivity')}
        onToggleCard={onToggleCard}
      >
        <div className='catalog-edit-body'>
          <p className='section-label'>
            {t('accounting.financeSettings.currencyActivityHint')}
          </p>
          <div className='finance-currency-activity-list'>
            {allCurrencyCodes.map((currency) => {
              const isActive = isGlobalCurrencyActive(currency);
              const isMainCurrency = currency === 'UAH';
              const isRemovableCurrency = !isMainCurrency;
              const canRemove = isRemovableCurrency;

              return (
                <div key={`activity-${currency}`} className='finance-currency-activity-item'>
                  <label className='field-inline finance-currency-activity-toggle'>
                    <input
                      type='checkbox'
                      checked={isMainCurrency || isActive}
                      disabled={isMainCurrency}
                      onChange={() => onToggleCurrencyActivity(currency)}
                    />
                    <span>{currency}</span>
                    <span
                      className={
                        isMainCurrency || isActive
                          ? 'finance-currency-activity-badge'
                          : 'finance-currency-activity-badge finance-currency-activity-badge-off'
                      }
                    >
                      {isMainCurrency
                        ? t('accounting.financeSettings.alwaysActive')
                        : isActive
                          ? t('accounting.financeSettings.active')
                          : t('accounting.financeSettings.archived')}
                    </span>
                  </label>
                  {isRemovableCurrency ? (
                    <button
                      type='button'
                      className='orders-filter-delete-button finance-currency-remove-button'
                      disabled={!canRemove}
                      title={
                        canRemove
                          ? t('accounting.financeSettings.archiveCurrencyTitle')
                          : t('accounting.financeSettings.cannotArchiveCurrencyTitle')
                      }
                      onClick={() => onRemoveCurrency(currency)}
                    >
                      {t('accounting.financeSettings.archive')}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </SettingsCard>
    </div>
  );
};

type SettingsCardProps = {
  cardId: string;
  children: ReactNode;
  expandedCard: string | null;
  title: string;
  className?: string;
  onToggleCard: (cardId: string) => void;
};

const SettingsCard = ({
  cardId,
  children,
  expandedCard,
  title,
  className = 'catalog-edit-modal finance-settings-card',
  onToggleCard,
}: SettingsCardProps) => {
  const isExpanded = expandedCard === cardId;

  return (
    <article className={className}>
      <header className='catalog-edit-header finance-settings-accordion-header'>
        <button
          type='button'
          className='finance-settings-accordion-toggle'
          aria-expanded={isExpanded}
          onClick={() => onToggleCard(cardId)}
        >
          <h2>{title}</h2>
          <span>{isExpanded ? '-' : '+'}</span>
        </button>
      </header>
      {isExpanded ? children : null}
    </article>
  );
};