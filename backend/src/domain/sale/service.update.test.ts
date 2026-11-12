import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct } from '../catalog-product/model';
import * as catalogProductService from '../catalog-product/service';
import * as serviceCatalogService from '../service-catalog/service';
import { Client } from '../client/model';
import { Employee } from '../employee/model';
import { Product } from '../product/model';
import { Sale } from './model';
import { updateSale } from './service';
import { leanResult, leanSelectResult, withFormatSaleFields } from './test-helpers';

const saleId = '507f1f77bcf86cd799439012';
const clientId = '507f1f77bcf86cd799439011';
const capturedAt = new Date('2026-09-15T12:00:00.000Z');

const client = {
  _id: clientId,
  name: 'Client',
  phone: '+380000000000',
  status: 'new',
};

const capturedCostSnapshot = {
  status: 'known' as const,
  unitCost: 200,
  totalCost: 200,
  method: 'fixed' as const,
  laborCost: 200,
  directExpenses: 0,
  recordedMinutes: null,
  hourlyCost: null,
  fixedCost: 200,
  capturedAt,
  capturedById: '507f1f77bcf86cd799439070',
  capturedByName: 'Olga Finance',
};

const capturedAuditedCost = {
  ...capturedCostSnapshot,
  unitCost: 220,
  totalCost: 220,
};

const capturedCostAuditLog = [
  {
    id: 'audit-1',
    previousStatus: 'known' as const,
    previousUnitCost: 200,
    previousTotalCost: 200,
    newStatus: 'known' as const,
    newUnitCost: 220,
    newTotalCost: 220,
    method: 'fixed' as const,
    directExpenses: 0,
    recordedMinutes: null,
    hourlyCost: null,
    fixedCost: 220,
    reason: 'Price correction',
    authorId: '507f1f77bcf86cd799439070',
    authorName: 'Olga Finance',
    changedAt: capturedAt,
  },
];

const costedServiceLine = {
  id: 'li-svc-costed',
  kind: 'service',
  name: 'Diagnostics',
  price: 500,
  quantity: 1,
  warrantyPeriod: 0,
  serialNumbers: [],
  costMethod: 'fixed',
  fixedCost: 200,
  costSnapshot: capturedCostSnapshot,
  auditedCost: capturedAuditedCost,
  costAuditLog: capturedCostAuditLog,
};

const masterWithoutFinance = {
  _id: { toString: () => '507f1f77bcf86cd799439080' },
  name: 'Даніїл Євгенович',
  role: 'master',
  permissions: [
    'orders.view',
    'orders.manage',
    'orders.chat',
    'repairs.execute',
    'sales.manage',
    'kanban.use',
    'clients.manage',
    'inventory.manage',
    'finance.transactions.deposit',
    'finance.orders.pay',
  ],
  isActive: true,
};

const updateCalls: any[] = [];
let currentSale: any;

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(catalogProductService, 'upsertCatalogProducts').mockResolvedValue(
    undefined as never,
  );
  vi.spyOn(serviceCatalogService, 'attachServiceCatalogIds').mockImplementation(
    async (items) => items,
  );
  vi.spyOn(CatalogProduct, 'countDocuments').mockResolvedValue(0 as never);
  vi.spyOn(CatalogProduct, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([]) as never);
  vi.spyOn(Sale, 'countDocuments').mockResolvedValue(1 as never);
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
  vi.spyOn(Client, 'findById').mockReturnValue(leanResult(client) as never);
  vi.spyOn(Employee, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(Product, 'findById').mockReturnValue(leanResult(null) as never);
  vi.spyOn(Product, 'findByIdAndUpdate').mockReturnValue(
    leanResult(null) as never,
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  updateCalls.length = 0;
  currentSale = withFormatSaleFields({
    _id: saleId,
    kind: 'repair',
    status: 'new',
    paidAmount: 0,
    salePrice: 500,
    quantity: 1,
    product: null,
    productSnapshot: {
      article: 'REPAIR',
      name: 'System Block',
      serialNumber: '',
    },
    timeline: [],
    paymentHistory: [],
    lineItems: [structuredClone(costedServiceLine)],
    discount: { mode: 'amount', value: 0 },
    master: null,
    issuedBy: null,
    masterSnapshot: null,
    issuedBySnapshot: null,
    firstStockCommittedAt: capturedAt,
    createdAt: new Date('2026-05-23T10:00:00.000Z'),
    updatedAt: new Date('2026-05-23T10:00:00.000Z'),
    client: clientId,
  });
  installSpies();
});

describe('updateSale without finance.view', () => {
  it('allows a master without finance.view to update when line items omit cost fields', async () => {
    await updateSale(
      saleId,
      {
        saleDate: '2026-05-31T10:00:00.000Z',
        clientId,
        productId: '',
        quantity: 1,
        salePrice: 500,
        note: '',
        userNote: '',
        managerId: '',
        masterId: '',
        issuedById: '',
        kind: 'repair',
        status: 'new',
        paidAmount: 0,
        timeline: [],
        paymentHistory: [],
        lineItems: [
          {
            id: costedServiceLine.id,
            kind: costedServiceLine.kind,
            name: costedServiceLine.name,
            price: costedServiceLine.price,
            quantity: costedServiceLine.quantity,
            warrantyPeriod: costedServiceLine.warrantyPeriod,
            serialNumbers: costedServiceLine.serialNumbers,
          },
        ],
        discount: { mode: 'amount', value: 0 },
        deviceName: 'System Block',
        serialNumber: '',
      },
      masterWithoutFinance as never,
    );

    expect(updateCalls).toHaveLength(1);
    const saved = updateCalls[0].lineItems[0];
    expect(saved.id).toBe(costedServiceLine.id);
    expect(saved.costSnapshot).toEqual(capturedCostSnapshot);
    expect(saved.auditedCost).toEqual(capturedAuditedCost);
    expect(saved.costAuditLog).toEqual(capturedCostAuditLog);
  });
});
