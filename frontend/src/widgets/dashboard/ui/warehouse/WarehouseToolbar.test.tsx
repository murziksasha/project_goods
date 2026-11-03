import { createRef, useCallback, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import {
  WAREHOUSE_SEARCH_COMMIT_MS,
  WarehouseToolbar,
} from './WarehouseToolbar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderToolbar = (props?: {
  selectedProductCount?: number;
  selectedSerialCount?: number;
  onPrintSelectedSerials?: () => void;
  onClearSelection?: () => void;
  activeTab?: 'stock' | 'receipts';
  query?: string;
}) => {
  const onPrintSelectedSerials = props?.onPrintSelectedSerials ?? vi.fn();
  const onClearSelection = props?.onClearSelection ?? vi.fn();
  const setQuery = vi.fn();
  const setSearchMode = vi.fn();
  const setCurrentPage = vi.fn();

  const view = render(
    <WarehouseToolbar
      activeTab={props?.activeTab ?? 'stock'}
      stockSummaryText='2 stock rows'
      selectedProductCount={props?.selectedProductCount ?? 0}
      selectedSerialCount={props?.selectedSerialCount ?? 0}
      activeColumnsTab='stock'
      columnsMenuRef={createRef<HTMLDivElement>()}
      isColumnsMenuOpen={false}
      visibleColumnKeySet={new Set(['select', 'name', 'serial'])}
      activeFilterCount={0}
      favoritesOnly={false}
      query={props?.query ?? ''}
      searchMode='serial'
      searchPlaceholder='Search by serial number'
      stockView='models'
      receiptsView='orders'
      appliedReceiptStatuses={[]}
      showReceiptStatusChips={props?.activeTab === 'receipts'}
      onPrintSelectedSerials={onPrintSelectedSerials}
      onClearSelection={onClearSelection}
      onToggleColumnsMenu={vi.fn()}
      onToggleColumnVisibility={vi.fn()}
      onToggleFilters={vi.fn()}
      onToggleFavoritesOnly={vi.fn()}
      onStockViewChange={vi.fn()}
      onReceiptsViewChange={vi.fn()}
      onReceiptStatusChip={vi.fn()}
      setQuery={setQuery}
      setSearchMode={setSearchMode}
      setCurrentPage={setCurrentPage}
    />,
  );

  return {
    ...view,
    onPrintSelectedSerials,
    onClearSelection,
    setQuery,
    setSearchMode,
    setCurrentPage,
  };
};

const searchInput = () =>
  screen.getByPlaceholderText('Search by serial number');

