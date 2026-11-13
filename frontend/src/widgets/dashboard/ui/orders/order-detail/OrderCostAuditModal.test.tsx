import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import type { Sale } from '../../../../../entities/sale';
import i18n from '../../../../../shared/i18n/config';
import { OrderCostAuditModal } from './OrderCostAuditModal';

const { patchCostsSpy } = vi.hoisted(() => ({
  patchCostsSpy: vi.fn(),
}));

vi.mock('../../../../../entities/sale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../entities/sale')>();
  return {
    ...actual,
    useUpdateSaleLineCostsMutation: () => ({
      isPending: false,
      mutateAsync: async ({
        saleId,
        payload,
      }: {
        saleId: string;
        payload: unknown;
      }) => {
        patchCostsSpy(saleId, payload);
        return saleFixture();
      },
    }),
  };
});

const saleFixture = (): Sale => ({
  id: 'sale-cost-1',
  recordNumber: 'S000900',
  saleDate: '2026-11-10T10:00:00.000Z',
  quantity: 1,
  salePrice: 1500,
  kind: 'repair',
  status: 'inRepair',
  paidAmount: 0,
  note: '',
  userNote: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'prod-missing-1',
      kind: 'product',
      name: 'OLED Screen',
      price: 800,
      quantity: 1,
      warrantyPeriod: 1,
      requiresCostAudit: true,
      costSnapshot: null,
      auditedCost: null,
      costAuditLog: [],
    },
    {
      id: 'prod-known-audit-2',
      kind: 'product',
      name: 'Charging Port',
      price: 300,
      quantity: 1,
      warrantyPeriod: 1,
      requiresCostAudit: true,
      unitCostOverride: 120,
      auditedCost: {
        status: 'known',
        unitCost: 120,
        totalCost: 120,
        method: 'manual',
        capturedAt: '2026-11-10T11:00:00.000Z',
      },
      costAuditLog: [
        {
          id: 'log-1',
          previousStatus: 'unknown',
          previousUnitCost: null,
          previousTotalCost: null,
          newStatus: 'known',
          newUnitCost: 120,
          newTotalCost: 120,
          method: 'manual',
          reason: 'Initial supplier bill',
          authorName: 'Owner',
          changedAt: '2026-11-10T11:00:00.000Z',
        },
      ],
    },
    {
      id: 'prod-stock-3',
      kind: 'product',
      productId: 'stock-1',
      name: 'Stock Cable',
      price: 200,
      quantity: 1,
      warrantyPeriod: 0,
      requiresCostAudit: false,
    },
    {
      id: 'svc-4',
      kind: 'service',
      name: 'Screen Cleaning',
      price: 200,
      quantity: 1,
      warrantyPeriod: 1,
      requiresCostAudit: false,
      costMethod: 'time_rate',
      recordedMinutes: 30,
      hourlyCost: 200,
    },
  ],
  product: { id: '', name: 'Phone', article: 'REP', serialNumber: '' },
  client: { id: 'c1', name: 'Bob', phone: '+380991112233', status: 'new' },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
});

afterEach(async () => {
  cleanup();
  patchCostsSpy.mockReset();
  await i18n.changeLanguage('en');
});

describe('OrderCostAuditModal', () => {
  it('shows only audit-eligible products, sends only changed rows, and accepts explicit 0', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <OrderCostAuditModal
            saleId="sale-cost-1"
            initialSale={saleFixture()}
            isOpen
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </QueryClientProvider>
      </I18nextProvider>,
    );

    // Portal renders directly in document.body
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('.modal-backdrop')?.parentElement).toBe(document.body);

    // Only eligible products shown; stock product & service hidden
    expect(screen.getByText('OLED Screen')).toBeInTheDocument();
    expect(screen.getByText('Charging Port')).toBeInTheDocument();
    expect(screen.queryByText('Stock Cable')).not.toBeInTheDocument();
    expect(screen.queryByText('Screen Cleaning')).not.toBeInTheDocument();
    expect(screen.getByText(/Audit history/i)).toBeInTheDocument();
    expect(screen.getByText(/Initial supplier bill/)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeDisabled();

    // Fill only OLED Screen with explicit 0; leave Charging Port unchanged
    const unitCostInputs = screen.getAllByLabelText(/Purchase price per unit/i);
    fireEvent.change(unitCostInputs[0], { target: { value: '0' } });
    expect(saveBtn).toBeEnabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(patchCostsSpy).toHaveBeenCalledWith('sale-cost-1', {
        items: [
          {
            lineItemId: 'prod-missing-1',
            status: 'known',
            unitCost: 0,
            directExpenses: null,
          },
        ],
        reason: undefined,
      });
    });
    expect(onSuccess).toHaveBeenCalledWith(
      'Purchase costs updated and audit log recorded.',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('requires a reason when correcting an already-known product cost and supports UK locale', async () => {
    await i18n.changeLanguage('uk');

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <OrderCostAuditModal
            saleId="sale-cost-1"
            initialSale={saleFixture()}
            isOpen
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      </I18nextProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Аудит собівартості' }),
    ).toBeInTheDocument();

    const unitCostInputs = screen.getAllByLabelText(/Закупівельна ціна за од\./i);
    fireEvent.change(unitCostInputs[1], { target: { value: '145' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(
      screen.getByText(/Вкажіть причину аудиту/i),
    ).toBeInTheDocument();
    expect(patchCostsSpy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Причина аудиту/i), {
      target: { value: 'Оновлена накладна' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() => {
      expect(patchCostsSpy).toHaveBeenCalledWith('sale-cost-1', {
        items: [
          {
            lineItemId: 'prod-known-audit-2',
            status: 'known',
            unitCost: 145,
            directExpenses: null,
            reason: 'Оновлена накладна',
          },
        ],
        reason: 'Оновлена накладна',
      });
    });
  });

  it('shows Products and Services groups when serviceAuditEnabled is true and audits eligible services', async () => {
    const saleWithService = saleFixture();
    saleWithService.lineItems.push({
      id: 'svc-legacy-unknown',
      kind: 'service',
      name: 'Legacy Board Repair',
      price: 450,
      quantity: 1,
      warrantyPeriod: 0,
      costSnapshot: {
        status: 'unknown',
        unitCost: null,
        totalCost: null,
        method: 'unknown',
        capturedAt: '2026-10-01T10:00:00.000Z',
      },
      auditedCost: null,
      costAuditLog: [],
    });

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={new QueryClient()}>
          <OrderCostAuditModal
            saleId="sale-cost-1"
            initialSale={saleWithService}
            serviceAuditEnabled
            isOpen
            onClose={vi.fn()}
          />
        </QueryClientProvider>
      </I18nextProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByText('Legacy Board Repair')).toBeInTheDocument();
    expect(screen.queryByText('Screen Cleaning')).not.toBeInTheDocument();

    const fixedInput = screen.getByLabelText(/Fixed cost per unit/i);
    fireEvent.change(fixedInput, { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(patchCostsSpy).toHaveBeenCalledWith('sale-cost-1', {
        items: [
          {
            lineItemId: 'svc-legacy-unknown',
            status: 'known',
            costMethod: 'fixed',
            fixedCost: 125,
            directExpenses: null,
          },
        ],
        reason: undefined,
      });
    });
  });
});
