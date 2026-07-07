import { useTranslation } from 'react-i18next';
import { statsPeriodOptions, type StatsPeriod } from '../../model/stats-period';

type StatsPeriodToggleProps = {
  statsPeriod: StatsPeriod;
  hasCustomDateRange: boolean;
  onChange: (value: StatsPeriod) => void;
  ariaLabel?: string;
};

export const StatsPeriodToggle = ({
  statsPeriod,
  hasCustomDateRange,
  onChange,
  ariaLabel,
}: StatsPeriodToggleProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="period-toggle"
      role="tablist"
      aria-label={ariaLabel ?? t('analytics.statisticsPeriod')}
    >
      {statsPeriodOptions.map((option) => (
        <button
          key={option.value}
          className={
            option.value === statsPeriod && !hasCustomDateRange
              ? 'period-button period-button-active'
              : 'period-button'
          }
          type="button"
          onClick={() => onChange(option.value)}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
};