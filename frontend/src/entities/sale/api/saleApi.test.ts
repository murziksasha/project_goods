import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as http from '../../../shared/api/http';
import type { Sale, SaleFormValues, SaleWorkspacePayload } from '../model/types';

const { postMock, patchMock, getMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  patchMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('../../../shared/api/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/api/http')>();
  return { ...actual };
});

const restoreHttpMocks = () => {
  vi.spyOn(http.apiClient, 'post').mockImplementation(postMock);
  vi.spyOn(http.apiClient, 'patch').mockImplementation(patchMock);
  vi.spyOn(http.apiClient, 'get').mockImplementation(getMock);
};

let createSale: typeof import('./saleApi').createSale;
let updateSaleWorkspace: typeof import('./saleApi').updateSaleWorkspace;
let getSales: typeof import('./saleApi').getSales;
let buildSalesListQuery: typeof import('./saleApi').buildSalesListQuery;

beforeEach(async () => {
  vi.restoreAllMocks();
  postMock.mockReset();
  patchMock.mockReset();
  getMock.mockReset();
  restoreHttpMocks();
  ({ createSale, updateSaleWorkspace, getSales, buildSalesListQuery } = await import('./saleApi'));
});

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

describe('saleApi list params', () => {
  it('builds query params for list filters', () => {
    expect(
      buildSalesListQuery({
        kind: 'repair',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        limit: 100,
        isFavorite: true,
      }),
    ).toEqual({
      kind: 'repair',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      limit: '100',
      isFavorite: 'true',
    });
  });

  it('passes list filters to GET /sales', async () => {
    getMock.mockResolvedValueOnce({ data: [sale] });

    await expect(
      getSales({ kind: 'sale', dateFrom: '2026-06-01', limit: 50 }),
    ).resolves.toEqual([sale]);

    expect(getMock).toHaveBeenCalledWith('/sales', {
      params: {
        kind: 'sale',
        dateFrom: '2026-06-01',
        limit: '50',
      },
    });
  });
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