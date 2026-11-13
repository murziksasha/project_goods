import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useFinancePolicyHistoryQuery,
  useFinancePolicyQuery,
  usePreviewFinancePolicyMutation,
  useUpdateFinancePolicyMutation,
  type FinancePolicy,
  type FinancePolicyHistoryItem,
  type FinancePolicyReportDefaults,
  type ProfitReportPeriod,
  type ServiceProfitMode,
} from '../../../../entities/finance';
import { ApiRequestError } from '../../../../shared/api/http';
import { formatDateTime } from '../../../../shared/lib/format';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import { formatMoney } from '../../model/accounting';
import {
  formatProfitMarginPct,
  profitReportPeriodOptions,
  profitReportSourceOptions,
} from '../../model/profit-report';

export interface AccountingPolicySettingsProps {
  canManagePolicy: boolean;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

const SERVICE_PROFIT_MODES: ServiceProfitMode[] = [
  'full',
  'revenue_only',
  'exclude',
];

const formatFieldValue = (
  field: string,
  snapshot: FinancePolicyHistoryItem['next'],
  t: ReturnType<typeof useTranslation>['t'],
): string => {
  switch (field) {
    case 'serviceAuditEnabled':
      return snapshot.serviceAuditEnabled
        ? t('accounting.policy.values.enabled')
        : t('accounting.policy.values.disabled');
    case 'serviceProfitMode':
      return t(`accounting.policy.modes.${snapshot.serviceProfitMode}.label`);
    case 'reportDefaults.period':
      return t(`accounting.profit.periods.${snapshot.reportDefaults.period}`);
    case 'reportDefaults.source':
      return t(`accounting.profit.sources.${snapshot.reportDefaults.source}`);
    case 'reportDefaults.showCharts':
      return snapshot.reportDefaults.showCharts
        ? t('accounting.policy.values.shown')
        : t('accounting.policy.values.hidden');
    case 'reportDefaults.showTable':
      return snapshot.reportDefaults.showTable
        ? t('accounting.policy.values.shown')
        : t('accounting.policy.values.hidden');
    default:
      return '';
  }
};

export const AccountingPolicySettings: React.FC<AccountingPolicySettingsProps> = ({
  canManagePolicy,
  onError,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const policyQuery = useFinancePolicyQuery();
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const historyQuery = useFinancePolicyHistoryQuery({
    page: historyPage,
    pageSize: historyPageSize,
  });
  const updatePolicyMutation = useUpdateFinancePolicyMutation();
  const previewMutation = usePreviewFinancePolicyMutation();
  const previewMutateRef = useRef(previewMutation.mutate);

  useEffect(() => {
    previewMutateRef.current = previewMutation.mutate;
  }, [previewMutation.mutate]);

  const policy = policyQuery.data;

  const [serviceAuditEnabled, setServiceAuditEnabled] = useState(false);
  const [serviceProfitMode, setServiceProfitMode] =
    useState<ServiceProfitMode>('full');
  const [reportDefaults, setReportDefaults] =
    useState<FinancePolicyReportDefaults>({
      period: 'last30',
      source: 'all',
      showCharts: true,
      showTable: true,
    });
  const [reason, setReason] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [previewPeriod, setPreviewPeriod] =
    useState<ProfitReportPeriod>('last30');
  const [previewDateFrom, setPreviewDateFrom] = useState('');
  const [previewDateTo, setPreviewDateTo] = useState('');

  const lastSyncedVersionRef = useRef<number | null>(null);

  const syncDraftFromPolicy = (sourcePolicy: FinancePolicy) => {
    setServiceAuditEnabled(sourcePolicy.serviceAuditEnabled);
    setServiceProfitMode(sourcePolicy.serviceProfitMode);
    setReportDefaults({ ...sourcePolicy.reportDefaults });
    setPreviewPeriod(sourcePolicy.reportDefaults.period);
    setConflictError(null);
  };

  useEffect(() => {
    if (!policy) return;
    if (lastSyncedVersionRef.current !== policy.version) {
      lastSyncedVersionRef.current = policy.version;
      syncDraftFromPolicy(policy);
    }
  }, [policy]);

  useEffect(() => {
    if (!policy) return;
    previewMutateRef.current({
      serviceProfitMode,
      period: previewDateFrom || previewDateTo ? undefined : previewPeriod,
      dateFrom: previewDateFrom || undefined,
      dateTo: previewDateTo || undefined,
      source: 'all',
    });
  }, [
    policy,
    serviceProfitMode,
    previewPeriod,
    previewDateFrom,
    previewDateTo,
  ]);

  const isDirty = useMemo(() => {
    if (!policy) return false;
    return (
      serviceAuditEnabled !== policy.serviceAuditEnabled ||
      serviceProfitMode !== policy.serviceProfitMode ||
      reportDefaults.period !== policy.reportDefaults.period ||
      reportDefaults.source !== policy.reportDefaults.source ||
      reportDefaults.showCharts !== policy.reportDefaults.showCharts ||
      reportDefaults.showTable !== policy.reportDefaults.showTable
    );
  }, [policy, reportDefaults, serviceAuditEnabled, serviceProfitMode]);

  const handleModeChange = (nextMode: ServiceProfitMode) => {
    setConflictError(null);
    setServiceProfitMode(nextMode);
    if (nextMode === 'exclude' && reportDefaults.source === 'services') {
      setReportDefaults((current) => ({ ...current, source: 'all' }));
    }
  };

  const handleReloadLatest = async () => {
    setConflictError(null);
    const [policyResult] = await Promise.all([
      policyQuery.refetch(),
      historyQuery.refetch(),
    ]);
    if (policyResult.data) {
      lastSyncedVersionRef.current = policyResult.data.version;
      syncDraftFromPolicy(policyResult.data);
    }
  };

  const handleSave = async () => {
    if (!policy || !canManagePolicy || !isDirty) return;
    setConflictError(null);
    try {
      const updated = await updatePolicyMutation.mutateAsync({
        version: policy.version,
        serviceAuditEnabled,
        serviceProfitMode,
        reportDefaults,
        reason: reason.trim() || undefined,
      });
      lastSyncedVersionRef.current = updated.version;
      syncDraftFromPolicy(updated);
      setReason('');
      setHistoryPage(1);
      onSuccess?.(t('accounting.policy.messages.saved'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('accounting.policy.messages.saveError');
      if (error instanceof ApiRequestError && error.status === 409) {
        setConflictError(t('accounting.policy.messages.versionConflict'));
      }
      onError?.(message);
    }
  };

  const preview = previewMutation.data;
  const isModeChanged =
    Boolean(policy) && serviceProfitMode !== policy?.serviceProfitMode;
  const isDisabled = !canManagePolicy || updatePolicyMutation.isPending;

  if (policyQuery.isLoading && !policy) {
    return (
      <div className='finance-settings-body'>
        <p className='empty-state'>{t('accounting.policy.loading')}</p>
      </div>
    );
  }

  return (
    <div className='finance-settings-body finance-policy-settings'>
      {!canManagePolicy ? (
        <div className='report-coverage-banner is-info' role='status'>
          {t('accounting.policy.readOnlyNotice')}
        </div>
      ) : null}

      {conflictError ? (
        <div className='report-state-box is-error finance-policy-conflict' role='alert'>
          <span>{conflictError}</span>
          <button
            type='button'
            className='secondary-button'
            onClick={() => void handleReloadLatest()}
          >
            {t('accounting.policy.reloadLatest')}
          </button>
        </div>
      ) : null}

      <section className='finance-settings-card finance-policy-section'>
        <div className='finance-policy-section-header'>
          <div>
            <h3>{t('accounting.policy.auditSection.title')}</h3>
            <p className='section-label'>
              {t('accounting.policy.auditSection.description')}
            </p>
          </div>
          {policy ? (
            <span className='warehouse-data-badge warehouse-data-badge-location'>
              {t('accounting.policy.versionBadge', { version: policy.version })}
            </span>
          ) : null}
        </div>
        <label className='field-inline finance-policy-toggle'>
          <input
            type='checkbox'
            checked={serviceAuditEnabled}
            disabled={isDisabled}
            onChange={(event) => {
              setConflictError(null);
              setServiceAuditEnabled(event.target.checked);
            }}
          />
          <span>{t('accounting.policy.auditSection.toggleLabel')}</span>
        </label>
        <p className='muted-copy finance-policy-hint'>
          {t('accounting.policy.auditSection.hint')}
        </p>
      </section>

      <section className='finance-settings-card finance-policy-section'>
        <h3>{t('accounting.policy.modeSection.title')}</h3>
        <p className='section-label'>
          {t('accounting.policy.modeSection.description')}
        </p>
        <div
          className='finance-policy-mode-grid'
          role='radiogroup'
          aria-label={t('accounting.policy.modeSection.title')}
        >
          {SERVICE_PROFIT_MODES.map((mode) => {
            const active = serviceProfitMode === mode;
            return (
              <label
                key={mode}
                className={
                  active
                    ? 'finance-policy-mode-card is-selected'
                    : 'finance-policy-mode-card'
                }
              >
                <div className='finance-policy-mode-card-head'>
                  <input
                    type='radio'
                    name='serviceProfitMode'
                    value={mode}
                    checked={active}
                    disabled={isDisabled}
                    onChange={() => handleModeChange(mode)}
                  />
                  <strong>{t(`accounting.policy.modes.${mode}.label`)}</strong>
                </div>
                <p className='muted-copy'>
                  {t(`accounting.policy.modes.${mode}.description`)}
                </p>
              </label>
            );
          })}
        </div>
        <p className='muted-copy finance-policy-hint'>
          {t('accounting.policy.modeSection.cashAndProductsNote')}
        </p>
      </section>

      <section className='finance-settings-card finance-policy-section'>
        <div className='finance-policy-section-header'>
          <div>
            <h3>{t('accounting.policy.previewSection.title')}</h3>
            <p className='section-label'>
              {isModeChanged
                ? t('accounting.policy.previewSection.pendingChangeHint')
                : t('accounting.policy.previewSection.description')}
            </p>
          </div>
          <div className='finance-policy-preview-controls'>
            <label className='orders-filter-field'>
              <span>{t('accounting.policy.previewSection.periodLabel')}</span>
              <select
                value={previewPeriod}
                onChange={(event) => {
                  setPreviewPeriod(event.target.value as ProfitReportPeriod);
                  setPreviewDateFrom('');
                  setPreviewDateTo('');
                }}
              >
                {profitReportPeriodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className='orders-filter-field'>
              <span>{t('accounting.policy.previewSection.dateFrom')}</span>
              <input
                type='date'
                value={previewDateFrom}
                onChange={(event) => setPreviewDateFrom(event.target.value)}
              />
            </label>
            <label className='orders-filter-field'>
              <span>{t('accounting.policy.previewSection.dateTo')}</span>
              <input
                type='date'
                value={previewDateTo}
                onChange={(event) => setPreviewDateTo(event.target.value)}
              />
            </label>
          </div>
        </div>

        {previewMutation.isPending && !preview ? (
          <p className='muted-copy'>{t('accounting.policy.previewSection.loading')}</p>
        ) : previewMutation.isError ? (
          <div className='report-state-box is-error' role='alert'>
            {previewMutation.error instanceof Error
              ? previewMutation.error.message
              : t('accounting.policy.previewSection.error')}
          </div>
        ) : preview ? (
          <div className='finance-table-wrap'>
            <table className='data-table finance-policy-preview-table table-card-stack'>
              <thead>
                <tr>
                  <th>{t('accounting.policy.previewSection.metric')}</th>
                  <th>
                    {t('accounting.policy.previewSection.current', {
                      mode: t(
                        `accounting.policy.modes.${preview.current.serviceProfitMode}.label`,
                      ),
                    })}
                  </th>
                  <th>
                    {t('accounting.policy.previewSection.proposed', {
                      mode: t(
                        `accounting.policy.modes.${preview.proposed.serviceProfitMode}.label`,
                      ),
                    })}
                  </th>
                  <th>{t('accounting.policy.previewSection.delta')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label={t('accounting.policy.previewSection.metric')}>
                    {t('accounting.profit.kpis.revenue')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.currentLabel')}>
                    {formatMoney(preview.current.margin.revenue, 'UAH')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.proposedLabel')}>
                    {formatMoney(preview.proposed.margin.revenue, 'UAH')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.delta')}>
                    {formatMoney(preview.delta.revenue, 'UAH')}
                  </td>
                </tr>
                <tr>
                  <td data-label={t('accounting.policy.previewSection.metric')}>
                    {t('accounting.profit.kpis.cogs')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.currentLabel')}>
                    {formatMoney(preview.current.margin.cogs, 'UAH')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.proposedLabel')}>
                    {formatMoney(preview.proposed.margin.cogs, 'UAH')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.delta')}>
                    {formatMoney(preview.delta.cogs, 'UAH')}
                  </td>
                </tr>
                <tr>
                  <td data-label={t('accounting.policy.previewSection.metric')}>
                    {t('accounting.profit.kpis.grossProfit')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.currentLabel')}>
                    {preview.current.margin.isIncomplete
                      ? t('accounting.policy.previewSection.incompleteValue', {
                          amount: formatMoney(
                            preview.current.margin.knownCostGrossProfit ?? 0,
                            'UAH',
                          ),
                        })
                      : formatMoney(
                          preview.current.margin.grossProfit ?? 0,
                          'UAH',
                        )}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.proposedLabel')}>
                    {preview.proposed.margin.isIncomplete
                      ? t('accounting.policy.previewSection.incompleteValue', {
                          amount: formatMoney(
                            preview.proposed.margin.knownCostGrossProfit ?? 0,
                            'UAH',
                          ),
                        })
                      : formatMoney(
                          preview.proposed.margin.grossProfit ?? 0,
                          'UAH',
                        )}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.delta')}>
                    {preview.delta.grossProfit !== null
                      ? formatMoney(preview.delta.grossProfit, 'UAH')
                      : formatMoney(preview.delta.knownCostGrossProfit, 'UAH')}
                  </td>
                </tr>
                <tr>
                  <td data-label={t('accounting.policy.previewSection.metric')}>
                    {t('accounting.profit.kpis.grossMargin')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.currentLabel')}>
                    {preview.current.margin.isIncomplete
                      ? t('accounting.policy.previewSection.incompleteShort')
                      : formatProfitMarginPct(
                          preview.current.margin.grossMarginPct,
                        )}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.proposedLabel')}>
                    {preview.proposed.margin.isIncomplete
                      ? t('accounting.policy.previewSection.incompleteShort')
                      : formatProfitMarginPct(
                          preview.proposed.margin.grossMarginPct,
                        )}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.delta')}>—</td>
                </tr>
                <tr>
                  <td data-label={t('accounting.policy.previewSection.metric')}>
                    {t('accounting.profit.kpis.netCash')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.currentLabel')}>
                    {formatMoney(preview.current.cash.net, 'UAH')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.proposedLabel')}>
                    {formatMoney(preview.proposed.cash.net, 'UAH')}
                  </td>
                  <td data-label={t('accounting.policy.previewSection.delta')}>
                    {t('accounting.policy.previewSection.unchanged')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className='finance-settings-card finance-policy-section'>
        <h3>{t('accounting.policy.defaultsSection.title')}</h3>
        <p className='section-label'>
          {t('accounting.policy.defaultsSection.description')}
        </p>
        <div className='form-grid finance-policy-defaults-grid'>
          <label className='field'>
            <span>{t('accounting.policy.defaultsSection.period')}</span>
            <select
              value={reportDefaults.period}
              disabled={isDisabled}
              onChange={(event) => {
                setConflictError(null);
                setReportDefaults((current) => ({
                  ...current,
                  period: event.target.value as ProfitReportPeriod,
                }));
              }}
            >
              {profitReportPeriodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div className='field'>
            <label className='field'>
              <span>{t('accounting.policy.defaultsSection.source')}</span>
              <select
                value={reportDefaults.source}
                disabled={isDisabled}
                onChange={(event) => {
                  setConflictError(null);
                  setReportDefaults((current) => ({
                    ...current,
                    source: event.target.value as FinancePolicyReportDefaults['source'],
                  }));
                }}
              >
                {profitReportSourceOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={
                      serviceProfitMode === 'exclude' &&
                      option.value === 'services'
                    }
                  >
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            {serviceProfitMode === 'exclude' ? (
              <span className='muted-copy'>
                {t('accounting.policy.defaultsSection.servicesExcludedHint')}
              </span>
            ) : null}
          </div>
        </div>
        <div className='finance-policy-defaults-toggles'>
          <label className='field-inline'>
            <input
              type='checkbox'
              checked={reportDefaults.showCharts}
              disabled={isDisabled}
              onChange={(event) => {
                setConflictError(null);
                setReportDefaults((current) => ({
                  ...current,
                  showCharts: event.target.checked,
                }));
              }}
            />
            <span>{t('accounting.policy.defaultsSection.showCharts')}</span>
          </label>
          <label className='field-inline'>
            <input
              type='checkbox'
              checked={reportDefaults.showTable}
              disabled={isDisabled}
              onChange={(event) => {
                setConflictError(null);
                setReportDefaults((current) => ({
                  ...current,
                  showTable: event.target.checked,
                }));
              }}
            />
            <span>{t('accounting.policy.defaultsSection.showTable')}</span>
          </label>
        </div>

        <div className='finance-policy-save-bar'>
          <label className='field finance-policy-reason-field'>
            <span>{t('accounting.policy.reasonLabel')}</span>
            <input
              type='text'
              maxLength={300}
              value={reason}
              disabled={isDisabled}
              placeholder={t('accounting.policy.reasonPlaceholder')}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type='button'
            className='primary-button'
            disabled={!canManagePolicy || !isDirty || updatePolicyMutation.isPending}
            onClick={() => void handleSave()}
          >
            {updatePolicyMutation.isPending
              ? t('accounting.policy.saving')
              : t('accounting.policy.save')}
          </button>
        </div>
      </section>

      <section className='finance-settings-card finance-policy-section'>
        <h3>{t('accounting.policy.historySection.title')}</h3>
        <p className='section-label'>
          {t('accounting.policy.historySection.description')}
        </p>
        {historyQuery.isLoading ? (
          <p className='muted-copy'>{t('accounting.policy.historySection.loading')}</p>
        ) : (historyQuery.data?.items.length ?? 0) === 0 ? (
          <p className='empty-state'>{t('accounting.policy.historySection.empty')}</p>
        ) : (
          <>
            <div className='finance-policy-history-list'>
              {historyQuery.data?.items.map((item) => (
                <article key={item.id} className='finance-policy-history-item'>
                  <div className='finance-policy-history-meta'>
                    <span className='warehouse-data-badge warehouse-data-badge-location'>
                      v{item.previousVersion} → v{item.version}
                    </span>
                    <strong>{item.authorName}</strong>
                    <span className='muted-copy'>
                      {formatDateTime(item.changedAt)}
                    </span>
                  </div>
                  <ul className='finance-policy-history-changes'>
                    {item.changedFields.map((field) => (
                      <li key={field}>
                        <span>{t(`accounting.policy.fields.${field}`)}: </span>
                        <span>
                          {formatFieldValue(field, item.previous, t)} →{' '}
                          <strong>{formatFieldValue(field, item.next, t)}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {item.reason ? (
                    <p className='muted-copy finance-policy-history-reason'>
                      {t('accounting.policy.historySection.reasonPrefix', {
                        reason: item.reason,
                      })}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            {(historyQuery.data?.total ?? 0) > (historyQuery.data?.pageSize ?? historyPageSize) ? (
              <PaginationPanel
                totalItems={historyQuery.data?.total ?? 0}
                page={historyQuery.data?.page ?? historyPage}
                pageSize={historyQuery.data?.pageSize ?? historyPageSize}
                onPageChange={setHistoryPage}
                onPageSizeChange={(nextSize) => {
                  setHistoryPageSize(nextSize);
                  setHistoryPage(1);
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
};
