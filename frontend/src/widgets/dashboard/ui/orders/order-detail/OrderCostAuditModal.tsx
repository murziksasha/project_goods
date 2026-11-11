import { useEffect, useState } from 'react';
import type {
  Sale,
  SaleLineCostUpdateItem,
  SaleLineItem,
  ServiceCostMethod,
} from '../../../../../entities/sale';
import {
  useSaleByIdQuery,
  useUpdateSaleLineCostsMutation,
} from '../../../../../entities/sale';
import { formatCurrency, formatDateTime } from '../../../../../shared/lib/format';
import { Button } from '../../../../../shared/ui/Button';
import { Modal } from '../../../../../shared/ui/Modal';

export interface OrderCostAuditModalProps {
  saleId: string | null;
  initialSale?: Sale | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedSale: Sale) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

type LineCostDraft = {
  lineItemId: string;
  name: string;
  kind: 'product' | 'service';
  quantity: number;
  status: 'known' | 'unknown';
  costMethod: ServiceCostMethod;
  unitCost: string;
  fixedCost: string;
  hourlyCost: string;
  recordedMinutes: string;
  directExpenses: string;
  reason: string;
  currentStatus: 'known' | 'unknown';
  currentUnitCost: number | null;
  currentTotalCost: number | null;
  auditEntries: NonNullable<SaleLineItem['costAuditLog']>;
};

