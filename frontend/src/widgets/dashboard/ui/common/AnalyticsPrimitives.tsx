import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScenarioRecord } from '../../../../entities/scenario';

export interface AnalyticsComparisonBadgeProps {
  deltaPct: number | null | undefined;
  invertColors?: boolean;
  label?: string;
}

export const AnalyticsComparisonBadge: React.FC<AnalyticsComparisonBadgeProps> = ({
  deltaPct,
  invertColors = false,
  label,
}) => {
  const { t } = useTranslation();
  if (deltaPct === null || deltaPct === undefined || !Number.isFinite(deltaPct)) {
    return null;
  }
  const rounded = Math.round(deltaPct * 10) / 10;
  let stateClass = 'is-flat';
  if (rounded > 0) {
    stateClass = invertColors ? 'is-down' : 'is-up';
  } else if (rounded < 0) {
    stateClass = invertColors ? 'is-up' : 'is-down';
  }
  const prefix = rounded > 0 ? '+' : '';
  return (
    <span
      className={`report-delta-badge ${stateClass}`}
      title={label ?? t('analytics.primitives.deltaTitle')}
    >
      {prefix}
      {rounded.toFixed(1)}%
    </span>
  );
};

export interface AnalyticsKpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  deltaPct?: number | null;
  invertDelta?: boolean;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  badge?: ReactNode;
}

export const AnalyticsKpiCard: React.FC<AnalyticsKpiCardProps> = ({
  label,
  value,
  hint,
  deltaPct,
  invertDelta = false,
  tone = 'default',
  badge,
}) => {
  const toneClass = tone !== 'default' ? `is-${tone}` : '';
  return (
    <article className={`report-kpi-card ${toneClass}`.trim()}>
      <div className="report-kpi-label-row">
        <span className="report-kpi-label">{label}</span>
        {badge ?? (
          <AnalyticsComparisonBadge deltaPct={deltaPct} invertColors={invertDelta} />
        )}
      </div>
      <div className="report-kpi-value">{value}</div>
      {hint ? <div className="report-kpi-hint">{hint}</div> : null}
    </article>
  );
};

export interface AnalyticsCoverageBannerProps {
  title?: string;
  warnings: string[];
  tone?: 'warning' | 'info';
}

export const AnalyticsCoverageBanner: React.FC<AnalyticsCoverageBannerProps> = ({
  title,
  warnings,
  tone = 'warning',
}) => {
  const filtered = warnings.filter((w) => w.trim().length > 0);
  if (filtered.length === 0) return null;
  return (
    <div
      className={`report-coverage-banner ${tone === 'info' ? 'is-info' : ''}`.trim()}
      role="status"
    >
      {title ? <strong>{title}</strong> : null}
      <ul>
        {filtered.map((warning, idx) => (
          <li key={`${idx}-${warning.slice(0, 24)}`}>{warning}</li>
        ))}
      </ul>
    </div>
  );
};