describe('WarehouseToolbar serial printing', () => {
  it('enables selected serial printing when selected rows have serial numbers', () => {
    const onPrintSelectedSerials = vi.fn();
    renderToolbar({
      selectedProductCount: 2,
      selectedSerialCount: 1,
      onPrintSelectedSerials,
    });

    const printButton = screen.getByRole('button', {
      name: 'Print selected serial numbers',
    });

    expect(printButton).toBeEnabled();
    expect(screen.getByRole('button', { name: '2 selected' })).toBeInTheDocument();

    fireEvent.click(printButton);

    expect(onPrintSelectedSerials).toHaveBeenCalledTimes(1);
  });

  it('keeps selected serial printing disabled without serial numbers', () => {
    const onPrintSelectedSerials = vi.fn();
    renderToolbar({
      selectedProductCount: 2,
      selectedSerialCount: 0,
      onPrintSelectedSerials,
    });

    const printButton = screen.getByRole('button', {
      name: 'Print selected serial numbers',
    });

    expect(printButton).toBeDisabled();

    fireEvent.click(printButton);

    expect(onPrintSelectedSerials).not.toHaveBeenCalled();
  });

  it('hides print until rows are selected', () => {
    renderToolbar();

    expect(
      screen.queryByRole('button', { name: 'Print selected serial numbers' }),
    ).not.toBeInTheDocument();
  });

  it('renders translated warehouse toolbar labels', () => {
    renderToolbar();

    expect(
      screen.getByRole('button', { name: 'Filter' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Search by' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'By name' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search by serial number'),
    ).toBeInTheDocument();
  });

  it('updates warehouse toolbar labels when language changes', async () => {
    renderToolbar();

    await i18n.changeLanguage('uk');

    expect(
      screen.getByRole('button', { name: 'Фільтр' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'За назвою' }),
    ).toBeInTheDocument();

    await i18n.changeLanguage('en');
  });

  it('clears selected stock rows from the toolbar counter', () => {
    const onClearSelection = vi.fn();
    renderToolbar({
      selectedProductCount: 2,
      selectedSerialCount: 1,
      onClearSelection,
    });

    fireEvent.click(screen.getByRole('button', { name: '2 selected' }));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('hides search modes on receipts and shows status chips', () => {
    renderToolbar({ activeTab: 'receipts' });

    expect(
      screen.queryByRole('combobox', { name: 'Search by' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Partially stocked' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Taken on charge' }),
    ).toBeInTheDocument();
  });
});

describe('WarehouseToolbar search commit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits the final text once after the idle delay and opens page 1', () => {
    vi.useFakeTimers();
    const { setQuery, setCurrentPage } = renderToolbar();

    fireEvent.change(searchInput(), { target: { value: 'a' } });
    fireEvent.change(searchInput(), { target: { value: 'ab' } });
    fireEvent.change(searchInput(), { target: { value: 'abc' } });

    expect(setQuery).not.toHaveBeenCalled();
    expect(searchInput()).toHaveValue('abc');

    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS - 1);
    expect(setQuery).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith('abc');
    expect(setCurrentPage).toHaveBeenCalledTimes(1);
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('does not reset the page when the draft returns to the committed text', () => {
    vi.useFakeTimers();
    const { setQuery, setCurrentPage } = renderToolbar({ query: 'ab' });

    fireEvent.change(searchInput(), { target: { value: 'abx' } });
    fireEvent.change(searchInput(), { target: { value: 'ab' } });
    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS);

    expect(setQuery).not.toHaveBeenCalled();
    expect(setCurrentPage).not.toHaveBeenCalled();
  });

  it('commits immediately on Enter and still opens page 1 when the text is unchanged', () => {
    vi.useFakeTimers();
    const { setQuery, setCurrentPage } = renderToolbar({
      query: 'S000102',
    });

    fireEvent.keyDown(searchInput(), { key: 'Enter' });

    expect(setQuery).not.toHaveBeenCalled();
    expect(setCurrentPage).toHaveBeenCalledTimes(1);
    expect(setCurrentPage).toHaveBeenCalledWith(1);

    fireEvent.change(searchInput(), { target: { value: 'S000103' } });
    fireEvent.keyDown(searchInput(), { key: 'Enter' });

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith('S000103');
    expect(setCurrentPage).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS);
    expect(setQuery).toHaveBeenCalledTimes(1);
  });

  it('clears the draft and the committed query immediately', () => {
    vi.useFakeTimers();
    const { setQuery, setCurrentPage } = renderToolbar({ query: 'cord' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(searchInput()).toHaveValue('');
    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith('');
    expect(setCurrentPage).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS);
    expect(setQuery).toHaveBeenCalledTimes(1);
  });

  it('commits a pending draft when the search mode changes', () => {
    vi.useFakeTimers();
    const { setQuery, setSearchMode, setCurrentPage } = renderToolbar();

    fireEvent.change(searchInput(), { target: { value: 'cord' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Search by' }), {
      target: { value: 'name' },
    });

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith('cord');
    expect(setSearchMode).toHaveBeenCalledWith('name');
    expect(setCurrentPage).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS);
    expect(setQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps a character typed after a commit when the old text echoes back', () => {
    vi.useFakeTimers();
    const setQuery = vi.fn();
    const setCurrentPage = vi.fn();

    const EchoHarness = () => {
      const [query, setQueryState] = useState('');
      const pendingRef = useRef<string | null>(null);
      const accept = useCallback((value: SetStateAction<string>) => {
        const next =
          typeof value === 'function' ? value(query) : value;
        setQuery(next);
        pendingRef.current = next;
      }, [query]);

      return (
        <>
          <button
            type='button'
            onClick={() => {
              if (pendingRef.current === null) return;
              setQueryState(pendingRef.current);
              pendingRef.current = null;
            }}
          >
            Apply echoed query
          </button>
          <WarehouseToolbar
            activeTab='stock'
            stockSummaryText='2 stock rows'
            selectedProductCount={0}
            selectedSerialCount={0}
            activeColumnsTab='stock'
            columnsMenuRef={createRef<HTMLDivElement>()}
            isColumnsMenuOpen={false}
            visibleColumnKeySet={new Set(['select', 'name'])}
            activeFilterCount={0}
            favoritesOnly={false}
            query={query}
            searchMode='serial'
            searchPlaceholder='Search by serial number'
            stockView='models'
            receiptsView='orders'
            appliedReceiptStatuses={[]}
            showReceiptStatusChips={false}
            onPrintSelectedSerials={vi.fn()}
            onClearSelection={vi.fn()}
            onToggleColumnsMenu={vi.fn()}
            onToggleColumnVisibility={vi.fn()}
            onToggleFilters={vi.fn()}
            onToggleFavoritesOnly={vi.fn()}
            onStockViewChange={vi.fn()}
            onReceiptsViewChange={vi.fn()}
            onReceiptStatusChip={vi.fn()}
            setQuery={accept}
            setSearchMode={vi.fn()}
            setCurrentPage={setCurrentPage}
          />
        </>
      );
    };

    render(<EchoHarness />);

    fireEvent.change(searchInput(), { target: { value: 'ab' } });
    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS);
    expect(setQuery).toHaveBeenCalledWith('ab');

    fireEvent.change(searchInput(), { target: { value: 'abc' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply echoed query' }),
    );

    expect(searchInput()).toHaveValue('abc');

    vi.advanceTimersByTime(WAREHOUSE_SEARCH_COMMIT_MS);
    expect(setQuery).toHaveBeenCalledTimes(2);
    expect(setQuery).toHaveBeenLastCalledWith('abc');
  });

  it('commits a pending draft when the toolbar unmounts', () => {
    vi.useFakeTimers();
    const { setQuery, setCurrentPage, unmount } = renderToolbar();

    fireEvent.change(searchInput(), { target: { value: 'cord' } });
    expect(setQuery).not.toHaveBeenCalled();

    unmount();

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith('cord');
    expect(setCurrentPage).toHaveBeenCalledWith(1);
  });
});
