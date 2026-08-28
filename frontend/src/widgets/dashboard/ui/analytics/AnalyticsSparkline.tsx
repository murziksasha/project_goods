type AnalyticsSparklineProps = {
  values: number[];
  color?: string;
};

export const AnalyticsSparkline = ({
  values,
  color = 'var(--color-primary)',
}: AnalyticsSparklineProps) => {
  const width = 88;
  const height = 28;
  const maxValue = Math.max(1, ...values);
  if (values.length === 0) {
    return <svg className="analytics-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden />;
  }
  const path = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / maxValue) * (height - 2) - 1;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <svg className="analytics-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
