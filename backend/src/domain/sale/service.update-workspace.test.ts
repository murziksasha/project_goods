import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct } from '../catalog-product/model';
import * as catalogProductService from '../catalog-product/service';
import { Employee } from '../employee/model';
import { Product } from '../product/model';
import * as errors from '../../shared/lib/errors';
import * as parsers from '../../shared/lib/parsers';
import { Sale } from './model';
import { updateSaleWorkspace } from './service';
import { leanResult, leanSelectResult, withFormatSaleFields } from './test-helpers';

const saleId = '507f1f77bcf86cd799439012';

const buildExistingSale = (kind: 'repair' | 'sale') =>
  withFormatSaleFields({
    _id: saleId,
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
    createdAt: new Date('2026-05-23T10:00:00.000Z'),
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

let currentSale: any;
let productFindByIdResult: any;
const updateCalls: any[] = [];

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(errors, 'assertNotStale').mockImplementation(() => undefined);
  vi.spyOn(catalogProductService, 'upsertCatalogProducts').mockResolvedValue(
    undefined as never,
  );
  vi.spyOn(CatalogProduct, 'countDocuments').mockResolvedValue(0 as never);

  vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([]) as never);
  vi.spyOn(Sale, 'findById').mockImplementation(
    () => leanResult(currentSale) as never,
  );
  vi.spyOn(Sale, 'findByIdAndUpdate').mockImplementation(
    (_id: unknown, update: any) => {
      updateCalls.push(update);
      return leanResult(
        withFormatSaleFields({ ...currentSale, ...update }),
      ) as never;
    },
  );

  vi.spyOn(Product, 'findById').mockImplementation(
    () => leanResult(productFindByIdResult) as never,
  );
  vi.spyOn(Product, 'findByIdAndUpdate').mockReturnValue(
    leanResult({
      _id: '507f1f77bcf86cd799439012',
      quantity: 9,
      reservedQuantity: 0,
    }) as never,
  );
  vi.spyOn(Employee, 'findById').mockReturnValue(leanResult(null) as never);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  currentSale = buildExistingSale('repair');
  productFindByIdResult = {
    _id: '507f1f77bcf86cd799439012',
    quantity: 10,
    reservedQuantity: 0,
  };
  updateCalls.length = 0;
  installSpies();
});

