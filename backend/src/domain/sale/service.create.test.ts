import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  saleCtor,
  saleModel,
  clientModel,
  employeeModel,
  productModel,
  catalogProductModel,
  getNextRecordNumberMock,
  upsertCatalogProductsMock,
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
    upsertCatalogProductsMock: vi.fn(),
  };
});

vi.mock('./model', () => ({
  Sale: saleModel,
}));

vi.mock('../client/model', () => ({
  Client: clientModel,
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
  upsertCatalogProducts: upsertCatalogProductsMock,
}));

import { createSale } from './service';

const client = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Oleksandr Grygoriev',
  phone: '+380635567090',
  status: 'new',
};

const manager = {
  _id: '507f1f77bcf86cd799439021',
  name: 'Manager',
  role: 'manager',
  permissions: ['orders.manage'],
  isActive: true,
};

const basePayload = {
  saleDate: '2026-05-31T10:00:00.000Z',
  clientId: client._id,
  productId: '',
  quantity: '1',
  salePrice: '400',
  note: '',
  managerId: manager._id,
  masterId: '',
  issuedById: '',
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  timeline: [],
  paymentHistory: [],
};

const leanResult = <T,>(value: T) => ({
  lean: vi.fn().mockResolvedValue(value),
});

describe('createSale product identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saleModel.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    clientModel.findById.mockReturnValue(leanResult(client));
    employeeModel.findById.mockReturnValue(leanResult(manager));
    productModel.findById.mockReturnValue(leanResult(null));
    catalogProductModel.findById.mockReturnValue(leanResult(null));
    catalogProductModel.countDocuments.mockResolvedValue(1);
    getNextRecordNumberMock.mockResolvedValue('r000123');
  });

  it('creates a catalog sale item without setting Sale.product', async () => {
    await createSale({
      ...basePayload,
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
    });

    const salePayload = saleCtor.mock.calls[0][0];
    expect(salePayload).toMatchObject({
      product: null,
      productSnapshot: {
        name: 'USB hub',
      },
    });
    expect(salePayload.lineItems[0]).toMatchObject({
      productId: undefined,
      catalogProductId: '507f1f77bcf86cd799439031',
    });
  });

  it('creates a stock sale item with only line item productId', async () => {
    await createSale({
      ...basePayload,
      lineItems: [
        {
          id: 'li-stock',
          kind: 'product',
          productId: '507f1f77bcf86cd799439041',
          catalogProductId: '',
          name: 'HDMI Cable',
          price: '200',
          quantity: '1',
          warrantyPeriod: '0',
        },
      ],
    });

    const salePayload = saleCtor.mock.calls[0][0];
    expect(salePayload.product).toBeNull();
    expect(salePayload.lineItems[0]).toMatchObject({
      productId: '507f1f77bcf86cd799439041',
      catalogProductId: undefined,
    });
  });

  it('creates a manual sale item without object id fields', async () => {
    await createSale({
      ...basePayload,
      lineItems: [
        {
          id: 'li-manual',
          kind: 'product',
          productId: '',
          catalogProductId: '',
          name: 'Manual item',
          price: '200',
          quantity: '1',
          warrantyPeriod: '0',
        },
      ],
    });

    const salePayload = saleCtor.mock.calls[0][0];
    expect(salePayload.product).toBeNull();
    expect(salePayload.lineItems[0]).toMatchObject({
      productId: undefined,
      catalogProductId: undefined,
    });
  });
});
