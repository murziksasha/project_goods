import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saleCtor,
  saleModel,
  clientModel,
  employeeModel,
  productModel,
  catalogProductModel,
  getNextRecordNumberMock,
  getOrCreateRapidSaleClientMock,
} = vi.hoisted(() => {
  const ctor = vi.fn(function SaleMock(this: Record<string, unknown>, payload: object) {
    Object.assign(this, payload, {
      _id: '507f1f77bcf86cd799439099',
      createdAt: new Date('2026-05-31T10:00:00.000Z'),
      updatedAt: new Date('2026-05-31T10:00:00.000Z'),
    });
    this.validate = vi.fn().mockResolvedValue(undefined);
    this.save = vi.fn().mockResolvedValue(this);
    this.toObject = vi.fn(() => this);
  });

  return {
    saleCtor: ctor,
    saleModel: Object.assign(ctor, {
      find: vi.fn(),
      countDocuments: vi.fn(),
    }),
    clientModel: {
      findById: vi.fn(),
    },
    employeeModel: {
      findById: vi.fn(),
    },
    productModel: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    catalogProductModel: {
      findById: vi.fn(),
      countDocuments: vi.fn(),
    },
    getNextRecordNumberMock: vi.fn(),
    getOrCreateRapidSaleClientMock: vi.fn(),
  };
});

vi.mock('./model', () => ({
  Sale: saleModel,
}));

vi.mock('../client/model', () => ({
  Client: clientModel,
}));

vi.mock('../client/rapid-sale-client', () => ({
  getOrCreateRapidSaleClient: getOrCreateRapidSaleClientMock,
}));

vi.mock('../employee/model', () => ({
  Employee: employeeModel,
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: catalogProductModel,
}));

vi.mock('../product/model', () => ({
  Product: productModel,
}));

vi.mock('../../shared/lib/formatters', () => ({
  formatProduct: vi.fn((value) => value),
  formatSale: vi.fn((value) => value),
}));

vi.mock('../../shared/lib/query', () => ({
  isValidObjectIdOrThrow: vi.fn(),
}));

vi.mock('../sequence/service', () => ({
  getNextRecordNumber: getNextRecordNumberMock,
}));

vi.mock('../finance/service', () => ({
  createFinanceTransaction: vi.fn(),
}));

vi.mock('../../shared/lib/errors', () => ({
  assertNotStale: vi.fn(),
}));

vi.mock('../catalog-product/service', () => ({
  upsertCatalogProducts: vi.fn(),
}));

import { createSale } from './service';

const rapidClient = {
  _id: '507f1f77bcf86cd799439099',
  name: 'Rapid Sale',
  phone: '+380000000001',
  status: '',
};

const manager = {
  _id: '507f1f77bcf86cd799439021',
  name: 'Manager',
  role: 'manager',
  permissions: ['orders.manage'],
  isActive: true,
};

const stockProduct = {
  _id: '507f1f77bcf86cd799439041',
  name: 'HDMI Cable',
  article: 'HDMI-1',
  serialNumber: '',
  quantity: 5,
  reservedQuantity: 0,
  price: 100,
  salePriceOptions: [150],
};

const baseRapidPayload = {
  saleDate: '2026-05-31T10:00:00.000Z',
  clientId: '',
  productId: '',
  quantity: '1',
  salePrice: '550',
  note: '',
  managerId: manager._id,
  masterId: '',
  issuedById: '',
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  timeline: [],
  paymentHistory: [],
  isRapidSale: true,
};

const leanResult = <T,>(value: T) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe('createSale rapid sale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    getOrCreateRapidSaleClientMock.mockResolvedValue(rapidClient);
    employeeModel.findById.mockReturnValue(leanResult(manager));
    productModel.findById.mockReturnValue(leanResult(null));
    productModel.findByIdAndUpdate.mockReturnValue(leanResult(stockProduct));
    catalogProductModel.findById.mockReturnValue(leanResult(null));
    catalogProductModel.countDocuments.mockResolvedValue(0);
    saleModel.countDocuments.mockResolvedValue(0);
    getNextRecordNumberMock.mockResolvedValue('r000123');
  });

  it('creates a rapid sale with stock product and service line items', async () => {
    await createSale({
      ...baseRapidPayload,
      lineItems: [
        {
          id: 'li-stock',
          kind: 'product',
          productId: stockProduct._id,
          name: 'HDMI Cable',
          price: '150',
          quantity: '1',
          warrantyPeriod: '0',
        },
        {
          id: 'li-service',
          kind: 'service',
          serviceId: '507f1f77bcf86cd799439051',
          name: 'Setup',
          price: '400',
          quantity: '1',
          warrantyPeriod: '1',
        },
      ],
    });

    const salePayload = saleCtor.mock.calls[0][0];
    expect(salePayload).toMatchObject({
      isRapidSale: true,
      kind: 'sale',
      client: rapidClient._id,
    });
    expect(salePayload.lineItems).toHaveLength(2);
  });

  it('rejects rapid sale without line items', async () => {
    await expect(createSale({ ...baseRapidPayload, lineItems: [] })).rejects.toThrow(
      'Rapid sale must contain at least one line item.',
    );
  });

  it('rejects rapid sale with manual product line', async () => {
    await expect(
      createSale({
        ...baseRapidPayload,
        lineItems: [
          {
            id: 'li-manual',
            kind: 'product',
            productId: '',
            name: 'Manual item',
            price: '200',
            quantity: '1',
            warrantyPeriod: '0',
          },
        ],
      }),
    ).rejects.toThrow('Rapid sale product lines must be linked to warehouse stock.');
  });

  it('rejects rapid sale with catalog-only product line', async () => {
    await expect(
      createSale({
        ...baseRapidPayload,
        lineItems: [
          {
            id: 'li-catalog',
            kind: 'product',
            productId: '',
            catalogProductId: '507f1f77bcf86cd799439031',
            name: 'USB hub',
            price: '400',
            quantity: '1',
            warrantyPeriod: '0',
          },
        ],
      }),
    ).rejects.toThrow('Rapid sale product lines must be linked to warehouse stock.');
  });
});