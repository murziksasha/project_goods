export type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
  label?: string;
};

export const TableSkeleton = ({
  rows = 6,
  columns = 5,
  className = '',
  label = 'Loading',
}: TableSkeletonProps) => (
  <div
    className={`table-skeleton ${className}`.trim()}
    role="status"
    aria-busy="true"
    aria-label={label}
  >
    <div className="table-skeleton-header" aria-hidden="true">
      {Array.from({ length: columns }, (_, columnIndex) => (
        <span
          key={`header-${columnIndex}`}
          className="skeleton-line skeleton-line-section"
        />
      ))}
    </div>
    <div className="table-skeleton-body" aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="table-skeleton-row">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <span
              key={`cell-${rowIndex}-${columnIndex}`}
              className={`skeleton-line ${
                columnIndex === 0
                  ? 'skeleton-line-short'
                  : 'skeleton-line-row'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);
