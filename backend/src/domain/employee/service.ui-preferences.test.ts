import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findByIdAndUpdateMock } = vi.hoisted(() => ({
  findByIdAndUpdateMock: vi.fn(),
}));

vi.mock('./model', () => ({
  Employee: {
    findByIdAndUpdate: findByIdAndUpdateMock,
  },
}));

vi.mock('../sale/model', () => ({ Sale: {} }));
vi.mock('../warehouse-settings/model', () => ({ WarehouseSettings: {} }));

import { updateOwnUiPreferences } from './service';

const employeeId = '507f1f77bcf86cd799439011';

const leanEmployee = {
  _id: { toString: () => employeeId },
  name: 'Manager',
  phone: '',
  email: '',
  username: 'manager',
  role: 'manager' as const,
  permissions: ['orders.view'],
  isActive: true,
  note: '',
  uiPreferences: { hiddenOrdersTabs: ['sales'] },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('updateOwnUiPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves hiddenOrdersTabs for the current employee', async () => {
    findByIdAndUpdateMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue(leanEmployee),
    });

    const result = await updateOwnUiPreferences(employeeId, {
      hiddenOrdersTabs: ['sales', 'kanban'],
    });

    expect(findByIdAndUpdateMock).toHaveBeenCalledWith(
      employeeId,
      { $set: { 'uiPreferences.hiddenOrdersTabs': ['sales', 'kanban'] } },
      { returnDocument: 'after', runValidators: true },
    );
    expect(result).toMatchObject({
      id: employeeId,
      uiPreferences: { hiddenOrdersTabs: ['sales'] },
    });
  });

  it('returns 404 when the employee is missing', async () => {
    findByIdAndUpdateMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await expect(
      updateOwnUiPreferences(employeeId, { hiddenOrdersTabs: [] }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
