import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findMock,
  countDocumentsMock,
  createMock,
  findByIdMock,
  deleteOneMock,
} = vi.hoisted(() => ({
  findMock: vi.fn(),
  countDocumentsMock: vi.fn(),
  createMock: vi.fn(),
  findByIdMock: vi.fn(),
  deleteOneMock: vi.fn(),
}));

vi.mock('./model', () => ({
  scenarioDomains: ['warehouse', 'cashflow'],
  Scenario: {
    find: findMock,
    countDocuments: countDocumentsMock,
    create: createMock,
    findById: findByIdMock,
    deleteOne: deleteOneMock,
  },
}));

import {
  createScenario,
  deleteScenario,
  listScenarios,
  normalizeScenarioAssumptions,
  updateScenario,
} from './service';
import { resolveAllowedScenarioDomains } from './controller';

const emp1 = '507f1f77bcf86cd799439011';
const emp2 = '507f1f77bcf86cd799439012';
const scenId = '507f1f77bcf86cd799439013';

describe('scenario service & permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes warehouse and cashflow assumptions deterministically', () => {
    expect(normalizeScenarioAssumptions('warehouse', {})).toEqual({
      demandMultiplier: 1,
      leadTimeDays: 14,
      safetyStockDays: 7,
      includePendingSupplierOrders: true,
    });

    expect(
      normalizeScenarioAssumptions('cashflow', {
        demandMultiplier: 1.25,
        inflowTimingShiftDays: 5,
        plannedEvents: [
          { title: 'Rent', type: 'outflow', amount: 15000, currency: 'uah', scheduledDate: '2026-11-20' },
        ],
      }),
    ).toMatchObject({
      demandMultiplier: 1.25,
      inflowTimingShiftDays: 5,
      plannedEvents: [
        {
          title: 'Rent',
          type: 'outflow',
          amount: 15000,
          currency: 'UAH',
          scheduledDate: '2026-11-20',
        },
      ],
    });
  });

  it('resolves allowed domains strictly from employee permissions', () => {
    expect(
      resolveAllowedScenarioDomains({ role: 'warehouse', permissions: ['inventory.manage'] }),
    ).toEqual(['warehouse']);
    expect(
      resolveAllowedScenarioDomains({ role: 'support', permissions: ['finance.view'] }),
    ).toEqual(['cashflow']);
    expect(
      resolveAllowedScenarioDomains({ role: 'support', permissions: ['orders.view'] }),
    ).toEqual([]);
  });

  it('lists only authorized domain scenarios scoped to employee', async () => {
    const lean = vi.fn().mockResolvedValue([
      {
        _id: { toString: () => scenId },
        employeeId: { toString: () => emp1 },
        domain: 'warehouse',
        name: 'Peak Q4',
        horizonDays: 60,
        assumptions: { leadTimeDays: 21, safetyStockDays: 10 },
        filters: {},
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ]);
    const sort = vi.fn().mockReturnValue({ lean });
    findMock.mockReturnValue({ sort });

    const list = await listScenarios(emp1, ['warehouse'], 'warehouse');
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Peak Q4');

    await expect(
      listScenarios(emp1, ['warehouse'], 'cashflow'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('enforces scenario ownership on update and delete', async () => {
    findByIdMock.mockReturnValue({
      employeeId: { toString: () => emp2 },
      domain: 'warehouse',
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => scenId },
        employeeId: { toString: () => emp2 },
        domain: 'warehouse',
      }),
    });

    await expect(
      updateScenario(emp1, scenId, { name: 'Hijack' }, ['warehouse']),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      deleteScenario(emp1, scenId, ['warehouse']),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates and deletes an owned scenario cleanly', async () => {
    countDocumentsMock.mockResolvedValue(0);
    createMock.mockResolvedValue({
      toObject: () => ({
        _id: { toString: () => scenId },
        employeeId: { toString: () => emp1 },
        domain: 'cashflow',
        name: 'Conservative 90d',
        horizonDays: 90,
        assumptions: normalizeScenarioAssumptions('cashflow', {}),
        filters: {},
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    });

    const created = await createScenario(emp1, {
      domain: 'cashflow',
      name: 'Conservative 90d',
      horizonDays: 90,
    });
    expect(created.horizonDays).toBe(90);

    findByIdMock.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: { toString: () => scenId },
        employeeId: { toString: () => emp1 },
        domain: 'cashflow',
      }),
    });
    deleteOneMock.mockResolvedValue({ deletedCount: 1 });
    await expect(
      deleteScenario(emp1, scenId, ['cashflow']),
    ).resolves.toEqual({ deleted: true, id: scenId });
  });
});
