import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Sale, SaleLineItem } from '../../../../../entities/sale';
import i18n from '../../../../../shared/i18n/config';
import { formatCurrency } from '../../../../../shared/lib/format';
import { CreateOrderSidePanel } from './CreateOrderSidePanel';
import type { CreateOrderSidePanelProps } from './CreateOrderSidePanel';

const product: SaleLineItem = {
  id: 'part-1',
  kind: 'product',
  name: 'Replacement capacitor',
  price: 125,
  quantity: 2,
  warrantyPeriod: 0,
  serialNumbers: ['S000001', 'S000002'],
};

const service: SaleLineItem = {
  id: 'service-1',
  kind: 'service',
  name: 'Capacitor replacement',
  price: 340,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: [],
};

const createSale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'repair-1',
  recordNumber: 'r001405',
  saleDate: '2026-11-10T12:00:00.000Z',
  quantity: 1,
  salePrice: 590,
  kind: 'repair',
  status: 'issued',
  paidAmount: 590,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [product, service],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380991112233',
    status: 'ok',
  },
  product: {
    id: '',
    name: 'LG microwave',
    article: 'REPAIR',
    serialNumber: 'DEVICE-001',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
  ...patch,
});

const renderPanel = (
  sales: Sale[],
  overrides: Partial<CreateOrderSidePanelProps> = {},
) => render(
  <CreateOrderSidePanel
    hasSelectedClient
    registeredClientDevices={[]}
    unbindingDeviceId={null}
    activeClientRequests={sales}
    activeClientRequestTab='orders'
    selectedFlags={[]}
    onApplyDevice={vi.fn()}
    onUnbindDevice={vi.fn()}
    onClientRequestTabChange={vi.fn()}
    {...overrides}
  />,
);

const getToggle = (sale: Sale) => screen.getByRole('button', {
  name: i18n.t('orders.create.sidePanel.toggleContents', {
    number: sale.recordNumber,
  }),
});

const getContents = (sale: Sale) => {
  const id = getToggle(sale).getAttribute('aria-controls');
  const contents = id ? document.getElementById(id) : null;
  expect(contents).not.toBeNull();
  return contents as HTMLElement;
};

describe('CreateOrderSidePanel request contents', () => {
  it('shows the saved repair device and date before expanding parts and services', () => {
    const repair = createSale();
    renderPanel([repair]);

    expect(screen.getByText('LG microwave')).toBeVisible();
    expect(screen.getByText('10.11.2026')).toBeVisible();
    const link = screen.getByRole('link', { name: 'r001405' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('href')).toContain('saleId=repair-1');
    expect(link.getAttribute('href')).toContain('ordersTab=orders');
    expect(getToggle(repair)).toHaveAttribute('aria-expanded', 'false');
    expect(getContents(repair)).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'S000001' })).toBeNull();

    fireEvent.click(getToggle(repair));

    const contents = getContents(repair);
    expect(contents).toBeVisible();
    expect(getToggle(repair)).toHaveAttribute('aria-expanded', 'true');
    expect(within(contents).getByText(product.name)).toBeVisible();
    expect(within(contents).getByText(service.name)).toBeVisible();
    expect(within(contents).getByText(formatCurrency(125), { normalizer: (text) => text })).toBeVisible();
    expect(within(contents).getByText(formatCurrency(250), { normalizer: (text) => text })).toBeVisible();
    expect(within(contents).getByText('2')).toBeVisible();
    expect(within(contents).getByRole('button', { name: 'S000001' })).toBeVisible();
    expect(within(contents).getByRole('button', { name: 'S000002' })).toBeVisible();
  });

  it.each([null, '', 'REPAIR', 'REPAIR PLACEHOLDER'])('does not substitute a repair part for a missing device (%s)', (name) => {
    const repair = createSale({
      product: name === null ? null : { id: '', name, article: 'REPAIR', serialNumber: '' },
    });
    renderPanel([repair]);

    expect(screen.getByText(i18n.t('orders.create.sidePanel.deviceNotSpecified'))).toBeVisible();
    expect(screen.queryByText(product.name)).toBeNull();
    expect(screen.queryByText(service.name)).toBeNull();
  });

  it('retains the sale summary and opens the clicked serial with its exact row and sale', () => {
    const sale = createSale({ kind: 'sale', recordNumber: 's000123' });
    const onOpenSerial = vi.fn();
    renderPanel([sale], { activeClientRequestTab: 'sales', onOpenSerial });

    expect(screen.getByText(product.name, { selector: 'span' })).toBeVisible();
    expect(screen.queryByText('LG microwave')).toBeNull();
    expect(screen.getByRole('link', { name: 's000123' }).getAttribute('href')).toContain('ordersTab=sales');
    fireEvent.click(getToggle(sale));
    fireEvent.click(within(getContents(sale)).getByRole('button', { name: 'S000002' }));

    expect(onOpenSerial).toHaveBeenCalledExactlyOnceWith(sale, product, 'S000002');
    expect(getToggle(sale)).toHaveAttribute('aria-expanded', 'true');
  });

  it('expands requests independently and collapses only the requested one', () => {
    const first = createSale();
    const second = createSale({ id: 'repair-2', recordNumber: 'r001406' });
    renderPanel([first, second]);

    fireEvent.click(getToggle(first));
    fireEvent.click(getToggle(second));
    expect(getContents(first)).toBeVisible();
    expect(getContents(second)).toBeVisible();
    fireEvent.click(getToggle(first));
    expect(getContents(first)).not.toBeVisible();
    expect(getContents(second)).toBeVisible();
  });

  it('shows an explicit empty composition rather than inventing snapshot rows', () => {
    const repair = createSale({ lineItems: [] });
    renderPanel([repair]);
    fireEvent.click(getToggle(repair));

    expect(within(getContents(repair)).getByText(i18n.t('orders.create.sidePanel.noItems'))).toBeVisible();
    expect(within(getContents(repair)).queryByRole('list')).toBeNull();
  });

  it('keeps all saved rows with identical names and ignores blank serial entries', () => {
    const repair = createSale({
      lineItems: [product, { ...product, id: 'part-2', serialNumbers: [' ', 'S000003'] }, service],
    });
    renderPanel([repair], { onOpenSerial: vi.fn() });
    fireEvent.click(getToggle(repair));

    const contents = getContents(repair);
    expect(within(contents).getAllByText(product.name)).toHaveLength(2);
    expect(within(contents).getAllByRole('listitem')).toHaveLength(3);
    expect(within(contents).getAllByRole('button', { name: /^S00000/ })).toHaveLength(3);
  });

  it('centers the contents chevron beside the number and exposes its ARIA state', () => {
    const repair = createSale();
    renderPanel([repair]);
    const toggle = getToggle(repair);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.getAttribute('aria-controls')).toBeTruthy();
    expect(toggle.querySelector('.create-side-request-chevron')).not.toBeNull();
    expect(toggle.parentElement).toHaveClass('create-side-request-number');
    expect(toggle).toHaveClass('create-side-request-toggle');
  });
});
