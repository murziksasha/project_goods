import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../../../../entities/sale';
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
  salePrice: 800,
  kind: 'repair',
  status: 'issued',
  paidAmount: 800,
  note: '',
  userNote: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'svc-1',
      kind: 'service',
      name: 'Screen Cleaning',
      price: 500,
      quantity: 1,
      warrantyPeriod: 1,
      costMethod: 'time_rate',
      recordedMinutes: 30,
      hourlyCost: 200,
      directExpenses: 20,
      costSnapshot: { status: 'unknown', unitCost: null, totalCost: null, method: 'unknown', capturedAt: null },
      costAuditLog: [
        {
          id: 'log-1',
          previousStatus: 'known',
          previousUnitCost: 100,
          previousTotalCost: 100,
          newStatus: 'unknown',
          newUnitCost: null,
          newTotalCost: null,
          method: 'unknown',
          reason: 'Initial reset',
          authorName: 'Owner',
          changedAt: '2026-11-10T11:00:00.000Z',
        },
      ],
    },
  ],
  product: { id: '', name: 'Screen Cleaning', article: 'REP', serialNumber: '' },
  client: { id: 'c1', name: 'Bob', phone: '+380991112233', status: 'new' },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
});

afterEach(() => {
  cleanup();
  patchCostsSpy.mockReset();
});

describe('OrderCostAuditModal', () => {
  it('renders audit history and submits explicit cost completion and reason', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <OrderCostAuditModal
          saleId="sale-cost-1"
          initialSale={saleFixture()}
          isOpen
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Audit History/)).toBeInTheDocument();
    expect(screen.getByText(/Initial reset/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Audit Reason/), {
      target: { value: 'Confirmed technician time' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Audited Costs' }));

    await waitFor(() => {
      expect(patchCostsSpy).toHaveBeenCalledWith(
        'sale-cost-1',
        expect.objectContaining({
          reason: 'Confirmed technician time',
          items: expect.arrayContaining([
            expect.objectContaining({
              lineItemId: 'svc-1',
              status: 'known',
              costMethod: 'time_rate',
              recordedMinutes: 30,
              hourlyCost: 200,
              directExpenses: 20,
            }),
          ]),
        }),
      );
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
