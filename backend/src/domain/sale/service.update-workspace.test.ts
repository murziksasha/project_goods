import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saleModel,
  employeeModel,
  productModel,
  normalizeSalePayloadMock,
  upsertCatalogProductsMock,
} = vi.hoisted(() => ({
  saleModel: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  employeeModel: {
    findById: vi.fn(),
  },
  productModel: {
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
  Employee: employeeModel,
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: {},
}));

vi.mock('../product/model', () => ({
  Product: productModel,
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
const serializedLineItem = {
  id: 'li-serial',
  kind: 'product',
  productId: '507f1f77bcf86cd799439014',
  name: 'Cable Trigger',
  price: 500,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: ['S000020'],
};

describe('updateSaleWorkspace line items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    productModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        quantity: 10,
        reservedQuantity: 0,
      }),
    });
    productModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        quantity: 9,
        reservedQuantity: 0,
      }),
    });
    employeeModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
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

  it('rejects serialized line items with quantity greater than 1', async () => {
    const existingSale = buildExistingSale('sale');
    const invalidItem = {
      ...serializedLineItem,
      quantity: 2,
    };
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    productModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: serializedLineItem.productId,
        quantity: 1,
        reservedQuantity: 0,
        serialNumber: 'S000020',
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
      lineItems: [invalidItem],
      masterId: '',
      issuedById: '',
    });

    await expect(
      updateSaleWorkspace(existingSale._id, {
        kind: 'sale',
        status: 'new',
        lineItems: [invalidItem],
      }),
    ).rejects.toThrow(
      'Serialized product line items must contain exactly one serial number and quantity 1.',
    );
  });

  it('rejects serialized line items linked to a different stock product', async () => {
    const existingSale = buildExistingSale('sale');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    productModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: serializedLineItem.productId,
        quantity: 1,
        reservedQuantity: 0,
        serialNumber: 'S000021',
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
      lineItems: [serializedLineItem],
      masterId: '',
      issuedById: '',
    });

    await expect(
      updateSaleWorkspace(existingSale._id, {
        kind: 'sale',
        status: 'new',
        lineItems: [serializedLineItem],
      }),
    ).rejects.toThrow(
      'Serialized product line item must reference the matching stock product.',
    );
  });

  it('rejects quantity greater than 1 for a serialized stock product without a bound serial', async () => {
    const existingSale = buildExistingSale('sale');
    const invalidItem = {
      ...serializedLineItem,
      quantity: 2,
      serialNumbers: [],
    };
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    productModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: serializedLineItem.productId,
        quantity: 2,
        reservedQuantity: 0,
        serialNumber: 'S000020',
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
      lineItems: [invalidItem],
      masterId: '',
      issuedById: '',
    });

    await expect(
      updateSaleWorkspace(existingSale._id, {
        kind: 'sale',
        status: 'new',
        lineItems: [invalidItem],
      }),
    ).rejects.toThrow(
      'Serialized stock products cannot be sold with quantity greater than 1.',
    );
  });

  it('decrements stock for repair orders when status becomes issued', async () => {
    const existingSale = buildExistingSale('repair');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        status: 'issued',
        lineItems: [lineItem],
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'issued',
      paidAmount: 150,
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
      status: 'issued',
      paidAmount: 150,
      lineItems: [lineItem],
    });

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      lineItem.productId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' },
    );
  });

  it('decrements stock for paid repair orders with bound serials when status becomes issued', async () => {
    const existingSale = buildExistingSale('repair');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    productModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: serializedLineItem.productId,
        quantity: 1,
        reservedQuantity: 0,
        serialNumber: 'S000020',
      }),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        status: 'issued',
        paidAmount: 500,
        lineItems: [serializedLineItem],
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'issued',
      paidAmount: 500,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [serializedLineItem],
      masterId: '',
      issuedById: '',
    });

    await updateSaleWorkspace(existingSale._id, {
      kind: 'repair',
      status: 'issued',
      paidAmount: 500,
      lineItems: [serializedLineItem],
    });

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      serializedLineItem.productId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' },
    );
  });

  it('rejects repair refusal status while bound serials are still attached', async () => {
    const existingSale = buildExistingSale('repair');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'issuedWithoutRepair',
      paidAmount: 500,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [serializedLineItem],
      masterId: '',
      issuedById: '',
    });

    await expect(
      updateSaleWorkspace(existingSale._id, {
        kind: 'repair',
        status: 'issuedWithoutRepair',
        paidAmount: 500,
        lineItems: [serializedLineItem],
      }),
    ).rejects.toThrow(
      'Refund client payment for bound products and return them to stock first.',
    );
  });

  it('does not decrement stock for repair orders in non-closing status', async () => {
    const existingSale = buildExistingSale('repair');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        status: 'inRepair',
        lineItems: [lineItem],
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'inRepair',
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
      status: 'inRepair',
      lineItems: [lineItem],
    });

    expect(productModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps sale stock behavior unchanged for issued status', async () => {
    const existingSale = buildExistingSale('sale');
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        status: 'issued',
        lineItems: [lineItem],
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'sale',
      status: 'issued',
      paidAmount: 150,
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
      status: 'issued',
      paidAmount: 150,
      lineItems: [lineItem],
    });

    expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
      lineItem.productId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' },
    );
  });

  it('persists updated master and master snapshot from workspace main info', async () => {
    const existingSale = buildExistingSale('repair');
    const master = {
      _id: '507f1f77bcf86cd799439099',
      name: 'Vadim',
      role: 'master',
      permissions: [],
      isActive: true,
    };
    saleModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingSale),
    });
    employeeModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue(master),
    });
    saleModel.findByIdAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...existingSale,
        master: master._id,
        masterSnapshot: { name: master.name, role: master.role },
      }),
    });
    normalizeSalePayloadMock.mockReturnValue({
      kind: 'repair',
      status: 'new',
      paidAmount: 0,
      deviceName: 'System Block',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [],
      masterId: master._id,
      issuedById: '',
    });

    await updateSaleWorkspace(existingSale._id, {
      kind: 'repair',
      status: 'new',
      masterId: master._id,
      deviceName: 'System Block',
      serialNumber: '',
    });

    const updatePayload = saleModel.findByIdAndUpdate.mock.calls[0]?.[1];
    expect(updatePayload.master).toBe(master._id);
    expect(updatePayload.masterSnapshot).toEqual({
      name: 'Vadim',
      role: 'master',
    });
  });
});
