import { useTranslation } from 'react-i18next';
import type { AnalyticsDateRange } from '../model/analytics-date-range';

type AnalyticsDateFilterPanelProps = {
  draftRange: AnalyticsDateRange;
  isOpen: boolean;
  onDraftRangeChange: (range: AnalyticsDateRange) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
};

export const AnalyticsDateFilterPanel = ({
  draftRange,
  isOpen,
  onDraftRangeChange,
  onApply,
  onClear,
  onClose,
}: AnalyticsDateFilterPanelProps) => {
  const { t } = useTranslation();

  return (
    <section
      className={
        isOpen ? 'orders-filter-panel orders-filter-panel-open' : 'orders-filter-panel'
      }
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="orders-filter-panel-close"
        aria-label={t('analytics.dateFilter.closeAriaLabel')}
        onClick={onClose}
      >
        &times;
      </button>
      <div className="orders-filter-grid">
        <label className="orders-filter-field">
          <span>{t('analytics.dateFilter.dateFrom')}</span>
          <input
            type="date"
            value={draftRange.dateFrom}
            onChange={(event) =>
              onDraftRangeChange({
                ...draftRange,
                dateFrom: event.target.value,
              })
            }
          />
        </label>
        <label className="orders-filter-field">
          <span>{t('analytics.dateFilter.dateTo')}</span>
          <input
            type="date"
            value={draftRange.dateTo}
            onChange={(event) =>
              onDraftRangeChange({
                ...draftRange,
                dateTo: event.target.value,
              })
            }
          />
        </label>
      </div>
      <div className="orders-filter-actions">
        <button
          type="button"
          className="toolbar-filter-button orders-filter-apply"
          onClick={onApply}
        >
          {t('analytics.dateFilter.apply')}
        </button>
        <button type="button" className="toolbar-filter-button" onClick={onClear}>
          {t('analytics.dateFilter.clear')}
        </button>
      </div>
    </section>
  );
};