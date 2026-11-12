import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancePolicy, FinancePolicyAuditLog } from './model';
import {
  defaultFinancePolicyState,
  getFinancePolicy,
  listFinancePolicyHistory,
  updateFinancePolicy,
} from './policy';

describe('finance accounting & audit policy service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default singleton policy when no DB record exists', async () => {
    vi.spyOn(FinancePolicy, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);
    vi.spyOn(FinancePolicy, 'findOneAndUpdate').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        serviceAuditEnabled: false,
        serviceProfitMode: 'full',
        reportDefaults: {
          period: 'last30',
          source: 'all',
          showCharts: true,
          showTable: true,
        },
        version: 1,
        updatedById: null,
        updatedByName: null,
        updatedAt: new Date('2026-11-12T10:00:00.000Z'),
      }),
    } as never);

    const policy = await getFinancePolicy();
    expect(policy).toMatchObject({
      ...defaultFinancePolicyState(),
      updatedAt: '2026-11-12T10:00:00.000Z',
    });
  });

  it('updates policy atomically, increments version, and writes an immutable audit log entry', async () => {
    vi.spyOn(FinancePolicy, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        serviceAuditEnabled: false,
        serviceProfitMode: 'full',
        reportDefaults: {
          period: 'last30',
          source: 'all',
          showCharts: true,
          showTable: true,
        },
        version: 1,
        updatedById: null,
        updatedByName: null,
        updatedAt: new Date('2026-11-12T10:00:00.000Z'),
      }),
    } as never);

    const updateSpy = vi.spyOn(FinancePolicy, 'findOneAndUpdate').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        serviceAuditEnabled: true,
        serviceProfitMode: 'revenue_only',
        reportDefaults: {
          period: 'month',
          source: 'all',
          showCharts: false,
          showTable: true,
        },
        version: 2,
        updatedById: 'emp-1',
        updatedByName: 'Owner',
        updatedAt: new Date('2026-11-12T10:05:00.000Z'),
      }),
    } as never);

    const logCreateSpy = vi
      .spyOn(FinancePolicyAuditLog, 'create')
      .mockResolvedValue({} as never);

    const updated = await updateFinancePolicy(
      {
        version: 1,
        serviceAuditEnabled: true,
        serviceProfitMode: 'revenue_only',
        reportDefaults: {
          period: 'month',
          showCharts: false,
        },
        reason: 'Enable service audit and revenue-only view',
      },
      { _id: { toString: () => 'emp-1' } as never, name: 'Owner' },
    );

    expect(updated.version).toBe(2);
    expect(updated.serviceAuditEnabled).toBe(true);
    expect(updated.serviceProfitMode).toBe('revenue_only');
    expect(updateSpy).toHaveBeenCalledWith(
      { key: 'default', version: 1 },
      expect.objectContaining({
        $inc: { version: 1 },
      }),
      expect.any(Object),
    );
    expect(logCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        previousVersion: 1,
        version: 2,
        changedFields: [
          'serviceAuditEnabled',
          'serviceProfitMode',
          'reportDefaults.period',
          'reportDefaults.showCharts',
        ],
        authorName: 'Owner',
        reason: 'Enable service audit and revenue-only view',
      }),
    );
  });

  it('rejects concurrent updates with stale version (409) and invalid exclude+services defaults (400)', async () => {
    vi.spyOn(FinancePolicy, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        serviceAuditEnabled: false,
        serviceProfitMode: 'full',
        reportDefaults: {
          period: 'last30',
          source: 'all',
          showCharts: true,
          showTable: true,
        },
        version: 3,
      }),
    } as never);

    await expect(
      updateFinancePolicy({
        version: 2,
        serviceAuditEnabled: true,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      updateFinancePolicy({
        version: 3,
        serviceProfitMode: 'exclude',
        reportDefaults: { source: 'services' },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('lists paginated immutable policy history', async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => 'h1' },
          previousVersion: 1,
          version: 2,
          changedFields: ['serviceAuditEnabled'],
          previous: {
            serviceAuditEnabled: false,
            serviceProfitMode: 'full',
            reportDefaults: {
              period: 'last30',
              source: 'all',
              showCharts: true,
              showTable: true,
            },
          },
          next: {
            serviceAuditEnabled: true,
            serviceProfitMode: 'full',
            reportDefaults: {
              period: 'last30',
              source: 'all',
              showCharts: true,
              showTable: true,
            },
          },
          reason: 'Audit rollout',
          authorId: 'emp-1',
          authorName: 'Owner',
          changedAt: new Date('2026-11-12T10:10:00.000Z'),
        },
      ]),
    };
    vi.spyOn(FinancePolicyAuditLog, 'find').mockReturnValue(chain as never);
    vi.spyOn(FinancePolicyAuditLog, 'countDocuments').mockResolvedValue(1 as never);

    const history = await listFinancePolicyHistory({ page: 1, pageSize: 10 });
    expect(history.total).toBe(1);
    expect(history.items[0]).toMatchObject({
      id: 'h1',
      previousVersion: 1,
      version: 2,
      authorName: 'Owner',
      reason: 'Audit rollout',
    });
  });
});
