import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type {
  Sale,
  SaleLineCostUpdateItem,
  SaleLineItem,
} from '../../../../../entities/sale';
import {
  isLineItemEligibleForCostAudit,
  useSaleByIdQuery,
  useUpdateSaleLineCostsMutation,
} from '../../../../../entities/sale';
import { useFinancePolicyQuery } from '../../../../../entities/finance';
import { formatCurrency, formatDateTime } from '../../../../../shared/lib/format';
import { Button } from '../../../../../shared/ui/Button';
import { Modal } from '../../../../../shared/ui/Modal';
import { isRepairDevicePlaceholderLineItem } from '../workspace/orders-workspace-shared';

export interface OrderCostAuditModalProps {
  saleId: string | null;
  initialSale?: Sale | null;
  serviceAuditEnabled?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedSale: Sale) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

type LineCostDraft = {
  lineItemId: string;
  kind: 'product' | 'service';
  name: string;
  quantity: number;
  status: 'known' | 'unknown';
  costMethod: 'fixed' | 'time_rate';
  unitCost: string;
  fixedCost: string;
  hourlyCost: string;
  recordedMinutes: string;
  directExpenses: string;
  initialStatus: 'known' | 'unknown';
  initialCostMethod: 'fixed' | 'time_rate';
  initialUnitCost: number | null;
  initialFixedCost: number | null;
  initialHourlyCost: number | null;
  initialRecordedMinutes: number | null;
  initialDirectExpenses: number | null;
  currentStatus: 'known' | 'unknown';
  currentTotalCost: number | null;
  auditEntries: NonNullable<SaleLineItem['costAuditLog']>;
};

const parseMoneyInput = (
  raw: string,
): { valid: boolean; value: number | null } => {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return { valid: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { valid: false, value: null };
  }
  return { valid: true, value: Math.round(parsed * 100) / 100 };
};

const numbersDiffer = (a: number | null, b: number | null) => {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return Math.abs(a - b) > 0.0001;
};

const resolveInitialProductUnitCost = (item: SaleLineItem): number | null => {
  if (
    item.unitCostOverride !== undefined &&
    item.unitCostOverride !== null &&
    Number.isFinite(Number(item.unitCostOverride))
  ) {
    return Number(item.unitCostOverride);
  }
  const effective = item.auditedCost ?? item.costSnapshot ?? null;
  if (effective?.status !== 'known') return null;
  const qty = Math.max(Number(item.quantity) || 1, 1);
  if (
    effective.totalCost !== null &&
    effective.totalCost !== undefined &&
    Number.isFinite(Number(effective.totalCost))
  ) {
    const expenses =
      item.directExpenses !== undefined && item.directExpenses !== null
        ? Number(item.directExpenses)
        : Number(effective.directExpenses ?? 0);
    const base = Math.max(
      0,
      Number(effective.totalCost) - (Number.isFinite(expenses) ? expenses : 0),
    );
    return Math.round((base / qty) * 100) / 100;
  }
  return effective.unitCost !== undefined && effective.unitCost !== null
    ? Number(effective.unitCost)
    : null;
};

const toRoundedOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
};

