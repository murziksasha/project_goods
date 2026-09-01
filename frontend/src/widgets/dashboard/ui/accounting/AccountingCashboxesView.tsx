import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceTransactionType,
} from '../../../../entities/finance/model/types';
import { Modal } from '../../../../shared/ui/Modal';
import {
  accountingHideEmptyCashboxesStorageKey,
  formatMoney,
  getStoredHideEmptyCashboxes,
  reorderCashboxes,
  type CashboxCurrencyRow,
} from '../../model/accounting';
import { AccountingOperationForm } from './AccountingOperationForm';

type AccountingCashboxesViewProps = {
  allowedTransactionCurrencies: string[];
  canCreateDeposit: boolean;
  canCreateTransfer: boolean;
  canCreateWithdraw: boolean;
  allCurrencyCodes: string[];
  canManageCashboxes: boolean;
  cashboxes: Cashbox[];
  cashboxCurrencyRows: (cashbox: Cashbox) => CashboxCurrencyRow[];
  draggedCashboxId: string | null;
  isSaving: boolean;
  permittedTransactionTypes: FinanceTransactionType[];
  totals: Record<string, number>;
  transactionForm: CreateFinanceTransactionPayload;
  onCreateCashbox: (
    name: string,
    enabledCurrencies?: Record<string, boolean>,
  ) => void | Promise<unknown>;
  onCreateTransaction: () => boolean | void | Promise<boolean | void>;
  onOpenCashboxTransactions: (cashbox: Cashbox) => void;
  onSetCashboxes: Dispatch<SetStateAction<Cashbox[]>>;
  onSetDraggedCashboxId: (cashboxId: string | null) => void;
  onStartTransaction: (type: FinanceTransactionType, cashbox: Cashbox) => void;
  onTransactionFormChange: (
    updater: SetStateAction<CreateFinanceTransactionPayload>,
  ) => void;
  onTransactionTypeChange: (type: FinanceTransactionType) => void;
};

const isCashboxEmpty = (
  cashbox: Cashbox,
  cashboxCurrencyRows: (cashbox: Cashbox) => CashboxCurrencyRow[],
) => {
  const rows = cashboxCurrencyRows(cashbox);
  if (rows.length === 0) return true;
  return rows.every((row) => row.balance === 0);
};

