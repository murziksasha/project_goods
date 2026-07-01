import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct } from '../catalog-product/model';
import * as catalogProductService from '../catalog-product/service';
import * as rapidSaleClient from '../client/rapid-sale-client';
import { Employee } from '../employee/model';
import { Product } from '../product/model';
import * as sequenceService from '../sequence/service';
import { Sale } from './model';
import { createSale } from './service';
import { leanResult, leanSelectResult, withFormatSaleFields } from './test-helpers';

const capturedSales: any[] = [];

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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }) as never;
  });

  vi.spyOn(rapidSaleClient, 'getOrCreateRapidSaleClient').mockResolvedValue(
    rapidClient as never,
  );
  vi.spyOn(Employee, 'findById').mockImplementation((id: unknown) => {
    if (String(id) === manager._id) {
      return leanResult(manager) as never;
    }
    return leanResult(null) as never;
  });
  vi.spyOn(Product, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(Product, 'findByIdAndUpdate').mockReturnValue(
    leanResult(stockProduct) as never,
  );
  vi.spyOn(CatalogProduct, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(CatalogProduct, 'countDocuments').mockResolvedValue(0 as never);
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

describe('createSale rapid sale', () => {
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

    const salePayload = capturedSales[0];
    expect(salePayload.isRapidSale).toBe(true);
    expect(salePayload.kind).toBe('sale');
    expect(String(salePayload.client)).toBe(rapidClient._id);
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