const toDraft = (item: SaleLineItem): LineCostDraft => {
  const kind: 'product' | 'service' =
    item.kind === 'service' ? 'service' : 'product';
  const effective = item.auditedCost ?? item.costSnapshot ?? null;
  const currentStatus = effective?.status === 'known' ? 'known' : 'unknown';
  const currentTotalCost =
    effective?.totalCost !== undefined && effective?.totalCost !== null
      ? Number(effective.totalCost)
      : null;
  const initialDirectExpenses = toRoundedOrNull(item.directExpenses);

  if (kind === 'service') {
    const initialCostMethod: 'fixed' | 'time_rate' =
      effective?.method === 'time_rate' ||
      (effective?.method !== 'fixed' && item.costMethod === 'time_rate')
        ? 'time_rate'
        : 'fixed';
    const initialFixedCost =
      currentStatus === 'known'
        ? toRoundedOrNull(
            item.unitCostOverride ??
              item.fixedCost ??
              effective?.fixedCost ??
              effective?.unitCost,
          )
        : toRoundedOrNull(item.fixedCost);
    const initialHourlyCost = toRoundedOrNull(
      item.hourlyCost ?? effective?.hourlyCost,
    );
    const initialRecordedMinutes = toRoundedOrNull(
      item.recordedMinutes ?? effective?.recordedMinutes,
    );

    return {
      lineItemId: item.id,
      kind: 'service',
      name: item.name,
      quantity: Math.max(Number(item.quantity) || 1, 1),
      status: 'known',
      costMethod: initialCostMethod,
      unitCost: '',
      fixedCost: initialFixedCost !== null ? String(initialFixedCost) : '',
      hourlyCost: initialHourlyCost !== null ? String(initialHourlyCost) : '',
      recordedMinutes:
        initialRecordedMinutes !== null ? String(initialRecordedMinutes) : '',
      directExpenses:
        initialDirectExpenses !== null ? String(initialDirectExpenses) : '',
      initialStatus: currentStatus,
      initialCostMethod,
      initialUnitCost: null,
      initialFixedCost,
      initialHourlyCost,
      initialRecordedMinutes,
      initialDirectExpenses,
      currentStatus,
      currentTotalCost,
      auditEntries: Array.isArray(item.costAuditLog) ? item.costAuditLog : [],
    };
  }

  const initialUnitCost =
    currentStatus === 'known' ? resolveInitialProductUnitCost(item) : null;

  return {
    lineItemId: item.id,
    kind: 'product',
    name: item.name,
    quantity: Math.max(Number(item.quantity) || 1, 1),
    status: 'known',
    costMethod: 'fixed',
    unitCost: initialUnitCost !== null ? String(initialUnitCost) : '',
    fixedCost: '',
    hourlyCost: '',
    recordedMinutes: '',
    directExpenses:
      initialDirectExpenses !== null ? String(initialDirectExpenses) : '',
    initialStatus: currentStatus,
    initialCostMethod: 'fixed',
    initialUnitCost,
    initialFixedCost: null,
    initialHourlyCost: null,
    initialRecordedMinutes: null,
    initialDirectExpenses,
    currentStatus,
    currentTotalCost,
    auditEntries: Array.isArray(item.costAuditLog) ? item.costAuditLog : [],
  };
};

const isDraftModified = (draft: LineCostDraft): boolean => {
  if (draft.kind === 'service') {
    if (draft.initialStatus === 'unknown') {
      if (draft.status === 'unknown') return false;
      if (draft.costMethod === 'time_rate') {
        const parsedHourly = parseMoneyInput(draft.hourlyCost);
        const parsedMinutes = parseMoneyInput(draft.recordedMinutes);
        return (
          (parsedHourly.valid && parsedHourly.value !== null) &&
          (parsedMinutes.valid && parsedMinutes.value !== null)
        );
      }
      return (
        draft.fixedCost.trim() !== '' || draft.directExpenses.trim() !== ''
      );
    }
    if (draft.status === 'unknown') return true;
    if (draft.costMethod !== draft.initialCostMethod) return true;
    const parsedExpenses = parseMoneyInput(draft.directExpenses);
    if (!parsedExpenses.valid) return true;
    if (numbersDiffer(parsedExpenses.value, draft.initialDirectExpenses)) {
      return true;
    }
    if (draft.costMethod === 'time_rate') {
      const parsedHourly = parseMoneyInput(draft.hourlyCost);
      const parsedMinutes = parseMoneyInput(draft.recordedMinutes);
      if (!parsedHourly.valid || !parsedMinutes.valid) return true;
      return (
        numbersDiffer(parsedHourly.value, draft.initialHourlyCost) ||
        numbersDiffer(parsedMinutes.value, draft.initialRecordedMinutes)
      );
    }
    const parsedFixed = parseMoneyInput(draft.fixedCost);
    if (!parsedFixed.valid) return true;
    return numbersDiffer(parsedFixed.value, draft.initialFixedCost);
  }

  if (draft.initialStatus === 'unknown') {
    if (draft.status === 'unknown') return false;
    return (
      draft.unitCost.trim() !== '' || draft.directExpenses.trim() !== ''
    );
  }
  if (draft.status === 'unknown') return true;
  const parsedUnit = parseMoneyInput(draft.unitCost);
  const parsedExpenses = parseMoneyInput(draft.directExpenses);
  if (!parsedUnit.valid || !parsedExpenses.valid) return true;
  return (
    numbersDiffer(parsedUnit.value, draft.initialUnitCost) ||
    numbersDiffer(parsedExpenses.value, draft.initialDirectExpenses)
  );
};

