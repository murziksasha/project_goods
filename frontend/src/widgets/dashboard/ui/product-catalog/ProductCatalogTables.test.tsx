import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Supplier } from '../../../../entities/supplier/model/types';
import * as clipboard from '../../../../shared/lib/clipboard';
import { SuppliersTable } from './ProductCatalogTables';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const supplier: Supplier = {
  id: 'supplier-1',
  name: 'Мазуренко Iгор',
  phone: '+380994222988',
  phones: ['+380994222988'],
  supplierOrder: '',
  note: 'Ремонт плат',
  isActive: true,
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
};

describe('SuppliersTable', () => {
  it('copies the phone from the hover icon without opening the supplier', async () => {
    const onSelectSupplier = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <SuppliersTable
        suppliers={[supplier]}
        searchQuery=""
        rowStartIndex={0}
        onSelectSupplier={onSelectSupplier}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: '+380994222988' }));
    expect(onSelectSupplier).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: /^(Copy|common\.copy)$/ }),
    );

    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('+380994222988');
    });
    expect(onSelectSupplier).not.toHaveBeenCalled();
  });
});
