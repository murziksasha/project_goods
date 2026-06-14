import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WarehouseToolbar } from './WarehouseToolbar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderToolbar = (props?: {
  selectedProductCount?: number;
  selectedSerialCount?: number;
  onPrintSelectedSerials?: () => void;
  onClearSelection?: () => void;
}) => {
  const onPrintSelectedSerials = props?.onPrintSelectedSerials ?? vi.fn();
  const onClearSelection = props?.onClearSelection ?? vi.fn();

  render(
    <WarehouseToolbar
      activeTab='stock'
      currentPage={1}
      pageSize={30}
      stockSummaryText='2 stock rows'
      totalItems={2}
      selectedProductCount={props?.selectedProductCount ?? 0}
      selectedSerialCount={props?.selectedSerialCount ?? 0}
      activeColumnsTab='stock'
      columnsMenuRef={createRef<HTMLDivElement>()}
      isColumnsMenuOpen={false}
      visibleColumnKeySet={new Set(['select', 'name', 'serial'])}
      activeFilterCount={0}
      query=''
      searchMode='serial'
      searchPlaceholder='Search by serial number'
      onPrintSelectedSerials={onPrintSelectedSerials}
      onClearSelection={onClearSelection}
      onToggleColumnsMenu={vi.fn()}
      onToggleColumnVisibility={vi.fn()}
      onToggleFilters={vi.fn()}
      setQuery={vi.fn()}
      setSearchMode={vi.fn()}
      setCurrentPage={vi.fn()}
    />,
  );

  return { onPrintSelectedSerials, onClearSelection };
};

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
});
