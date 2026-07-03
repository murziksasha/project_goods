import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct } from '../catalog-product/model';
import * as catalogProductService from '../catalog-product/service';
import { Client } from '../client/model';
import { Employee } from '../employee/model';
import { Product } from '../product/model';
import * as sequenceService from '../sequence/service';
import { Sale } from './model';
import { createSale } from './service';
import { leanResult, leanSelectResult, withFormatSaleFields } from './test-helpers';

const capturedSales: any[] = [];

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

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([]) as never);
  vi.spyOn(Sale, 'countDocuments').mockResolvedValue(0 as never);
  vi.spyOn(Sale.prototype, 'validate').mockResolvedValue(undefined as never);
  vi.spyOn(Sale.prototype, 'save').mockImplementation(async function saveSale(
    this: any,
  ) {
    const now = new Date('2026-05-31T10:00:00.000Z');
    this._id = this._id ?? '507f1f77bcf86cd799439099';
    this.createdAt = this.createdAt ?? now;
    this.updatedAt = this.updatedAt ?? now;
    capturedSales.push(this);
    return this;
  });
  vi.spyOn(Sale.prototype, 'toObject').mockImplementation(function toObject(
    this: any,
  ) {
    return withFormatSaleFields({
      _id: String(this._id),
      recordNumber: this.recordNumber,
      saleDate: this.saleDate,
      quantity: this.quantity,
      salePrice: this.salePrice,
      kind: this.kind,
      status: this.status,
      paidAmount: this.paidAmount ?? 0,
      isRapidSale: this.isRapidSale ?? false,
      note: this.note ?? '',
      timeline: this.timeline ?? [],
      paymentHistory: this.paymentHistory ?? [],
      lineItems: this.lineItems ?? [],
      discount: this.discount,
      client: this.client,
      clientSnapshot: this.clientSnapshot,
      product: this.product,
      productSnapshot: this.productSnapshot,
      manager: this.manager,
      managerSnapshot: this.managerSnapshot,
      master: this.master,
      masterSnapshot: this.masterSnapshot,
      issuedBy: this.issuedBy,
      issuedBySnapshot: this.issuedBySnapshot,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }) as never;
  });

  vi.spyOn(Client, 'findById').mockReturnValue(leanResult(client) as never);
  vi.spyOn(Employee, 'findById').mockImplementation((id: unknown) => {
    if (String(id) === manager._id) {
      return leanResult(manager) as never;
    }
    return leanResult(null) as never;
  });
  vi.spyOn(Product, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(CatalogProduct, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(CatalogProduct, 'countDocuments').mockResolvedValue(1 as never);
  vi.spyOn(sequenceService, 'getNextRecordNumber').mockResolvedValue('r000123');
  vi.spyOn(catalogProductService, 'upsertCatalogProducts').mockResolvedValue(
    undefined as never,
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  capturedSales.length = 0;
  installSpies();
});

describe('createSale product identity', () => {
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

    const salePayload = capturedSales[0];
    expect(salePayload).toMatchObject({
      product: null,
      productSnapshot: {
        name: 'USB hub',
      },
    });
    expect(salePayload.lineItems[0].productId).toBeNull();
    expect(String(salePayload.lineItems[0].catalogProductId)).toBe(
      '507f1f77bcf86cd799439031',
    );
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

    const salePayload = capturedSales[0];
    expect(salePayload.product).toBeNull();
    expect(String(salePayload.lineItems[0].productId)).toBe(
      '507f1f77bcf86cd799439041',
    );
    expect(salePayload.lineItems[0].catalogProductId).toBeNull();
  });

  it('creates a service-only sale item snapshot from the first service line', async () => {
    await createSale({
      ...basePayload,
      deviceName: 'Screen cleaning',
      lineItems: [
        {
          id: 'li-service',
          kind: 'service',
          serviceId: '507f1f77bcf86cd799439051',
          name: 'Screen cleaning',
          price: '150',
          quantity: '1',
          warrantyPeriod: '1',
        },
      ],
    });

    const salePayload = capturedSales[0];
    expect(salePayload.product).toBeNull();
    expect(salePayload.productSnapshot).toMatchObject({
      name: 'Screen cleaning',
    });
    expect(salePayload.lineItems[0]).toMatchObject({
      kind: 'service',
      name: 'Screen cleaning',
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

    const salePayload = capturedSales[0];
    expect(salePayload.product).toBeNull();
    expect(salePayload.lineItems[0]).toMatchObject({
      productId: null,
      catalogProductId: null,
    });
  });
});