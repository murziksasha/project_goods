type PaginationPanelProps = {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

const defaultPageSizeOptions = [10, 30, 50, 100];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getVisiblePages = (currentPage: number, pageCount: number) => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount]);
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(pageCount - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    pages.add(page);
  }

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (currentPage >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
  }

  return Array.from(pages).sort((a, b) => a - b);
};

export const PaginationPanel = ({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = defaultPageSizeOptions,
}: PaginationPanelProps) => {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = clamp(page, 1, pageCount);
  const pages = getVisiblePages(currentPage, pageCount);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < pageCount;

  return (
    <div className='pagination-panel'>
      <select
        className='pagination-size-select'
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
        aria-label='Rows per page'
      >
        {pageSizeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className='pagination-total'>{`Total: ${totalItems} records`}</div>
      <div className='pagination-nav'>
        <button
          type='button'
          className='pagination-nav-button'
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
        >
          {'< Prev'}
        </button>
        {pages.map((pageNumber, index) => {
          const previous = pages[index - 1];
          const needsDots = previous && pageNumber - previous > 1;

          return (
            <span key={pageNumber} className='pagination-pages-group'>
              {needsDots ? (
                <span className='pagination-dots' aria-hidden='true'>
                  ...
                </span>
              ) : null}
              <button
                type='button'
                className={
                  pageNumber === currentPage
                    ? 'pagination-page-button pagination-page-button-active'
                    : 'pagination-page-button'
                }
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            </span>
          );
        })}
        <button
          type='button'
          className='pagination-nav-button'
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
        >
          {'Next >'}
        </button>
      </div>
    </div>
  );
};
