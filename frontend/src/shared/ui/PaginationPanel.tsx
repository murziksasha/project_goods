import { useTranslation } from 'react-i18next';

type PaginationPanelProps = {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const defaultPageSizeOptions = [10, 30, 50, 100, 200];

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

type CompactPaginationPanelProps = Omit<
  PaginationPanelProps,
  'onPageSizeChange' | 'pageSizeOptions'
>;

export const CompactPaginationPanel = ({
  totalItems,
  page,
  pageSize,
  onPageChange,
}: CompactPaginationPanelProps) => {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = clamp(page, 1, pageCount);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < pageCount;

  return (
    <div className='pagination-compact'>
      <button
        type='button'
        className='pagination-compact-button'
        aria-label={t('common.pagination.previousPage')}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
      >
        &lsaquo;
      </button>
      <span className='pagination-compact-page'>{currentPage}</span>
      <button
        type='button'
        className='pagination-compact-button'
        aria-label={t('common.pagination.nextPage')}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
      >
        &rsaquo;
      </button>
    </div>
  );
};

export const PaginationPanel = ({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = defaultPageSizeOptions,
}: PaginationPanelProps) => {
  const { t } = useTranslation();
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
        aria-label={t('common.pagination.rowsPerPage')}
      >
        {pageSizeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className='pagination-total'>
        {t('common.pagination.totalRecords', { count: totalItems })}
      </div>
      <div className='pagination-nav'>
        <button
          type='button'
          className='pagination-nav-button'
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
        >
          {t('common.pagination.prev')}
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
          {t('common.pagination.next')}
        </button>
      </div>
    </div>
  );
};