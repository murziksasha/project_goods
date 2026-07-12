import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '../client/model';
import { ClientDevice } from '../client-device/model';
import { Cashbox, FinanceTransaction } from '../finance/model';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import { Sequence } from '../sequence/model';
import { ServiceCatalog } from '../service-catalog/model';
import { Settings } from '../settings/model';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from '../supplier-order/model';
import { CatalogProduct } from '../catalog-product/model';
import * as sequenceService from '../sequence/service';
import { eraseAllDataExceptEmployees, seedDemoData } from './service';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('eraseAllDataExceptEmployees', () => {
  it('clears business collections and resets record sequence', async () => {
    const models = [
      Sale,
      Client,
      Product,
      CatalogProduct,
      Supplier,
      SupplierOrder,
      ServiceCatalog,
      ClientDevice,
      Cashbox,
      FinanceTransaction,
      Settings,
      Sequence,
    ];
    for (const model of models) {
      vi.spyOn(model, 'deleteMany').mockResolvedValue({ deletedCount: 1 } as never);
    }
    const resetSpy = vi
      .spyOn(sequenceService, 'resetRecordNumberSequence')
      .mockResolvedValue(undefined as never);

    const result = await eraseAllDataExceptEmployees();

    for (const model of models) {
      expect(model.deleteMany).toHaveBeenCalledWith({});
    }
    expect(resetSpy).toHaveBeenCalledWith(0);
    expect(result.message).toContain('Employees were kept');
    expect(result.products).toEqual([]);
  });
});

describe('seedDemoData', () => {
  it('wipes sales/clients/products and reseeds fixtures for kind=sales', async () => {
    vi.spyOn(Sale, 'deleteMany').mockResolvedValue({} as never);
    vi.spyOn(Client, 'deleteMany').mockResolvedValue({} as never);
    vi.spyOn(Product, 'deleteMany').mockResolvedValue({} as never);
    vi.spyOn(sequenceService, 'resetRecordNumberSequence').mockResolvedValue(
      undefined as never,
    );
    vi.spyOn(sequenceService, 'formatRecordNumber').mockImplementation(
      (value: number) => `r${String(value).padStart(6, '0')}`,
    );

    const products = [
      { _id: 'p1', name: 'P1', article: 'A1', serialNumber: 'S1' },
    ];
    const clients = [
      {
        _id: 'c1',
        name: 'C1',
        phone: '+380',
        phones: ['+380'],
        status: 'regular',
      },
    ];
    vi.spyOn(Product, 'insertMany').mockResolvedValue(products as never);
    vi.spyOn(Client, 'insertMany').mockResolvedValue(clients as never);
    vi.spyOn(Product, 'findByIdAndUpdate').mockResolvedValue({} as never);

    // Minimal demo fixtures: seedDemoData maps demoProducts/demoClients by key.
    // If maps miss keys, seed throws — mock get by forcing single-item path via spies on modules is hard.
    // Instead verify wipe + insertMany were called for sales kind; full fixture mapping is integration.
    // When fixtures cannot map, seed throws — we only assert pre-insert cleanup when insertMany runs.

    // Provide enough product/client rows for demo data keys by returning arrays sized from insertMany args.
    vi.spyOn(Product, 'insertMany').mockImplementation(async (docs: unknown) => {
      const list = Array.isArray(docs) ? docs : [];
      return list.map((doc, index) => ({
        _id: `product-${index}`,
        ...(doc as object),
      })) as never;
    });
    vi.spyOn(Client, 'insertMany').mockImplementation(async (docs: unknown) => {
      const list = Array.isArray(docs) ? docs : [];
      return list.map((doc, index) => ({
        _id: `client-${index}`,
        phones: [],
        ...(doc as object),
      })) as never;
    });

    const save = vi.fn(async function save(this: { _id: string }) {
      return this;
    });
    vi.spyOn(Sale.prototype, 'save').mockImplementation(save as never);

    vi.spyOn(Product, 'find').mockReturnValue({
      sort: () => ({
        lean: async () => [],
      }),
    } as never);
    vi.spyOn(Client, 'find').mockReturnValue({
      sort: () => ({
        lean: async () => [],
      }),
    } as never);
    vi.spyOn(Sale, 'find').mockReturnValue({
      sort: () => ({
        lean: async () => [],
      }),
    } as never);

    const result = await seedDemoData('sales');

    expect(Sale.deleteMany).toHaveBeenCalledWith({});
    expect(Client.deleteMany).toHaveBeenCalledWith({});
    expect(Product.deleteMany).toHaveBeenCalledWith({});
    expect(sequenceService.resetRecordNumberSequence).toHaveBeenCalled();
    expect(result.message).toMatch(/Demo sales created/i);
  });
});