describe('updateSaleWorkspace line items', () => {
  it('keeps product line item name for repair orders', async () => {
    currentSale = buildExistingSale('repair');
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'new',
      lineItems: [lineItem],
    });

    expect(updateCalls[0].lineItems[0].name).toBe('Wireless Mouse');
  });

  it('keeps product line item name for sale orders', async () => {
    currentSale = buildExistingSale('sale');
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'sale',
      status: 'new',
      lineItems: [lineItem],
    });

    expect(updateCalls[0].lineItems[0].name).toBe('Wireless Mouse');
  });

  it('reopens paid sale to new when adding products that leave unpaid balance', async () => {
    const serviceOnlyLine = {
      id: 'li-svc',
      kind: 'service',
      name: 'Diagnostics',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: [],
    };
    currentSale = withFormatSaleFields({
      ...buildExistingSale('sale'),
      status: 'paid',
      paidAmount: 100,
      lineItems: [serviceOnlyLine],
    });
    const nextItems = [serviceOnlyLine, lineItem];
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
      kind: 'sale',
      status: 'paid',
      paidAmount: 100,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: nextItems,
      masterId: '',
      issuedById: '',
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'sale',
      status: 'paid',
      paidAmount: 100,
      lineItems: nextItems,
    });

    expect(updateCalls[0].status).toBe('new');
    expect(updateCalls[0].lineItems).toHaveLength(2);
    expect(updateCalls[0].lineItems[1].name).toBe('Wireless Mouse');
  });

  it('rejects issued sale workspace update with unpaid product balance', async () => {
    currentSale = withFormatSaleFields({
      ...buildExistingSale('sale'),
      status: 'issued',
      paidAmount: 100,
      lineItems: [],
    });
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
      kind: 'sale',
      status: 'issued',
      paidAmount: 100,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [lineItem],
      masterId: '',
      issuedById: '',
    } as never);

    await expect(
      updateSaleWorkspace(currentSale._id, {
        kind: 'sale',
        status: 'issued',
        paidAmount: 100,
        lineItems: [lineItem],
      }),
    ).rejects.toThrow('Product shipped but payment has not been received.');
  });

  it('keeps names for multiple product line items', async () => {
    currentSale = buildExistingSale('repair');
    const nextItems = [lineItem, secondLineItem];
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'new',
      lineItems: nextItems,
    });

    expect(updateCalls[0].lineItems).toHaveLength(2);
    expect(updateCalls[0].lineItems[0].name).toBe('Wireless Mouse');
    expect(updateCalls[0].lineItems[1].name).toBe('Keyboard');
  });

  it('rejects serialized line items with quantity greater than 1', async () => {
    currentSale = buildExistingSale('sale');
    const invalidItem = { ...serializedLineItem, quantity: 2 };
    productFindByIdResult = {
      _id: serializedLineItem.productId,
      quantity: 1,
      reservedQuantity: 0,
      serialNumber: 'S000020',
    };
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await expect(
      updateSaleWorkspace(currentSale._id, {
        kind: 'sale',
        status: 'new',
        lineItems: [invalidItem],
      }),
    ).rejects.toThrow(
      'Serialized product line items must contain exactly one serial number and quantity 1.',
    );
  });

  it('rejects serialized line items linked to a different stock product', async () => {
    currentSale = buildExistingSale('sale');
    productFindByIdResult = {
      _id: serializedLineItem.productId,
      quantity: 1,
      reservedQuantity: 0,
      serialNumber: 'S000021',
    };
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await expect(
      updateSaleWorkspace(currentSale._id, {
        kind: 'sale',
        status: 'new',
        lineItems: [serializedLineItem],
      }),
    ).rejects.toThrow(
      'Serialized product line item must reference the matching stock product.',
    );
  });

  it('rejects quantity greater than 1 for a serialized stock product without a bound serial', async () => {
    currentSale = buildExistingSale('sale');
    const invalidItem = {
      ...serializedLineItem,
      quantity: 2,
      serialNumbers: [],
    };
    productFindByIdResult = {
      _id: serializedLineItem.productId,
      quantity: 2,
      reservedQuantity: 0,
      serialNumber: 'S000020',
    };
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await expect(
      updateSaleWorkspace(currentSale._id, {
        kind: 'sale',
        status: 'new',
        lineItems: [invalidItem],
      }),
    ).rejects.toThrow(
      'Serialized stock products cannot be sold with quantity greater than 1.',
    );
  });

  it('decrements stock for repair orders when status becomes issued', async () => {
    currentSale = buildExistingSale('repair');
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'issued',
      paidAmount: 150,
      lineItems: [lineItem],
    });

    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
      lineItem.productId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' },
    );
  });

  it('decrements stock for paid repair orders with bound serials when status becomes issued', async () => {
    currentSale = buildExistingSale('repair');
    productFindByIdResult = {
      _id: serializedLineItem.productId,
      quantity: 1,
      reservedQuantity: 0,
      serialNumber: 'S000020',
    };
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'issued',
      paidAmount: 500,
      lineItems: [serializedLineItem],
    });

    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
      serializedLineItem.productId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' },
    );
  });

  it('rejects repair refusal status while bound serials are still attached', async () => {
    currentSale = buildExistingSale('repair');
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await expect(
      updateSaleWorkspace(currentSale._id, {
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
    currentSale = buildExistingSale('repair');
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'inRepair',
      lineItems: [lineItem],
    });

    expect(Product.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps sale stock behavior unchanged for issued status', async () => {
    currentSale = buildExistingSale('sale');
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'sale',
      status: 'issued',
      paidAmount: 150,
      lineItems: [lineItem],
    });

    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
      lineItem.productId,
      { $inc: { quantity: -1 } },
      { returnDocument: 'after' },
    );
  });

  it('persists updated master and master snapshot from workspace main info', async () => {
    currentSale = buildExistingSale('repair');
    const master = {
      _id: '507f1f77bcf86cd799439099',
      name: 'Vadim',
      role: 'master',
      permissions: [],
      isActive: true,
    };
    vi.spyOn(Employee, 'findById').mockReturnValue(leanResult(master) as never);
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
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
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'new',
      masterId: master._id,
      deviceName: 'System Block',
      serialNumber: '',
    });

    expect(updateCalls[0].master).toBe(master._id);
    expect(updateCalls[0].masterSnapshot).toEqual({
      name: 'Vadim',
      role: 'master',
    });
  });

  it('updates userNote without changing system note', async () => {
    currentSale = withFormatSaleFields({
      ...buildExistingSale('repair'),
      note: '(kits: charger)\nType: repair',
      userNote: '',
    });
    vi.spyOn(parsers, 'normalizeSalePayload').mockReturnValue({
      kind: 'repair',
      status: 'new',
      paidAmount: 0,
      deviceName: '',
      serialNumber: '',
      discount: { mode: 'amount', value: 0 },
      timeline: [],
      paymentHistory: [],
      lineItems: [],
      masterId: '',
      issuedById: '',
      note: '(kits: charger)\nType: repair',
      userNote: 'Call client before pickup',
    } as never);

    await updateSaleWorkspace(currentSale._id, {
      kind: 'repair',
      status: 'new',
      userNote: 'Call client before pickup',
    });

    expect(updateCalls[0].userNote).toBe('Call client before pickup');
    expect(updateCalls[0].note).toBeUndefined();
  });
});