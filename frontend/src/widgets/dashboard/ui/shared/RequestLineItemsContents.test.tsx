import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Sale, SaleLineItem } from '../../../../entities/sale';
import i18n from '../../../../shared/i18n/config';
import * as clipboard from '../../../../shared/lib/clipboard';
import { formatCurrency } from '../../../../shared/lib/format';
import { RequestLineItemsContents } from './RequestLineItemsContents';

const product = (patch: Partial<SaleLineItem> = {}): SaleLineItem => ({
  id: 'part-1',
  kind: 'product',
  name: 'Replacement capacitor',
  price: 125,
  quantity: 2,
  warrantyPeriod: 0,
  serialNumbers: [' S000001 ', 'S000002'],
  ...patch,
});

const service = (patch: Partial<SaleLineItem> = {}): SaleLineItem => ({
  id: 'service-1',
  kind: 'service',
  name: 'Capacitor replacement',
  price: 340,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: ['SHOULD-NOT-SHOW'],
  ...patch,
});

const saleWith = (lineItems: SaleLineItem[] | undefined): Sale =>
  ({
    id: 'repair-1',
    recordNumber: 'r001405',
    lineItems,
  }) as Sale;

describe('RequestLineItemsContents', () => {
  it('shows products and services with quantity, unit price, and line total', () => {
    render(
      <RequestLineItemsContents
        sale={saleWith([service(), product(), service({ id: 'service-2', name: 'Diagnostics' })])}
      />,
    );

    const lists = screen.getAllByRole('list');
    expect(within(lists[0]).getByText('Replacement capacitor')).toBeVisible();
    expect(within(lists[0]).queryByText('Capacitor replacement')).toBeNull();
    expect(within(lists[1]).getByText('Capacitor replacement')).toBeVisible();
    expect(within(lists[1]).getByText('Diagnostics')).toBeVisible();
    expect(within(lists[0]).getByText('2')).toBeVisible();
    expect(
      within(lists[0]).getByText(formatCurrency(125), {
        normalizer: (text) => text,
      }),
    ).toBeVisible();
    expect(
      within(lists[0]).getByText(formatCurrency(250), {
        normalizer: (text) => text,
      }),
    ).toBeVisible();
    expect(within(lists[1]).queryByRole('button')).toBeNull();
  });

  it('keeps duplicate rows and copies or opens only the trimmed serial', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    const onOpenSerial = vi.fn();
    const first = product();
    const duplicate = product({
      id: 'part-2',
      serialNumbers: [' ', 'S000003'],
    });
    render(
      <RequestLineItemsContents
        sale={saleWith([first, duplicate, service()])}
        onOpenSerial={onOpenSerial}
      />,
    );

    expect(screen.getAllByText(first.name)).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'SHOULD-NOT-SHOW' })).toBeNull();
    expect(screen.queryByRole('button', { name: ' ' })).toBeNull();

    const serialButton = screen.getByRole('button', { name: 'S000001' });
    const serialCopy = within(
      serialButton.closest('.copyable-value') as HTMLElement,
    ).getByRole('button', { name: 'Copy' });
    fireEvent.click(serialCopy);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('S000001');
    });
    expect(onOpenSerial).not.toHaveBeenCalled();

    fireEvent.click(serialButton);
    expect(onOpenSerial).toHaveBeenCalledExactlyOnceWith(first, 'S000001');
  });

  it.each([undefined, [] as SaleLineItem[]])(
    'shows an explicit empty composition for %s line items',
    (lineItems) => {
      render(<RequestLineItemsContents sale={saleWith(lineItems)} />);

      expect(
        screen.getByText(i18n.t('orders.create.sidePanel.noItems')),
      ).toBeVisible();
      expect(screen.queryByRole('list')).toBeNull();
    },
  );
});