export const AccountingCashboxesView = ({
  allowedTransactionCurrencies,
  canCreateDeposit,
  canCreateTransfer,
  canCreateWithdraw,
  allCurrencyCodes,
  canManageCashboxes,
  cashboxes,
  cashboxCurrencyRows,
  draggedCashboxId,
  isSaving,
  permittedTransactionTypes,
  totals,
  transactionForm,
  onCreateCashbox,
  onCreateTransaction,
  onOpenCashboxTransactions,
  onSetCashboxes,
  onSetDraggedCashboxId,
  onStartTransaction,
  onTransactionFormChange,
  onTransactionTypeChange,
}: AccountingCashboxesViewProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [hideEmpty, setHideEmpty] = useState(getStoredHideEmptyCashboxes);
  const [isOperationOpen, setIsOperationOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEnabledCurrencies, setCreateEnabledCurrencies] = useState<
    Record<string, boolean>
  >({ UAH: true });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingHideEmptyCashboxesStorageKey,
        String(hideEmpty),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [hideEmpty]);

  const defaultOperationType = permittedTransactionTypes.includes('withdraw')
    ? 'withdraw'
    : permittedTransactionTypes[0];
  const transactionTypeLabel = (type: FinanceTransactionType) =>
    t(`accounting.cashboxes.${type}`);

  const visibleCashboxes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return cashboxes.filter((cashbox) => {
      if (
        normalizedQuery &&
        !cashbox.name.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      if (hideEmpty && isCashboxEmpty(cashbox, cashboxCurrencyRows)) {
        return false;
      }
      return true;
    });
  }, [cashboxCurrencyRows, cashboxes, hideEmpty, searchQuery]);

  const sourceCashbox = cashboxes.find(
    (cashbox) =>
      cashbox.id ===
      (transactionForm.type === 'deposit'
        ? transactionForm.toCashboxId
        : transactionForm.fromCashboxId),
  );
  const availableBalance =
    transactionForm.type === 'deposit' || !sourceCashbox
      ? null
      : (sourceCashbox.balances[transactionForm.currency] ?? 0);

  const openOperation = useCallback(
    (type: FinanceTransactionType, cashbox: Cashbox) => {
      onStartTransaction(type, cashbox);
      setIsOperationOpen(true);
    },
    [onStartTransaction],
  );

  const closeOperation = useCallback(() => {
    if (isSaving) return;
    setIsOperationOpen(false);
  }, [isSaving]);

  const handleSave = useCallback(
    async (closeAfter: boolean) => {
      const saved = await onCreateTransaction();
      if (closeAfter && saved) {
        setIsOperationOpen(false);
      }
    },
    [onCreateTransaction],
  );

  const handleCardDrop = (target: Cashbox) => {
    if (!canManageCashboxes) {
      onSetDraggedCashboxId(null);
      return;
    }
    if (!draggedCashboxId || draggedCashboxId === target.id) {
      onSetDraggedCashboxId(null);
      return;
    }
    onSetCashboxes((current) =>
      reorderCashboxes(current, draggedCashboxId, target.id),
    );
    onSetDraggedCashboxId(null);
  };

  return (
    <>
      <div className='finance-toolbar'>
        <div className='finance-total-strip'>
          {Object.entries(totals)
            .filter(([currency, amount]) => currency === 'UAH' || amount !== 0)
            .map(([currency, amount], index) =>
              index === 0 ? (
                <strong key={currency}>{formatMoney(amount, currency)}</strong>
              ) : (
                <span key={currency}>{formatMoney(amount, currency)}</span>
              ),
            )}
          <span className='finance-cashbox-count'>
            {t('accounting.cashboxes.cashboxCount', { count: cashboxes.length })}
          </span>
        </div>
        <div className='finance-cashbox-toolbar-tools'>
          <input
            className='finance-cashbox-search'
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('accounting.cashboxes.searchPlaceholder')}
            aria-label={t('accounting.cashboxes.searchPlaceholder')}
          />
          <label className='finance-hide-empty'>
            <input
              type='checkbox'
              checked={hideEmpty}
              onChange={(event) => setHideEmpty(event.target.checked)}
            />
            {t('accounting.cashboxes.hideEmpty')}
          </label>
          {canManageCashboxes ? (
            <button
              type='button'
              className='orders-create-button'
              onClick={() => {
                setCreateEnabledCurrencies({ UAH: true });
                setIsCreateOpen(true);
              }}
            >
              {t('accounting.cashboxes.addCashbox')}
            </button>
          ) : null}
        </div>
      </div>

      {cashboxes.length === 0 ? (
        <div className='empty-state'>
          <p>{t('accounting.cashboxes.empty')}</p>
          {canManageCashboxes ? (
            <button
              type='button'
              className='orders-create-button'
              onClick={() => setIsCreateOpen(true)}
            >
              {t('accounting.cashboxes.addCashbox')}
            </button>
          ) : null}
        </div>
      ) : visibleCashboxes.length === 0 ? (
        <p className='empty-state'>{t('accounting.cashboxes.searchNoResults')}</p>
      ) : (
        <div className='finance-cashbox-grid'>
          {visibleCashboxes.map((cashbox) => (
            <article
              key={cashbox.id}
              className={
                draggedCashboxId === cashbox.id
                  ? 'finance-cashbox-card finance-cashbox-card-dragging'
                  : 'finance-cashbox-card'
              }
              draggable={canManageCashboxes}
              onDragStart={() => {
                if (!canManageCashboxes) return;
                onSetDraggedCashboxId(cashbox.id);
              }}
              onDragOver={(event) => {
                if (!canManageCashboxes) return;
                event.preventDefault();
              }}
              onDrop={() => handleCardDrop(cashbox)}
              onDragEnd={() => onSetDraggedCashboxId(null)}
              onClick={() => {
                if (!defaultOperationType) return;
                openOperation(defaultOperationType, cashbox);
              }}
            >
              <div className='finance-cashbox-heading'>
                {canManageCashboxes ? (
                  <span
                    className='finance-cashbox-drag-handle'
                    aria-hidden
                    title={t('accounting.cashboxes.reorderHint')}
                  >
                    ::
                  </span>
                ) : null}
                <h3 title={cashbox.name}>{cashbox.name}</h3>
                {cashbox.isDefault ? (
                  <span>{t('accounting.cashboxes.default')}</span>
                ) : null}
              </div>
              <div className='finance-cashbox-balances'>
                {cashboxCurrencyRows(cashbox).length === 0 ? (
                  <span className='finance-cashbox-balance-row finance-cashbox-balance-row-inactive'>
                    <strong>
                      {t('accounting.cashboxes.noActiveCurrencyBalances')}
                    </strong>
                  </span>
                ) : (
                  cashboxCurrencyRows(cashbox).map(
                    ({ currency, balance, canAccept }) => (
                      <div
                        key={`${cashbox.id}-${currency}`}
                        className={
                          canAccept
                            ? 'finance-cashbox-balance-row'
                            : 'finance-cashbox-balance-row finance-cashbox-balance-row-inactive'
                        }
                      >
                        <strong
                          className={
                            currency === 'UAH'
                              ? 'finance-cashbox-balance-value finance-cashbox-balance-value-uah'
                              : 'finance-cashbox-balance-value'
                          }
                        >
                          {currency === 'UAH' ? (
                            <>
                              <span className='finance-cashbox-balance-amount'>
                                {new Intl.NumberFormat('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }).format(balance)}
                              </span>
                              <span className='finance-cashbox-balance-currency-code'>
                                UAH
                              </span>
                            </>
                          ) : (
                            formatMoney(balance, currency)
                          )}
                        </strong>
                        {canAccept ? null : (
                          <span
                            title={t('accounting.cashboxes.withdrawOnlyTitle')}
                          >
                            {t('accounting.cashboxes.withdrawOnly')}
                          </span>
                        )}
                      </div>
                    ),
                  )
                )}
              </div>
              <div className='finance-cashbox-actions'>
                {defaultOperationType ? (
                  <button
                    type='button'
                    className='primary-button'
                    onClick={(event) => {
                      event.stopPropagation();
                      openOperation(defaultOperationType, cashbox);
                    }}
                  >
                    {t('accounting.cashboxes.operation')}
                  </button>
                ) : null}
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenCashboxTransactions(cashbox);
                  }}
                >
                  {t('accounting.cashboxes.transactions')}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {isCreateOpen && canManageCashboxes ? (
        <Modal
          isOpen
          title={t('accounting.cashboxes.addCashbox')}
          onClose={() => {
            if (isSaving) return;
            setIsCreateOpen(false);
          }}
          closeLabel={t('common.close')}
          className='finance-operation-modal'
          closeOnBackdrop={!isSaving}
          closeOnEscape={!isSaving}
        >
          <label className='field'>
            <span>{t('common.name')}</span>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t('accounting.cashboxes.newCashboxPlaceholder')}
              autoFocus
            />
          </label>
          <p className='section-label'>
            {t('accounting.financeSettings.receiveCurrencies')}
          </p>
          <div className='finance-currency-activity-list'>
            {allCurrencyCodes.map((currencyCode) => (
              <label
                key={`create-modal-${currencyCode}`}
                className='field-inline finance-currency-activity-toggle'
              >
                <input
                  type='checkbox'
                  checked={createEnabledCurrencies[currencyCode] === true}
                  onChange={() =>
                    setCreateEnabledCurrencies((current) => {
                      const next = {
                        ...current,
                        [currencyCode]: current[currencyCode] !== true,
                      };
                      if (!Object.values(next).some(Boolean)) return current;
                      return next;
                    })
                  }
                />
                <span>{currencyCode}</span>
              </label>
            ))}
          </div>
          <button
            type='button'
            className='primary-button'
            disabled={isSaving || createName.trim().length < 2}
            onClick={() => {
              const enabledCurrencies = {
                ...Object.fromEntries(
                  allCurrencyCodes.map((code) => [code, false]),
                ),
                ...createEnabledCurrencies,
              };
              void Promise.resolve(
                onCreateCashbox(createName.trim(), enabledCurrencies),
              ).then((result) => {
                if (result === undefined) return;
                setCreateName('');
                setCreateEnabledCurrencies({ UAH: true });
                setIsCreateOpen(false);
              });
            }}
          >
            {isSaving
              ? t('accounting.cashboxes.saving')
              : t('common.create')}
          </button>
        </Modal>
      ) : null}

      {isOperationOpen && permittedTransactionTypes.length > 0 ? (
        <Modal
          isOpen
          title={transactionTypeLabel(transactionForm.type)}
          subtitle={t('accounting.cashboxes.operation')}
          onClose={closeOperation}
          closeLabel={t('common.close')}
          className='finance-operation-modal'
          closeOnBackdrop={!isSaving}
          closeOnEscape={!isSaving}
        >
          <AccountingOperationForm
            allowedTransactionCurrencies={allowedTransactionCurrencies}
            availableBalance={availableBalance}
            canCreateDeposit={canCreateDeposit}
            canCreateTransfer={canCreateTransfer}
            canCreateWithdraw={canCreateWithdraw}
            cashboxes={cashboxes}
            isSaving={isSaving}
            saveDisabled={
              isSaving ||
              !transactionForm.amount ||
              allowedTransactionCurrencies.length === 0
            }
            transactionForm={transactionForm}
            onCreateTransaction={(closeAfter) => {
              void handleSave(closeAfter);
            }}
            onTransactionFormChange={onTransactionFormChange}
            onTransactionTypeChange={onTransactionTypeChange}
          />
        </Modal>
      ) : null}
    </>
  );
};
