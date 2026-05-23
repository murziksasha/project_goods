import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saleModel,
  normalizeSalePayloadMock,
  upsertCatalogProductsMock,
} = vi.hoisted(() => ({
  saleModel: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  normalizeSalePayloadMock: vi.fn(),
  upsertCatalogProductsMock: vi.fn(),
}));

vi.mock('./model', () => ({
  Sale: saleModel,
}));

vi.mock('../client/model', () => ({
  Client: {},
}));

vi.mock('../employee/model', () => ({
  Employee: {
    findById: vi.fn(),
  },
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: {},
}));

vi.mock('../product/model', () => ({
  Product: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('../../shared/lib/formatters', () => ({
  formatProduct: vi.fn((value) => value),
  formatSale: vi.fn((value) => value),
}));

vi.mock('../../shared/lib/parsers', () => ({
  normalizeSalePayload: normalizeSalePayloadMock,
}));

vi.mock('../../shared/lib/query', () => ({
  isValidObjectIdOrThrow: vi.fn(),
}));

vi.mock('../sequence/service', () => ({
  getNextRecordNumber: vi.fn(),
}));

vi.mock('../finance/service', () => ({
  createFinanceTransaction: vi.fn(),
}));

vi.mock('../../shared/lib/errors', () => ({
  assertNotStale: vi.fn(),
}));

vi.mock('../catalog-product/service', () => ({
  upsertCatalogProducts: upsertCatalogProductsMock,
}));

import { updateSaleWorkspace } from './service';

const buildExistingSale = (kind: 'repair' | 'sale') => ({
  _id: 'sale-1',
  kind,
  status: 'new',
  paidAmount: 0,
  salePrice: 0,
  quantity: 1,
  product: '507f1f77bcf86cd799439011',
  productSnapshot: {
    article: 'ART-1',
    name: 'System Block',
    serialNumber: '',
  },
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  discount: { mode: 'amount', value: 0 },
  master: null,
  issuedBy: null,
  masterSnapshot: null,
  issuedBySnapshot: null,
  updatedAt: new Date('2026-05-23T10:00:00.000Z'),
});

const lineItem = {
  id: 'li-1',
  kind: 'product',
  productId: '507f1f77bcf86cd799439012',
  name: 'Wireless Mouse',
  price: 150,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: [],
};
const secondLineItem = {
  id: 'li-2',
  kind: 'product',
  productId: '507f1f77bcf86cd799439013',
  name: 'Keyboard',
  price: 220,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: [],
};

describe('updateSaleWorkspace line items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('keeps product line item name for repair orders', async () => {
    const existingSale = buildExistingSale('repair');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        lineItems: [lineItem],
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'new',
      paidAmount: 0,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [lineItem],
      masterId: '',
      issuedById: '',
    });

    await updateSaleWorkspace(existingSale._id, {
      kind: 'repair',
      status: 'new',
      lineItems: [lineItem],
    });

    const updatePayload = saleModel.findByIdAndUpdate.mock.calls[0]?.[1];
    expect(updatePayload.lineItems[0].name).toBe('Wireless Mouse');
  });

  it('keeps product line item name for sale orders', async () => {
    const existingSale = buildExistingSale('sale');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        lineItems: [lineItem],
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'sale',
      status: 'new',
      paidAmount: 0,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [lineItem],
      masterId: '',
      issuedById: '',
    });

    await updateSaleWorkspace(existingSale._id, {
      kind: 'sale',
      status: 'new',
      lineItems: [lineItem],
    });

    const updatePayload = saleModel.findByIdAndUpdate.mock.calls[0]?.[1];
    expect(updatePayload.lineItems[0].name).toBe('Wireless Mouse');
  });

  it('keeps names for multiple product line items', async () => {
    const existingSale = buildExistingSale('repair');
    const nextItems = [lineItem, secondLineItem];
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        lineItems: nextItems,
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'new',
      paidAmount: 0,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: nextItems,
      masterId: '',
      issuedById: '',
    });

    await updateSaleWorkspace(existingSale._id, {
      kind: 'repair',
      status: 'new',
      lineItems: nextItems,
    });

    const updatePayload = saleModel.findByIdAndUpdate.mock.calls[0]?.[1];
    expect(updatePayload.lineItems).toHaveLength(2);
    expect(updatePayload.lineItems[0].name).toBe('Wireless Mouse');
    expect(updatePayload.lineItems[1].name).toBe('Keyboard');
  });
});
