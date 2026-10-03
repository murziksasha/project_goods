import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  profitReportChartMetricOptions,
  type ProfitReportVisualSettings,
} from '../../model/profit-report';

export interface AccountingProfitVisualSettingsProps {
  settings: ProfitReportVisualSettings;
  onChange: (settings: ProfitReportVisualSettings) => void;
};

export const AccountingProfitVisualSettings: React.FC<AccountingProfitVisualSettingsProps> = ({
  settings,
  onChange,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className='finance-profit-visual-panel'
      role='group'
      aria-label={t('accounting.profit.visual.aria')}
    >
      <label className='finance-profit-visual-check'>
        <input
          type='checkbox'
          checked={settings.showCharts}
          onChange={(event) =>
            onChange({ ...settings, showCharts: event.target.checked })
          }
        />
        {t('accounting.profit.visual.showCharts')}
      </label>
      <label className='orders-filter-field'>
        <span>{t('accounting.profit.visual.chartMetric')}</span>
        <select
          value={settings.chartMetric}
          onChange={(event) =>
            onChange({
              ...settings,
              chartMetric: event.target
                .value as ProfitReportVisualSettings['chartMetric'],
            })
          }
        >
          {profitReportChartMetricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <label className='finance-profit-visual-check'>
        <input
          type='checkbox'
          checked={settings.highlightLosses}
          onChange={(event) =>
            onChange({
              ...settings,
              highlightLosses: event.target.checked,
            })
          }
        />
        {t('accounting.profit.visual.highlightLosses')}
      </label>
      <label className='finance-profit-visual-check'>
        <input
          type='checkbox'
          checked={settings.compactTable}
          onChange={(event) =>
            onChange({ ...settings, compactTable: event.target.checked })
          }
        />
        {t('accounting.profit.visual.compactTable')}
      </label>
    </div>
  );
};