export interface AnalyticsSectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const AnalyticsSectionCard: React.FC<AnalyticsSectionCardProps> = ({
  title,
  subtitle,
  actions,
  children,
}) => (
  <section className="report-section-card">
    <div className="report-section-card-head">
      <div>
        <h3>{title}</h3>
        {subtitle ? <p className="report-section-card-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="report-upgrade-actions">{actions}</div> : null}
    </div>
    {children}
  </section>
);

export type InteractiveBarItem = {
  id: string;
  label: string;
  value: number;
  valueText: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'cyan';
};

export interface AnalyticsInteractiveBarsProps {
  items: InteractiveBarItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  emptyText?: string;
}

export const AnalyticsInteractiveBars: React.FC<AnalyticsInteractiveBarsProps> = ({
  items,
  selectedId,
  onSelect,
  emptyText,
}) => {
  const { t } = useTranslation();
  const resolvedEmpty = emptyText ?? t('analytics.primitives.noBreakdown');
  if (items.length === 0) {
    return <div className="report-state-box">{resolvedEmpty}</div>;
  }
  const maxValue = Math.max(...items.map((item) => Math.max(item.value, 0)), 1);

  return (
    <div className="report-bar-list">
      {items.map((item) => {
        const pct = Math.min(Math.max((Math.max(item.value, 0) / maxValue) * 100, 0), 100);
        const isSelected = Boolean(selectedId && selectedId === item.id);
        const fillClass = item.tone && item.tone !== 'primary' ? `is-${item.tone}` : '';
        return (
          <button
            key={item.id}
            type="button"
            className={`report-bar-row-btn ${isSelected ? 'is-selected' : ''}`.trim()}
            data-static={onSelect ? undefined : 'true'}
            aria-pressed={onSelect ? isSelected : undefined}
            onClick={() => onSelect?.(item.id)}
          >
            <div className="report-bar-meta">
              <span className="report-bar-label" title={item.label}>
                {item.label}
              </span>
              <span className="report-bar-value">{item.valueText}</span>
            </div>
            <div className="report-bar-track" aria-hidden="true">
              <div
                className={`report-bar-fill ${fillClass}`.trim()}
                style={{ width: `${item.value > 0 ? Math.max(pct, 3) : 0}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};

export type TrendChartSeriesConfig<T extends { dateKey: string }> = {
  key: string;
  label: string;
  color: string;
  getValue: (point: T) => number;
};

export interface AnalyticsTrendChartProps<T extends { dateKey: string }> {
  points: T[];
  series: TrendChartSeriesConfig<T>[];
  height?: number;
  emptyText?: string;
  formatYValue?: (value: number) => string;
  onSelectDateKey?: (dateKey: string) => void;
}

export const AnalyticsTrendChart = <T extends { dateKey: string }>({
  points,
  series,
  height = 200,
  emptyText,
  formatYValue = (v) => String(Math.round(v * 100) / 100),
  onSelectDateKey,
}: AnalyticsTrendChartProps<T>) => {
  const { t } = useTranslation();
  const resolvedEmpty = emptyText ?? t('analytics.primitives.noTrend');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartStats = useMemo(() => {
    const allValues = points.flatMap((pt) => series.map((s) => s.getValue(pt)));
    const minVal = Math.min(0, ...(allValues.length > 0 ? allValues : [0]));
    const maxVal = Math.max(0, ...(allValues.length > 0 ? allValues : [0]));
    const span = maxVal - minVal || 1;
    return { minVal, maxVal, span };
  }, [points, series]);

  if (points.length === 0) {
    return <div className="report-state-box">{resolvedEmpty}</div>;
  }

  const width = 640;
  const padLeft = 92;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (idx: number) =>
    points.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (points.length - 1)) * plotW;

  const getY = (val: number) =>
    padTop + ((chartStats.maxVal - val) / chartStats.span) * plotH;

  const activeIdx =
    hoveredIdx !== null && hoveredIdx >= 0 && hoveredIdx < points.length
      ? hoveredIdx
      : null;
  const activePoint = activeIdx !== null ? points[activeIdx] : null;
  const labelIndexes =
    points.length <= 2
      ? points.map((_, idx) => idx)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div className="report-trend-chart-wrap">
      <div className="report-trend-legend">
        {series.map((s) => (
          <span key={s.key} className="report-trend-legend-item">
            <span
              className="report-trend-dot"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
        {activePoint ? (
          <span className="report-badge is-info">
            {activePoint.dateKey}:{' '}
            {series
              .map((s) => `${s.label} ${formatYValue(s.getValue(activePoint))}`)
              .join(' | ')}
          </span>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="report-trend-svg"
        role="img"
        aria-label={t('analytics.primitives.trendChartAria')}
      >
        {[0, 0.5, 1].map((fraction) => {
          const val = chartStats.maxVal - fraction * chartStats.span;
          const y = padTop + fraction * plotH;
          return (
            <g key={fraction}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--color-line)"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-muted)"
              >
                {formatYValue(val)}
              </text>
            </g>
          );
        })}

        {series.map((s) => {
          const pathD = points
            .map((pt, idx) => {
              const x = getX(idx);
              const y = getY(s.getValue(pt));
              return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <path
              key={s.key}
              d={pathD}
              fill="none"
              stroke={s.color}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {points.map((pt, idx) => {
          const x = getX(idx);
          const isHovered = activeIdx === idx;
          return (
            <g key={pt.dateKey}>
              {series.map((s) => (
                <circle
                  key={`${s.key}-${pt.dateKey}`}
                  cx={x}
                  cy={getY(s.getValue(pt))}
                  r={isHovered ? 4.5 : points.length <= 35 ? 2.5 : 1.5}
                  fill={s.color}
                />
              ))}
              <rect
                x={x - Math.max(plotW / points.length / 2, 4)}
                y={padTop}
                width={Math.max(plotW / points.length, 8)}
                height={plotH}
                fill="transparent"
                tabIndex={onSelectDateKey ? 0 : undefined}
                style={{ cursor: onSelectDateKey ? 'pointer' : 'default' }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                onClick={() => onSelectDateKey?.(pt.dateKey)}
                onKeyDown={(evt) => {
                  if (onSelectDateKey && (evt.key === 'Enter' || evt.key === ' ')) {
                    evt.preventDefault();
                    onSelectDateKey(pt.dateKey);
                  }
                }}
              />
            </g>
          );
        })}

        {labelIndexes.map((idx) => (
          <text
            key={`x-${idx}-${points[idx]?.dateKey}`}
            x={getX(idx)}
            y={height - 6}
            textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--color-muted)"
          >
            {points[idx]?.dateKey ?? ''}
          </text>
        ))}
      </svg>
    </div>
  );
};

export type SortableColumn<Row> = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  sortValue?: (row: Row) => string | number;
  render: (row: Row) => ReactNode;
};

export interface AnalyticsSortableTableProps<Row> {
  columns: SortableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (nextSortBy: string, nextSortDir: 'asc' | 'desc') => void;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (nextPage: number) => void;
}

export const AnalyticsSortableTable = <Row,>({
  columns,
  rows,
  getRowKey,
  sortBy,
  sortDir = 'desc',
  onSortChange,
  loading = false,
  error = null,
  emptyText,
  page,
  pageSize,
  total,
  onPageChange,
}: AnalyticsSortableTableProps<Row>) => {
  const { t } = useTranslation();
  const resolvedEmpty = emptyText ?? t('analytics.primitives.noMatchingRecords');
  const [localSortBy, setLocalSortBy] = useState<string>('');
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>('desc');

  const activeSortBy = onSortChange ? sortBy ?? '' : localSortBy;
  const activeSortDir = onSortChange ? sortDir : localSortDir;

  const sortedRows = useMemo(() => {
    if (onSortChange || !activeSortBy) return rows;
    const col = columns.find((c) => c.key === activeSortBy);
    if (!col?.sortValue) return rows;
    const factor = activeSortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, onSortChange, activeSortBy, activeSortDir, columns]);

  const handleSortClick = (colKey: string) => {
    const nextDir: 'asc' | 'desc' =
      activeSortBy === colKey && activeSortDir === 'desc' ? 'asc' : 'desc';
    if (onSortChange) {
      onSortChange(colKey, nextDir);
    } else {
      setLocalSortBy(colKey);
      setLocalSortDir(nextDir);
    }
  };

  if (loading) {
    return (
      <div className="report-state-box">
        {t('analytics.primitives.loadingRecords')}
      </div>
    );
  }
  if (error) {
    return (
      <div className="report-state-box is-error" role="alert">
        {error}
      </div>
    );
  }
  if (sortedRows.length === 0) {
    return <div className="report-state-box">{resolvedEmpty}</div>;
  }

  const totalPages =
    total !== undefined && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="report-table-wrap">
        <table className="report-data-table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSorted = activeSortBy === col.key;
                const ariaSort = isSorted
                  ? activeSortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
                return (
                  <th
                    key={col.key}
                    className={col.align === 'right' ? 'report-num' : undefined}
                    aria-sort={col.sortable ? ariaSort : undefined}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        className="report-sort-button"
                        onClick={() => handleSortClick(col.key)}
                      >
                        <span>{col.label}</span>
                        <span aria-hidden="true">
                          {isSorted ? (activeSortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.align === 'right' ? 'report-num' : undefined}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {page !== undefined && pageSize !== undefined && total !== undefined && onPageChange ? (
        <div className="report-pagination-bar">
          <span>
            {t('analytics.primitives.showingRange', {
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, total),
              total,
            })}
          </span>
          <div className="report-pagination-controls">
            <button
              type="button"
              className="secondary-button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {t('analytics.primitives.prev')}
            </button>
            <span>
              {t('analytics.primitives.pageOf', { page, totalPages })}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              {t('analytics.primitives.next')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export interface ScenarioManagerBarProps {
  scenarios: ScenarioRecord[];
  selectedScenarioId: string;
  scenarioName: string;
  onScenarioNameChange: (value: string) => void;
  onSelectScenario: (scenarioId: string) => void;
  onSaveNew: () => void;
  onUpdateSelected: () => void;
  onDeleteSelected: () => void;
  isSaving?: boolean;
  label?: string;
}

export const ScenarioManagerBar: React.FC<ScenarioManagerBarProps> = ({
  scenarios,
  selectedScenarioId,
  scenarioName,
  onScenarioNameChange,
  onSelectScenario,
  onSaveNew,
  onUpdateSelected,
  onDeleteSelected,
  isSaving = false,
  label = 'Private saved scenarios',
}) => (
  <div className="report-scenario-bar">
    <span className="report-estimate-pill">Estimate Scenario</span>
    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
      {label}:
      <select
        style={{ marginLeft: 8 }}
        value={selectedScenarioId}
        onChange={(e) => onSelectScenario(e.target.value)}
        aria-label={label}
      >
        <option value="">-- Current / Ad-hoc --</option>
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.name} ({scenario.horizonDays}d)
          </option>
        ))}
      </select>
    </label>
    <input
      type="text"
      value={scenarioName}
      placeholder="Scenario name..."
      aria-label="Scenario name"
      onChange={(e) => onScenarioNameChange(e.target.value)}
    />
    <button
      type="button"
      className="secondary-button"
      disabled={isSaving || scenarioName.trim().length === 0}
      onClick={onSaveNew}
    >
      Save New
    </button>
    {selectedScenarioId ? (
      <>
        <button
          type="button"
          className="secondary-button"
          disabled={isSaving || scenarioName.trim().length === 0}
          onClick={onUpdateSelected}
        >
          Update Saved
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={isSaving}
          onClick={onDeleteSelected}
        >
          Delete
        </button>
      </>
    ) : null}
  </div>
);