const translateCostAuditError = (error: unknown, t: TFunction): string => {
  const rawMessage = error instanceof Error ? error.message.trim() : '';
  const lower = rawMessage.toLowerCase();
  if (!rawMessage) return t('orders.costAudit.errors.saveFailed');
  if (lower.includes('reason is required')) {
    return t('orders.costAudit.errors.reasonRequired');
  }
  if (lower.includes('finance.view') || lower.includes('permission')) {
    return t('orders.costAudit.errors.permissionDenied');
  }
  if (lower.includes('service cost audit is currently disabled')) {
    return t('orders.costAudit.errors.serviceAuditDisabled');
  }
  if (lower.includes('only allowed for product')) {
    return t('orders.costAudit.errors.onlyProductsAllowed');
  }
  if (lower.includes('does not require cost audit')) {
    return t('orders.costAudit.errors.notEligible');
  }
  if (lower.includes('incomplete cost')) {
    return t('orders.costAudit.errors.incompleteCost');
  }
  return rawMessage;
};

export const OrderCostAuditModal: React.FC<OrderCostAuditModalProps> = ({
  saleId,
  initialSale = null,
  serviceAuditEnabled: serviceAuditEnabledProp,
  isOpen,
  onClose,
  onSaved,
  onError,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const shouldFetch = Boolean(isOpen && saleId && !initialSale);
  const saleQuery = useSaleByIdQuery(saleId, shouldFetch);
  const financePolicyQuery = useFinancePolicyQuery({
    enabled: isOpen && serviceAuditEnabledProp === undefined,
  });
  const serviceAuditEnabled =
    serviceAuditEnabledProp ??
    financePolicyQuery.data?.serviceAuditEnabled ??
    false;
  const sale = initialSale ?? saleQuery.data ?? null;
  const updateCostsMutation = useUpdateSaleLineCostsMutation();

  const [drafts, setDrafts] = useState<LineCostDraft[]>([]);
  const [globalReason, setGlobalReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) {
      setDrafts([]);
      setGlobalReason('');
      setLocalError(null);
      return;
    }
    const items = Array.isArray(sale.lineItems) ? sale.lineItems : [];
    const eligibleItems = items.filter(
      (item) =>
        !isRepairDevicePlaceholderLineItem(sale, item) &&
        isLineItemEligibleForCostAudit(item, { serviceAuditEnabled }),
    );
    setDrafts(eligibleItems.map(toDraft));
    setGlobalReason('');
    setLocalError(null);
  }, [isOpen, sale, serviceAuditEnabled]);

  const modifiedDrafts = useMemo(
    () => drafts.filter(isDraftModified),
    [drafts],
  );
  const productDrafts = useMemo(
    () => drafts.filter((draft) => draft.kind === 'product'),
    [drafts],
  );
  const serviceDrafts = useMemo(
    () => drafts.filter((draft) => draft.kind === 'service'),
    [drafts],
  );

  if (!isOpen) return null;

  const updateDraft = (
    lineItemId: string,
    patch: Partial<LineCostDraft>,
  ) => {
    setLocalError(null);
    setDrafts((current) =>
      current.map((draft) =>
        draft.lineItemId === lineItemId ? { ...draft, ...patch } : draft,
      ),
    );
  };

  const handleSave = async () => {
    if (!sale) return;
    setLocalError(null);

    if (modifiedDrafts.length === 0) {
      setLocalError(t('orders.costAudit.errors.noChanges'));
      return;
    }

    const reasonText = globalReason.trim();
    const items: SaleLineCostUpdateItem[] = [];

    for (const draft of modifiedDrafts) {
      if (draft.currentStatus === 'known' && reasonText.length < 2) {
        setLocalError(t('orders.costAudit.errors.reasonRequired'));
        return;
      }

      if (draft.status === 'unknown') {
        if (reasonText.length < 2) {
          setLocalError(t('orders.costAudit.errors.reasonRequired'));
          return;
        }
        items.push({
          lineItemId: draft.lineItemId,
          status: 'unknown',
          reason: reasonText,
        });
        continue;
      }

      const parsedExpenses = parseMoneyInput(draft.directExpenses);
      if (!parsedExpenses.valid) {
        setLocalError(
          t('orders.costAudit.errors.invalidDirectExpenses', {
            name: draft.name,
          }),
        );
        return;
      }

      if (draft.kind === 'service') {
        if (draft.costMethod === 'time_rate') {
          const parsedHourly = parseMoneyInput(draft.hourlyCost);
          const parsedMinutes = parseMoneyInput(draft.recordedMinutes);
          if (
            !parsedHourly.valid ||
            parsedHourly.value === null ||
            !parsedMinutes.valid ||
            parsedMinutes.value === null
          ) {
            setLocalError(
              t('orders.costAudit.errors.invalidServiceTimeRate', {
                name: draft.name,
              }),
            );
            return;
          }
          items.push({
            lineItemId: draft.lineItemId,
            status: 'known',
            costMethod: 'time_rate',
            hourlyCost: parsedHourly.value,
            recordedMinutes: parsedMinutes.value,
            directExpenses: parsedExpenses.value,
            ...(reasonText ? { reason: reasonText } : {}),
          });
          continue;
        }

        const parsedFixed = parseMoneyInput(draft.fixedCost);
        if (!parsedFixed.valid || parsedFixed.value === null) {
          setLocalError(
            t('orders.costAudit.errors.invalidUnitCost', { name: draft.name }),
          );
          return;
        }
        items.push({
          lineItemId: draft.lineItemId,
          status: 'known',
          costMethod: 'fixed',
          fixedCost: parsedFixed.value,
          directExpenses: parsedExpenses.value,
          ...(reasonText ? { reason: reasonText } : {}),
        });
        continue;
      }

      const parsedUnit = parseMoneyInput(draft.unitCost);
      if (!parsedUnit.valid || parsedUnit.value === null) {
        setLocalError(
          t('orders.costAudit.errors.invalidUnitCost', { name: draft.name }),
        );
        return;
      }

      items.push({
        lineItemId: draft.lineItemId,
        status: 'known',
        unitCost: parsedUnit.value,
        directExpenses: parsedExpenses.value,
        ...(reasonText ? { reason: reasonText } : {}),
      });
    }

    try {
      const updated = await updateCostsMutation.mutateAsync({
        saleId: sale.id,
        payload: {
          items,
          reason: reasonText || undefined,
        },
      });
      onSuccess?.(t('orders.costAudit.messages.saved'));
      onSaved?.(updated);
      onClose();
    } catch (error) {
      const msg = translateCostAuditError(error, t);
      setLocalError(msg);
      onError?.(msg);
    }
  };

  const renderDraftCard = (draft: LineCostDraft) => (
    <div key={draft.lineItemId} className='cost-audit-item-card'>
      <div className='cost-audit-item-header'>
        <strong className='cost-audit-item-title'>
          {draft.name}{' '}
          <span className='cost-audit-item-qty'>
            {t('orders.costAudit.quantityBadge', {
              qty: draft.quantity,
            })}
          </span>
        </strong>
        <span
          className={`report-badge ${
            draft.currentStatus === 'known' ? 'is-success' : 'is-warning'
          }`}
        >
          {draft.currentStatus === 'known' && draft.currentTotalCost !== null
            ? t('orders.costAudit.currentKnown', {
                amount: formatCurrency(draft.currentTotalCost),
              })
            : t('orders.costAudit.currentUnknown')}
        </span>
      </div>

      <div className='form-grid cost-audit-item-fields'>
        {draft.currentStatus === 'known' ? (
          <label className='field'>
            <span>{t('orders.costAudit.statusLabel')}</span>
            <select
              value={draft.status}
              onChange={(event) =>
                updateDraft(draft.lineItemId, {
                  status: event.target.value === 'unknown' ? 'unknown' : 'known',
                })
              }
            >
              <option value='known'>{t('orders.costAudit.statusKnown')}</option>
              <option value='unknown'>
                {t('orders.costAudit.statusUnknown')}
              </option>
            </select>
          </label>
        ) : null}

        {draft.status === 'known' && draft.kind === 'service' ? (
          <>
            <label className='field'>
              <span>{t('orders.costAudit.costMethodLabel')}</span>
              <select
                value={draft.costMethod}
                onChange={(event) =>
                  updateDraft(draft.lineItemId, {
                    costMethod:
                      event.target.value === 'time_rate' ? 'time_rate' : 'fixed',
                  })
                }
              >
                <option value='fixed'>
                  {t('orders.costAudit.costMethodFixed')}
                </option>
                <option value='time_rate'>
                  {t('orders.costAudit.costMethodTimeRate')}
                </option>
              </select>
            </label>
            {draft.costMethod === 'time_rate' ? (
              <>
                <label className='field'>
                  <span>{t('orders.costAudit.hourlyCostLabel')}</span>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={draft.hourlyCost}
                    placeholder='0.00'
                    onChange={(event) =>
                      updateDraft(draft.lineItemId, {
                        hourlyCost: event.target.value,
                      })
                    }
                  />
                </label>
                <label className='field'>
                  <span>{t('orders.costAudit.recordedMinutesLabel')}</span>
                  <input
                    type='number'
                    min='0'
                    step='1'
                    value={draft.recordedMinutes}
                    placeholder='0'
                    onChange={(event) =>
                      updateDraft(draft.lineItemId, {
                        recordedMinutes: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <label className='field'>
                <span>{t('orders.costAudit.fixedCostLabel')}</span>
                <input
                  type='number'
                  min='0'
                  step='0.01'
                  value={draft.fixedCost}
                  placeholder='0.00'
                  onChange={(event) =>
                    updateDraft(draft.lineItemId, {
                      fixedCost: event.target.value,
                    })
                  }
                />
              </label>
            )}
            <label className='field'>
              <span>{t('orders.costAudit.directExpensesLabel')}</span>
              <input
                type='number'
                min='0'
                step='0.01'
                value={draft.directExpenses}
                placeholder='0.00'
                onChange={(event) =>
                  updateDraft(draft.lineItemId, {
                    directExpenses: event.target.value,
                  })
                }
              />
            </label>
          </>
        ) : null}

        {draft.status === 'known' && draft.kind === 'product' ? (
          <>
            <label className='field'>
              <span>{t('orders.costAudit.unitCostLabel')}</span>
              <input
                type='number'
                min='0'
                step='0.01'
                value={draft.unitCost}
                placeholder='0.00'
                onChange={(event) =>
                  updateDraft(draft.lineItemId, {
                    unitCost: event.target.value,
                  })
                }
              />
            </label>
            <label className='field'>
              <span>{t('orders.costAudit.directExpensesLabel')}</span>
              <input
                type='number'
                min='0'
                step='0.01'
                value={draft.directExpenses}
                placeholder='0.00'
                onChange={(event) =>
                  updateDraft(draft.lineItemId, {
                    directExpenses: event.target.value,
                  })
                }
              />
            </label>
          </>
        ) : null}
      </div>

      {draft.auditEntries.length > 0 ? (
        <div className='cost-audit-history-list'>
          <strong className='cost-audit-history-title'>
            {t('orders.costAudit.historyTitle')}
          </strong>
          {draft.auditEntries.map((entry) => (
            <div key={entry.id} className='cost-audit-history-item'>
              <div>
                {entry.previousStatus === 'known'
                  ? t('orders.costAudit.statusShortKnown')
                  : t('orders.costAudit.statusShortUnknown')}{' '}
                (
                {entry.previousTotalCost !== null
                  ? formatCurrency(entry.previousTotalCost)
                  : t('orders.costAudit.na')}
                ) →{' '}
                <strong>
                  {entry.newStatus === 'known'
                    ? t('orders.costAudit.statusShortKnown')
                    : t('orders.costAudit.statusShortUnknown')}
                </strong>{' '}
                (
                {entry.newTotalCost !== null
                  ? formatCurrency(entry.newTotalCost)
                  : t('orders.costAudit.na')}
                )
              </div>
              <div className='muted-copy'>
                {t('orders.costAudit.historyMeta', {
                  author: entry.authorName,
                  date: formatDateTime(entry.changedAt),
                  reason: entry.reason,
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      usePortal
      className='cost-audit-modal'
      bodyClassName='cost-audit-modal-body'
      title={t('orders.costAudit.title')}
      subtitle={sale?.recordNumber ? `#${sale.recordNumber}` : undefined}
      closeLabel={t('orders.costAudit.close')}
      onClose={onClose}
      closeOnBackdrop={!updateCostsMutation.isPending}
      closeOnEscape={!updateCostsMutation.isPending}
      footer={
        <footer className='catalog-edit-footer cost-audit-modal-footer'>
          <Button
            variant='secondary'
            onClick={onClose}
            disabled={updateCostsMutation.isPending}
          >
            {t('orders.costAudit.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={() => void handleSave()}
            disabled={
              updateCostsMutation.isPending || modifiedDrafts.length === 0
            }
          >
            {updateCostsMutation.isPending
              ? t('orders.costAudit.saving')
              : t('orders.costAudit.save')}
          </Button>
        </footer>
      }
    >
      {saleQuery.isLoading ? (
        <div className='report-state-box'>{t('orders.costAudit.loading')}</div>
      ) : saleQuery.isError ? (
        <div className='report-state-box is-error' role='alert'>
          {saleQuery.error instanceof Error && saleQuery.error.message.trim()
            ? saleQuery.error.message
            : t('orders.costAudit.errors.loadFailed')}
        </div>
      ) : (
        <div className='cost-audit-modal-content'>
          <p className='muted-copy cost-audit-helper'>
            {t('orders.costAudit.subtitle')}
          </p>

          {localError ? (
            <div className='report-state-box is-error' role='alert'>
              {localError}
            </div>
          ) : null}

          {drafts.length === 0 ? (
            <div className='report-state-box'>{t('orders.costAudit.empty')}</div>
          ) : (
            <>
              <label className='field field-wide cost-audit-reason-field'>
                <span>{t('orders.costAudit.reasonLabel')}</span>
                <input
                  type='text'
                  value={globalReason}
                  placeholder={t('orders.costAudit.reasonPlaceholder')}
                  onChange={(event) => {
                    setLocalError(null);
                    setGlobalReason(event.target.value);
                  }}
                />
              </label>

              <div className='cost-audit-items-list'>
                {productDrafts.length > 0 ? (
                  <section
                    className='cost-audit-group'
                    aria-label={t('orders.costAudit.groups.products')}
                  >
                    <h4 className='cost-audit-group-title'>
                      {t('orders.costAudit.groups.products')}
                    </h4>
                    {productDrafts.map(renderDraftCard)}
                  </section>
                ) : null}
                {serviceDrafts.length > 0 ? (
                  <section
                    className='cost-audit-group'
                    aria-label={t('orders.costAudit.groups.services')}
                  >
                    <h4 className='cost-audit-group-title'>
                      {t('orders.costAudit.groups.services')}
                    </h4>
                    {serviceDrafts.map(renderDraftCard)}
                  </section>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
