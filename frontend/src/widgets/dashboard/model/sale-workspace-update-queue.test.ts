import { describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../../entities/sale/model/types';
import { patchLineItemsById } from './line-item-ops';
import { createSaleWorkspaceUpdateQueue } from './sale-workspace-update-queue';

const lineItem = {
  id: 'item-1',
  kind: 'service' as const,
  name: 'Postage',
  price: 2000,
  quantity: 1,
  warrantyPeriod: 30,
};

const sale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000704',
  saleDate: '2026-01-01T00:00:00.000Z',
  quantity: 1,
  salePrice: 2000,
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [{ ...lineItem }],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'ok',
  },
  product: null,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('createSaleWorkspaceUpdateQueue', () => {
  it('serializes overlapping updates and rebases the second on the first response', async () => {
    let current = sale();
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let persistCount = 0;
    const persist = vi.fn(async (latest: Sale, payload: { lineItems?: Sale['lineItems'] }) => {
      persistCount += 1;
      if (persistCount === 1) await firstGate;
      current = {
        ...latest,
        lineItems: payload.lineItems ?? latest.lineItems,
        updatedAt: `2026-01-01T00:00:0${persistCount}.000Z`,
      };
      return current;
    });
    const onError = vi.fn();
    const queue = createSaleWorkspaceUpdateQueue({
      persist,
      getLatestSale: (saleId) =>
        current.id === saleId ? current : undefined,
      onError,
    });

    queue.enqueue('sale-1', (latest) => ({
      lineItems: patchLineItemsById(latest.lineItems, 'item-1', undefined, {
        price: 20,
      }),
    }));
    queue.enqueue('sale-1', (latest) => ({
      lineItems: patchLineItemsById(latest.lineItems, 'item-1', undefined, {
        quantity: 2,
      }),
    }));

    await vi.waitFor(() => {
      expect(persist).toHaveBeenCalledTimes(1);
    });
    releaseFirst();

    await vi.waitFor(() => {
      expect(persist).toHaveBeenCalledTimes(2);
    });

    expect(persist.mock.calls[0]?.[0].updatedAt).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(persist.mock.calls[1]?.[0].updatedAt).toBe(
      '2026-01-01T00:00:01.000Z',
    );
    expect(persist.mock.calls[1]?.[1].lineItems?.[0]).toMatchObject({
      price: 20,
      quantity: 2,
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps the chain moving after a failed persist', async () => {
    let current = sale();
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(async (latest: Sale, payload: { lineItems?: Sale['lineItems'] }) => {
        current = {
          ...latest,
          lineItems: payload.lineItems ?? latest.lineItems,
          updatedAt: '2026-01-01T00:00:02.000Z',
        };
        return current;
      });
    const onError = vi.fn();
    const queue = createSaleWorkspaceUpdateQueue({
      persist,
      getLatestSale: () => current,
      onError,
    });

    queue.enqueue('sale-1', () => ({
      lineItems: patchLineItemsById(current.lineItems, 'item-1', undefined, {
        price: 1,
      }),
    }));
    queue.enqueue('sale-1', (latest) => ({
      lineItems: patchLineItemsById(latest.lineItems, 'item-1', undefined, {
        price: 250,
      }),
    }));

    await vi.waitFor(() => {
      expect(persist).toHaveBeenCalledTimes(2);
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[1]?.[1].lineItems?.[0]?.price).toBe(250);
  });
});
