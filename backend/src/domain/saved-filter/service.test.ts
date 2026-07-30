import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMock, createMock, findByIdMock, deleteOneMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
  createMock: vi.fn(),
  findByIdMock: vi.fn(),
  deleteOneMock: vi.fn(),
}));

vi.mock('./model', () => ({
  savedFilterScopes: ['orders', 'warehouse', 'clients', 'catalog'],
  SavedFilter: {
    find: findMock,
    create: createMock,
    findById: findByIdMock,
    deleteOne: deleteOneMock,
  },
}));

import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from './service';

const employeeId = '507f1f77bcf86cd799439011';
const otherEmployeeId = '507f1f77bcf86cd799439012';
const filterId = '507f1f77bcf86cd799439013';

describe('saved-filter service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists filters for employee and scope', async () => {
    const lean = vi.fn().mockResolvedValue([
      {
        _id: { toString: () => filterId },
        employeeId: { toString: () => employeeId },
        scope: 'orders',
        tab: 'orders',
        name: 'Daily',
        icon: '$',
        filters: { status: 'new' },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    const sort = vi.fn().mockReturnValue({ lean });
    findMock.mockReturnValue({ sort });

    const result = await listSavedFilters(employeeId, 'orders');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: filterId,
      employeeId,
      scope: 'orders',
      name: 'Daily',
    });
    expect(findMock).toHaveBeenCalled();
  });

  it('rejects invalid scope', async () => {
    await expect(listSavedFilters(employeeId, 'nope')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('creates a filter for the employee', async () => {
    createMock.mockResolvedValue({
      toObject: () => ({
        _id: { toString: () => filterId },
        employeeId: { toString: () => employeeId },
        scope: 'orders',
        tab: 'sales',
        name: 'Sale daily',
        icon: '✈',
        filters: { client: 'x' },
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    });

    const created = await createSavedFilter(employeeId, {
      scope: 'orders',
      tab: 'sales',
      name: 'Sale daily',
      icon: '✈',
      filters: { client: 'x' },
    });
    expect(created.name).toBe('Sale daily');
    expect(createMock).toHaveBeenCalled();
  });

  it('forbids deleting another employee filter', async () => {
    findByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => filterId },
        employeeId: { toString: () => otherEmployeeId },
      }),
    });

    await expect(deleteSavedFilter(employeeId, filterId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('deletes own filter', async () => {
    findByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => filterId },
        employeeId: { toString: () => employeeId },
      }),
    });
    deleteOneMock.mockResolvedValue({ deletedCount: 1 });

    await expect(deleteSavedFilter(employeeId, filterId)).resolves.toEqual({
      id: filterId,
      deleted: true,
    });
  });
});
