import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { emptySupplierOrdersFilters } from '../../model/supplier-orders-workspace';
import { SupplierOrdersFilterPanel } from './SupplierOrdersFilterPanel';

describe('SupplierOrdersFilterPanel', () => {
  it('applies and resets draft filters', () => {
    const onApply = vi.fn();
    const onReset = vi.fn();
    const setDraft = vi.fn();

    render(
      <SupplierOrdersFilterPanel
        isOpen
        isStatusFilterOpen={false}
        isPaymentFilterOpen={false}
        canManageSavedFilters
        draftFilters={emptySupplierOrdersFilters}
        savedFilters={[]}
        suppliers={[
          {
            id: 'sup-1',
            name: 'Parts Hub',
            phone: '',
            phones: [],
            note: '',
            isActive: true,
            supplierOrder: '',
            createdAt: '',
            updatedAt: '',
          },
        ]}
        createdByOptions={['Admin']}
        newFilterName=''
        newFilterIcon='?'
        statusFilterRef={{ current: null }}
        paymentFilterRef={{ current: null }}
        setDraftFilters={setDraft}
        setIsStatusFilterOpen={vi.fn()}
        setIsPaymentFilterOpen={vi.fn()}
        setNewFilterName={vi.fn()}
        setNewFilterIcon={vi.fn()}
        onApplyFilters={onApply}
        onResetFilters={onReset}
        onSaveCurrentFilter={vi.fn()}
        onApplySavedFilter={vi.fn()}
        onRemoveSavedFilter={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(screen.getByText('Clear'));
    expect(onApply).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    expect(screen.getByText('Supplier')).toBeTruthy();
    expect(screen.getByText('Created by')).toBeTruthy();
  });
});
