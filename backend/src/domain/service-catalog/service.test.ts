import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Sale } from '../sale/model';
import { ServiceCatalog } from './model';
import {
  attachServiceCatalogIds,
  backfillMissingServicesFromSales,
  listServiceCatalogItems,
  resetServiceCatalogBackfillState,
  upsertServiceCatalogItem,
} from './service';

const serviceId = '507f1f77bcf86cd7994390aa';

const buildService = (name: string, patch: Record<string, unknown> = {}) => ({
  _id: { toString: () => String(patch.id ?? serviceId) },
  name,
  price: 100,
  salePriceOptions: [],
  note: '',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...patch,
});

const mockFindQuery = (items: unknown[]) => {
  const lean = vi.fn().mockResolvedValue(items);
  const limit = vi.fn().mockReturnThis();
  const sortResult = { limit, lean };
  const sort = vi.fn().mockReturnValue(sortResult);
  vi.spyOn(ServiceCatalog, 'find').mockReturnValue({ sort } as never);
  return { sort, limit, lean };
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  resetServiceCatalogBackfillState();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  vi.spyOn(ServiceCatalog, 'exists').mockResolvedValue({ _id: serviceId } as never);
  vi.spyOn(Sale, 'aggregate').mockResolvedValue([] as never);
});

describe('listServiceCatalogItems', () => {
  it('does not cap results when listing the full catalog', async () => {
    const items = Array.from({ length: 21 }, (_, index) =>
      buildService(`Service ${index}`, { id: `507f1f77bcf86cd7994390${index.toString().padStart(2, '0')}` }),
    );
    const { limit } = mockFindQuery(items);

    const result = await listServiceCatalogItems('');

    expect(limit).not.toHaveBeenCalled();
    expect(result).toHaveLength(21);
  });

  it('keeps autocomplete results capped at 20', async () => {
    const items = [buildService('Repair')];
    const { limit } = mockFindQuery(items);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(leanResult(null) as never);

    const result = await listServiceCatalogItems('Repair');

    expect(limit).toHaveBeenCalledWith(20);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Repair');
  });

  it('prepends an exact name match that fell outside the search page', async () => {
    mockFindQuery([buildService('Screen repair', { id: '507f1f77bcf86cd7994390bb' })]);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(
      leanResult(buildService('ремонт')) as never,
    );

    const result = await listServiceCatalogItems('ремонт');

    expect(result[0]).toMatchObject({ id: serviceId, name: 'ремонт' });
    expect(result).toHaveLength(2);
  });

  it('backfills missing catalog rows from sale service lines once', async () => {
    mockFindQuery([]);
    vi.spyOn(Sale, 'aggregate').mockResolvedValue([
      { name: 'ремонт', price: 750 },
    ] as never);
    vi.spyOn(ServiceCatalog, 'findById').mockReturnValue(leanResult(null) as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(leanResult(null) as never);
    vi.spyOn(ServiceCatalog.prototype, 'validate').mockResolvedValue(undefined as never);
    vi.spyOn(ServiceCatalog.prototype, 'save').mockImplementation(async function saveService(
      this: { _id?: { toString: () => string }; createdAt?: Date; updatedAt?: Date },
    ) {
      this._id = this._id ?? { toString: () => '507f1f77bcf86cd7994390cc' };
      this.createdAt = this.createdAt ?? new Date('2026-01-01T00:00:00.000Z');
      this.updatedAt = this.updatedAt ?? new Date('2026-01-01T00:00:00.000Z');
      return this;
    });
    vi.spyOn(ServiceCatalog.prototype, 'toObject').mockImplementation(function toObject(
      this: Record<string, unknown>,
    ) {
      return {
        _id: this._id,
        name: this.name,
        price: this.price,
        salePriceOptions: this.salePriceOptions ?? [],
        note: this.note ?? '',
        isActive: this.isActive ?? true,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    });

    await listServiceCatalogItems('');
    await listServiceCatalogItems('');

    expect(Sale.aggregate).toHaveBeenCalledTimes(1);
  });
});

describe('upsertServiceCatalogItem', () => {
  it('reuses an existing row by id', async () => {
    vi.spyOn(ServiceCatalog, 'findById').mockReturnValue(
      leanResult(buildService('Diagnostics')) as never,
    );
    const findOne = vi.spyOn(ServiceCatalog, 'findOne');

    const result = await upsertServiceCatalogItem({
      name: 'Other',
      price: 10,
      serviceId,
    });

    expect(result).toMatchObject({ id: serviceId, name: 'Diagnostics' });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('reuses an existing row by case-insensitive name', async () => {
    vi.spyOn(ServiceCatalog, 'findById').mockReturnValue(leanResult(null) as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(
      leanResult(buildService('Ремонт')) as never,
    );

    const result = await upsertServiceCatalogItem({
      name: 'ремонт',
      price: 750,
    });

    expect(result).toMatchObject({ id: serviceId, name: 'Ремонт' });
  });

  it('creates a catalog row when the name is missing', async () => {
    vi.spyOn(ServiceCatalog, 'findById').mockReturnValue(leanResult(null) as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(leanResult(null) as never);
    vi.spyOn(ServiceCatalog.prototype, 'validate').mockResolvedValue(undefined as never);
    vi.spyOn(ServiceCatalog.prototype, 'save').mockImplementation(async function saveService(
      this: { _id?: { toString: () => string }; createdAt?: Date; updatedAt?: Date },
    ) {
      this._id = { toString: () => '507f1f77bcf86cd7994390dd' };
      this.createdAt = new Date('2026-01-01T00:00:00.000Z');
      this.updatedAt = new Date('2026-01-01T00:00:00.000Z');
      return this;
    });
    vi.spyOn(ServiceCatalog.prototype, 'toObject').mockImplementation(function toObject(
      this: Record<string, unknown>,
    ) {
      return {
        _id: this._id,
        name: this.name,
        price: this.price,
        salePriceOptions: this.salePriceOptions ?? [],
        note: this.note ?? '',
        isActive: this.isActive ?? true,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    });

    const result = await upsertServiceCatalogItem({
      name: 'ремонт',
      price: 750,
    });

    expect(result).toMatchObject({
      id: '507f1f77bcf86cd7994390dd',
      name: 'ремонт',
      price: 750,
    });
  });
});

describe('attachServiceCatalogIds', () => {
  it('sets serviceId on service lines and leaves products unchanged', async () => {
    vi.spyOn(ServiceCatalog, 'findById').mockReturnValue(leanResult(null) as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(
      leanResult(buildService('ремонт')) as never,
    );

    const result = await attachServiceCatalogIds([
      {
        id: 'p1',
        kind: 'product',
        name: 'Cable',
        price: 10,
      },
      {
        id: 's1',
        kind: 'service',
        name: 'ремонт',
        price: 750,
      },
    ]);

    expect(result[0]).toEqual({
      id: 'p1',
      kind: 'product',
      name: 'Cable',
      price: 10,
    });
    expect(result[1]).toMatchObject({
      id: 's1',
      kind: 'service',
      name: 'ремонт',
      serviceId,
    });
  });
});

describe('backfillMissingServicesFromSales', () => {
  it('upserts distinct service names from sales', async () => {
    vi.spyOn(Sale, 'aggregate').mockResolvedValue([
      { name: 'ремонт', price: 750 },
      { name: 'Diagnostics', price: 250 },
    ] as never);
    const findOne = vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(
      leanResult(buildService('ремонт')) as never,
    );

    await backfillMissingServicesFromSales();

    expect(Sale.aggregate).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});
