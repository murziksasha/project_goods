import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sale, SaleFormValues, SaleWorkspacePayload } from '../model/types';
import { createSale, updateSaleWorkspace } from './saleApi';

const { postMock, patchMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock('../../../shared/api/http', () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status = null;
    hasResponse = false;

    constructor(message: string) {
      super(message);
      this.name = 'ApiRequestError';
    }
  },
  apiClient: {
    post: postMock,
    patch: patchMock,
  },
  getApiErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Unexpected request error.',
}));

const sale: Sale = {
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-06-10T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'new',
  },
  product: null,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
};

const createPayload: SaleFormValues = {
  saleDate: '2026-06-10T10:00:00.000Z',
  clientId: 'client-1',
  productId: '',
  quantity: '1',
  salePrice: '100',
  note: '',
};

const workspacePayload: SaleWorkspacePayload = {
  status: 'issued',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('saleApi response validation', () => {
  it('accepts a create sale response with sale and product', async () => {
    postMock.mockResolvedValueOnce({
      data: { sale, product: null },
    });

    await expect(createSale(createPayload)).resolves.toEqual({
      sale,
      product: null,
    });
  });

  it('rejects a create sale response without a valid sale', async () => {
    postMock.mockResolvedValueOnce({
      data: { product: null },
    });

    await expect(createSale(createPayload)).rejects.toThrow(
      'Unexpected create sale response from API.',
    );
  });

  it('accepts a direct sale workspace update response', async () => {
    patchMock.mockResolvedValueOnce({ data: sale });

    await expect(updateSaleWorkspace('sale-1', workspacePayload)).resolves.toBe(sale);
  });

  it('rejects invalid sale workspace update responses', async () => {
    patchMock.mockResolvedValueOnce({
      data: '<!doctype html><html></html>',
    });

    await expect(updateSaleWorkspace('sale-1', workspacePayload)).rejects.toThrow(
      'Unexpected sale workspace update response from API.',
    );
  });

  it('rejects wrapped sale workspace update responses', async () => {
    patchMock.mockResolvedValueOnce({
      data: { sale },
    });

    await expect(updateSaleWorkspace('sale-1', workspacePayload)).rejects.toThrow(
      'Unexpected sale workspace update response from API.',
    );
  });
});