const toNumOrNull = (raw: string): number | null => {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const toDraft = (item: SaleLineItem): LineCostDraft => {
  const effective = item.auditedCost ?? item.costSnapshot ?? null;
  const currentStatus = effective?.status === 'known' ? 'known' : 'unknown';
  const currentUnitCost =
    effective?.unitCost !== undefined ? effective.unitCost : null;
  const currentTotalCost =
    effective?.totalCost !== undefined ? effective.totalCost : null;
  const method: ServiceCostMethod =
    item.costMethod === 'time_rate' ? 'time_rate' : 'fixed';

  return {
    lineItemId: item.id,
    name: item.name,
    kind: item.kind,
    quantity: Math.max(Number(item.quantity) || 1, 1),
    status: 'known',
    costMethod: method,
    unitCost:
      item.unitCostOverride !== undefined && item.unitCostOverride !== null
        ? String(item.unitCostOverride)
        : currentUnitCost !== null && item.kind === 'product'
          ? String(currentUnitCost)
          : '',
    fixedCost:
      item.fixedCost !== undefined && item.fixedCost !== null
        ? String(item.fixedCost)
        : '',
    hourlyCost:
      item.hourlyCost !== undefined && item.hourlyCost !== null
        ? String(item.hourlyCost)
        : '',
    recordedMinutes:
      item.recordedMinutes !== undefined && item.recordedMinutes !== null
        ? String(item.recordedMinutes)
        : '',
    directExpenses:
      item.directExpenses !== undefined && item.directExpenses !== null
        ? String(item.directExpenses)
        : '',
    reason: '',
    currentStatus,
    currentUnitCost,
    currentTotalCost,
    auditEntries: Array.isArray(item.costAuditLog) ? item.costAuditLog : [],
  };
};

export const OrderCostAuditModal: React.FC<OrderCostAuditModalProps> = ({
  saleId,
  initialSale = null,
  isOpen,
  onClose,
  onSaved,
  onError,
  onSuccess,
}) => {
  const shouldFetch = Boolean(isOpen && saleId && !initialSale);
  const saleQuery = useSaleByIdQuery(saleId, shouldFetch);
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
    setDrafts(items.map(toDraft));
    setGlobalReason('');
    setLocalError(null);
  }, [isOpen, sale]);

  if (!isOpen) return null;

  const updateDraft = (
    lineItemId: string,
    patch: Partial<LineCostDraft>,
  ) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.lineItemId === lineItemId ? { ...draft, ...patch } : draft,
      ),
    );
  };

  const handleSave = async () => {
    if (!sale) return;
    setLocalError(null);

    const items: SaleLineCostUpdateItem[] = drafts.map((draft) => {
      if (draft.status === 'unknown') {
        return {
          lineItemId: draft.lineItemId,
          status: 'unknown',
          reason: draft.reason.trim() || globalReason.trim() || undefined,
        };
      }
      if (draft.kind === 'service') {
        return {
          lineItemId: draft.lineItemId,
          status: 'known',
          costMethod: draft.costMethod,
          fixedCost: toNumOrNull(draft.fixedCost),
          hourlyCost: toNumOrNull(draft.hourlyCost),
          recordedMinutes: toNumOrNull(draft.recordedMinutes),
          directExpenses: toNumOrNull(draft.directExpenses),
          unitCost: toNumOrNull(draft.unitCost),
          reason: draft.reason.trim() || globalReason.trim() || undefined,
        };
      }
      return {
        lineItemId: draft.lineItemId,
        status: 'known',
        unitCost: toNumOrNull(draft.unitCost),
        directExpenses: toNumOrNull(draft.directExpenses),
        reason: draft.reason.trim() || globalReason.trim() || undefined,
      };
    });

    try {
      const updated = await updateCostsMutation.mutateAsync({
        saleId: sale.id,
        payload: {
          items,
          reason: globalReason.trim() || undefined,
        },
      });
      onSuccess?.('Order costs updated and audit log recorded.');
      onSaved?.(updated);
      onClose();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Failed to update order costs.';
      setLocalError(msg);
      onError?.(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={`Audit & Complete Costs${sale?.recordNumber ? ` #${sale.recordNumber}` : ''}`}
      subtitle="Complete missing costs (0 is accepted as explicit known zero cost) or correct known snapshots with a reason."
      onClose={onClose}
      closeOnBackdrop={!updateCostsMutation.isPending}
      closeOnEscape={!updateCostsMutation.isPending}
      footer={
        <footer className="catalog-edit-footer">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateCostsMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={updateCostsMutation.isPending || drafts.length === 0}
          >
            {updateCostsMutation.isPending ? 'Saving...' : 'Save Audited Costs'}
          </Button>
        </footer>
      }
    >
      {saleQuery.isLoading ? (
        <div className="report-state-box">Loading order details...</div>
      ) : saleQuery.isError ? (
        <div className="report-state-box is-error" role="alert">
          {saleQuery.error instanceof Error
            ? saleQuery.error.message
            : 'Failed to load order details.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {localError ? (
            <div className="report-state-box is-error" role="alert">
              {localError}
            </div>
          ) : null}

          <label className="field field-wide">
            <span>Audit Reason (required when correcting an already-known cost)</span>
            <input
              type="text"
              value={globalReason}
              placeholder="e.g., Supplier invoice verified / Post-closure cost completion"
              onChange={(e) => setGlobalReason(e.target.value)}
            />
          </label>

          {drafts.length === 0 ? (
            <div className="report-state-box">No line items recorded on this order.</div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.lineItemId}
                style={{
                  border: '1px solid var(--color-line)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>
                    {draft.name} (x{draft.quantity}, {draft.kind})
                  </strong>
                  <span
                    className={`report-badge ${
                      draft.currentStatus === 'known' ? 'is-success' : 'is-warning'
                    }`}
                  >
                    Current:{' '}
                    {draft.currentStatus === 'known' && draft.currentTotalCost !== null
                      ? formatCurrency(draft.currentTotalCost)
                      : 'Unknown cost'}
                  </span>
                </div>

                <div className="form-grid" style={{ marginBottom: 0 }}>
                  <label className="field">
                    <span>Cost status</span>
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        updateDraft(draft.lineItemId, {
                          status: e.target.value === 'unknown' ? 'unknown' : 'known',
                        })
                      }
                    >
                      <option value="known">Known cost (explicit value)</option>
                      <option value="unknown">Mark Unknown (requires reason)</option>
                    </select>
                  </label>

                  {draft.status === 'known' && draft.kind === 'service' ? (
                    <label className="field">
                      <span>Service cost method</span>
                      <select
                        value={draft.costMethod}
                        onChange={(e) =>
                          updateDraft(draft.lineItemId, {
                            costMethod:
                              e.target.value === 'time_rate' ? 'time_rate' : 'fixed',
                          })
                        }
                      >
                        <option value="fixed">Fixed cost per service</option>
                        <option value="time_rate">Recorded minutes x hourly cost</option>
                      </select>
                    </label>
                  ) : null}

                  {draft.status === 'known' && draft.kind === 'product' ? (
                    <label className="field">
                      <span>Unit cost (UAH)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.unitCost}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateDraft(draft.lineItemId, { unitCost: e.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  {draft.status === 'known' &&
                  draft.kind === 'service' &&
                  draft.costMethod === 'fixed' ? (
                    <label className="field">
                      <span>Fixed cost per service (UAH)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.fixedCost}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateDraft(draft.lineItemId, { fixedCost: e.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  {draft.status === 'known' &&
                  draft.kind === 'service' &&
                  draft.costMethod === 'time_rate' ? (
                    <>
                      <label className="field">
                        <span>Hourly cost (UAH/hr)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.hourlyCost}
                          placeholder="0.00"
                          onChange={(e) =>
                            updateDraft(draft.lineItemId, {
                              hourlyCost: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Recorded minutes</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draft.recordedMinutes}
                          placeholder="0"
                          onChange={(e) =>
                            updateDraft(draft.lineItemId, {
                              recordedMinutes: e.target.value,
                            })
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  {draft.status === 'known' ? (
                    <label className="field">
                      <span>Direct expenses (total line UAH)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.directExpenses}
                        placeholder="0.00"
                        onChange={(e) =>
                          updateDraft(draft.lineItemId, {
                            directExpenses: e.target.value,
                          })
                        }
                      />
                    </label>
                  ) : null}

                  {draft.status === 'known' && draft.kind === 'service' ? (
                    <label className="field">
                      <span>Manual unit cost override (optional)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.unitCost}
                        placeholder="Leave empty to compute from method"
                        onChange={(e) =>
                          updateDraft(draft.lineItemId, { unitCost: e.target.value })
                        }
                      />
                    </label>
                  ) : null}
                </div>

                {draft.auditEntries.length > 0 ? (
                  <div className="cost-audit-history-list">
                    <strong style={{ fontSize: '0.78rem' }}>Audit History</strong>
                    {draft.auditEntries.map((entry) => (
                      <div key={entry.id} className="cost-audit-history-item">
                        <div>
                          {entry.previousStatus} (
                          {entry.previousTotalCost !== null
                            ? formatCurrency(entry.previousTotalCost)
                            : 'N/A'}
                          ) → <strong>{entry.newStatus}</strong> (
                          {entry.newTotalCost !== null
                            ? formatCurrency(entry.newTotalCost)
                            : 'N/A'}
                          )
                        </div>
                        <div className="muted-copy">
                          {entry.authorName} · {formatDateTime(entry.changedAt)} · Reason:{' '}
                          {entry.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
};
