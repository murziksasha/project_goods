import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Sale } from '../sale/model';
import { ServiceCatalog } from './model';
import { HttpError } from '../../shared/lib/errors';
import {
  attachServiceCatalogIds,
  backfillMissingServicesFromSales,
  createServiceCatalogItem,
  listServiceCatalogItems,
  mergeDuplicateServiceCatalogItems,
  resetServiceCatalogBackfillState,
  updateServiceCatalogItem,
  upsertServiceCatalogItem,
} from './service';

const serviceId = '507f1f77bcf86cd7994390aa';

const buildService = (name: string, patch: Record<string, unknown> = {}) => ({
  _id: { toString: () => String(patch.id ?? serviceId) },
  name,
  nameKey: String(name).trim().replace(/\s+/g, ' ').toLowerCase(),
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

  it('reuses an existing row when create races with a duplicate name', async () => {
    vi.spyOn(ServiceCatalog, 'findById').mockReturnValue(leanResult(null) as never);
    const findOne = vi.spyOn(ServiceCatalog, 'findOne').mockReturnValueOnce(
      leanResult(null) as never,
    );
    findOne.mockReturnValueOnce(leanResult(null) as never);
    findOne.mockReturnValue(leanResult(buildService('Ремонт')) as never);
    vi.spyOn(ServiceCatalog.prototype, 'validate').mockResolvedValue(undefined as never);
    vi.spyOn(ServiceCatalog.prototype, 'save').mockRejectedValue({
      code: 11000,
      keyPattern: { nameKey: 1 },
    });

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

const mockWritableService = (name: string, patch: Record<string, unknown> = {}) => {
  vi.spyOn(ServiceCatalog.prototype, 'validate').mockResolvedValue(undefined as never);
  vi.spyOn(ServiceCatalog.prototype, 'save').mockImplementation(async function saveService(
    this: { _id?: { toString: () => string }; createdAt?: Date; updatedAt?: Date },
  ) {
    this._id = this._id ?? { toString: () => String(patch.id ?? '507f1f77bcf86cd7994390ee') };
    this.createdAt = this.createdAt ?? new Date('2026-01-01T00:00:00.000Z');
    this.updatedAt = this.updatedAt ?? new Date('2026-01-01T00:00:00.000Z');
    return this;
  });
  vi.spyOn(ServiceCatalog.prototype, 'toObject').mockImplementation(function toObject(
    this: Record<string, unknown>,
  ) {
    return {
      _id: this._id ?? { toString: () => String(patch.id ?? '507f1f77bcf86cd7994390ee') },
      name: this.name ?? name,
      price: this.price ?? 100,
      salePriceOptions: this.salePriceOptions ?? [],
      note: this.note ?? '',
      isActive: this.isActive ?? true,
      createdAt: this.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: this.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    };
  });
};

describe('createServiceCatalogItem', () => {
  it('rejects a duplicate name case-insensitively', async () => {
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(
      leanResult(buildService('Ремонт')) as never,
    );

    await expect(
      createServiceCatalogItem({ name: '  ремонт  ', price: 100 }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Service with this name already exists.',
    });
  });

  it('creates a unique service name', async () => {
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(leanResult(null) as never);
    mockWritableService('Diagnostics');

    const result = await createServiceCatalogItem({ name: 'Diagnostics', price: 250 });

    expect(result).toMatchObject({
      name: 'Diagnostics',
      price: 250,
    });
  });
});

describe('updateServiceCatalogItem', () => {
  it('rejects renaming onto an existing service name', async () => {
    const current = {
      ...buildService('Diagnostics'),
      save: vi.fn(),
      validate: vi.fn(),
      toObject: vi.fn(),
    };
    vi.spyOn(ServiceCatalog, 'findById').mockResolvedValue(current as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(
      leanResult(buildService('Ремонт', { id: '507f1f77bcf86cd7994390ff' })) as never,
    );

    await expect(
      updateServiceCatalogItem(serviceId, { name: 'ремонт', price: 100 }),
    ).rejects.toBeInstanceOf(HttpError);
    await expect(
      updateServiceCatalogItem(serviceId, { name: 'ремонт', price: 100 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows saving the same service name on the current row', async () => {
    const current = {
      ...buildService('Diagnostics'),
      name: 'Diagnostics',
      price: 250,
      salePriceOptions: [],
      note: '',
      isActive: true,
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue(buildService('Diagnostics')),
    };
    vi.spyOn(ServiceCatalog, 'findById').mockResolvedValue(current as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(leanResult(null) as never);

    const result = await updateServiceCatalogItem(serviceId, {
      name: 'Diagnostics',
      price: 250,
    });

    expect(result).toMatchObject({ name: 'Diagnostics' });
    expect(current.save).toHaveBeenCalled();
  });

  it('allows a case-only rename on the current row', async () => {
    const saved = buildService('Ремонт', { price: 500 });
    const current = {
      ...buildService('ремонт', { price: 500 }),
      name: 'ремонт',
      price: 500,
      salePriceOptions: [],
      note: '',
      isActive: true,
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn().mockReturnValue(saved),
    };
    vi.spyOn(ServiceCatalog, 'findById').mockResolvedValue(current as never);
    vi.spyOn(ServiceCatalog, 'findOne').mockReturnValue(leanResult(null) as never);

    const result = await updateServiceCatalogItem(serviceId, {
      name: 'Ремонт',
      price: 500,
    });

    expect(current.name).toBe('Ремонт');
    expect(result).toMatchObject({ name: 'Ремонт' });
    expect(current.save).toHaveBeenCalled();
  });
});

describe('mergeDuplicateServiceCatalogItems', () => {
  it('keeps the active row and re-points sale service ids', async () => {
    const winnerId = '507f1f77bcf86cd7994390aa';
    const loserId = '507f1f77bcf86cd7994390bb';
    const winner = buildService('Ремонт', {
      id: winnerId,
      isActive: true,
      createdAt: new Date('2026-09-09T12:00:00.000Z'),
    });
    const loser = buildService('ремонт', {
      id: loserId,
      isActive: false,
      price: 500,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    });
    winner._id = { toString: () => winnerId };
    loser._id = { toString: () => loserId };

    const lean = vi.fn().mockResolvedValue([loser, winner]);
    const sort = vi.fn().mockReturnValue({ lean });
    vi.spyOn(ServiceCatalog, 'find').mockReturnValue({ sort } as never);
    const updateMany = vi.spyOn(Sale, 'updateMany').mockResolvedValue({} as never);
    const deleteMany = vi.spyOn(ServiceCatalog, 'deleteMany').mockResolvedValue({} as never);

    await mergeDuplicateServiceCatalogItems();

    expect(updateMany).toHaveBeenCalledWith(
      { 'lineItems.serviceId': { $in: [loser._id] } },
      { $set: { 'lineItems.$[line].serviceId': winner._id } },
      { arrayFilters: [{ 'line.serviceId': { $in: [loser._id] } }] },
    );
    expect(deleteMany).toHaveBeenCalledWith({ _id: { $in: [loser._id] } });
  });
});
