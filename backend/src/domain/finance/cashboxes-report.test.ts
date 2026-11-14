import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from '../sale/model';
import { SupplierOrder } from '../supplier-order/model';
import { Cashbox, FinanceTransaction } from './model';
import * as financeInternal from './internal';
import * as periodSnapshot from './period-snapshot';
import { getCashboxesReport, getCashboxesReportDetails } from './cashboxes-report';

describe('cashboxes information report, reconciliation & cashflow forecasting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(financeInternal, 'listCurrencyDocuments').mockResolvedValue([
      { code: 'UAH', isArchived: false },
      { code: 'USD', isArchived: false },
    ] as never);
    vi.spyOn(periodSnapshot, 'getActiveFinancePeriodSnapshot').mockResolvedValue(null);
    vi.spyOn(SupplierOrder, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: { toString: () => 'po-due' },
            orderBaseId: 'SO-99',
            number: 'PO-99',
            total: 4000,
            paid: 1000,
            deliveryDate: new Date('2026-11-18T10:00:00.000Z'),
          },
        ]),
      }),
    } as never);
    vi.spyOn(Sale, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    } as never);
  });

  it('keeps currencies separate, separates transfers, reconciles opening/closing balances, and prevents double counting scheduled obligations', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    vi.spyOn(Cashbox, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: { toString: () => 'cb1' }, name: 'Main Cash', balances: { UAH: 1500, USD: 200 }, isArchived: false },
          { _id: { toString: () => 'cb2' }, name: 'Bank', balances: { UAH: 300, USD: 0 }, isArchived: false },
        ]),
      }),
    } as never);

    vi.spyOn(FinanceTransaction, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            // Reverse chron order
            {
              _id: { toString: () => 't-cancel-ignored' },
              type: 'deposit',
              amount: 9999,
              currency: 'UAH',
              toCashbox: { toString: () => 'cb1' },
              status: 'cancelled',
              transactionDate: new Date('2026-11-10T10:00:00.000Z'),
            },
            {
              _id: { toString: () => 't-transfer' },
              type: 'transfer',
              amount: 300,
              currency: 'UAH',
              fromCashbox: { toString: () => 'cb1' },
              toCashbox: { toString: () => 'cb2' },
              status: 'active',
              isCancellation: false,
              transactionDate: new Date('2026-11-10T09:00:00.000Z'),
            },
            {
              _id: { toString: () => 't-usd' },
              type: 'deposit',
              amount: 50,
              currency: 'USD',
              toCashbox: { toString: () => 'cb1' },
              status: 'active',
              isCancellation: false,
              transactionDate: new Date('2026-11-08T09:00:00.000Z'),
            },
            {
              _id: { toString: () => 't-in' },
              type: 'deposit',
              amount: 900,
              currency: 'UAH',
              toCashbox: { toString: () => 'cb1' },
              status: 'active',
              isCancellation: false,
              transactionDate: new Date('2026-11-05T09:00:00.000Z'),
            },
            {
              _id: { toString: () => 't-out' },
              type: 'withdraw',
              amount: 100,
              currency: 'UAH',
              fromCashbox: { toString: () => 'cb1' },
              status: 'active',
              isCancellation: false,
              transactionDate: new Date('2026-11-03T09:00:00.000Z'),
            },
          ]),
        }),
      }),
    } as never);

    // Without scheduling po-due, it stays unscheduled and does NOT affect forecast
    const baseReport = await getCashboxesReport(
      { dateFrom: '2026-11-01', dateTo: '2026-11-11', horizonDays: 30 },
      now,
    );
    const uah = (baseReport.byCurrency as Record<string, any>).UAH;
    const usd = (baseReport.byCurrency as Record<string, any>).USD;

    expect(uah.currentBalance).toBe(1800);
    expect(usd.currentBalance).toBe(200);
    // Inflows = 900, outflows = 100, netExternal = 800; internal transfer 300 kept separate!
    expect(uah.inflows).toBe(900);
    expect(uah.outflows).toBe(100);
    expect(uah.netExternalCashflow).toBe(800);
    expect(uah.transfersVolume).toBe(300);
    expect(uah.transfersCount).toBe(1);
    // Opening: 1800 current - 800 net external = 1000; closing: 1800 -> delta 0
    expect(uah.reconciliation.openingBalance).toBe(1000);
    expect(uah.reconciliation.closingBalance).toBe(1800);
    expect(uah.reconciliation.reconciled).toBe(true);
    expect(usd.reconciliation.openingBalance).toBe(150);
    expect(usd.reconciliation.closingBalance).toBe(200);

    // Average daily 90d external: 900/90 = 10 inflow, 100/90 = 1.11 outflow
    expect(uah.forecast.avgDailyInflow).toBe(10);
    expect(uah.forecast.avgDailyOutflow).toBe(1.11);
    expect(baseReport.unscheduledObligations).toHaveLength(1);
    expect(baseReport.obligationSummary.unscheduledPayablesTotal).toBe(3000);

    // Now schedule po-due cleanly -> moves out of unscheduledObligations & affects day 2026-11-18 ONLY once!
    const scheduledReport = await getCashboxesReport(
      {
        dateFrom: '2026-11-01',
        dateTo: '2026-11-11',
        horizonDays: 30,
        plannedEvents: [
          {
            id: 'ev1',
            title: 'Pay PO-99',
            type: 'outflow',
            amount: 3000,
            currency: 'UAH',
            scheduledDate: '2026-11-18',
            obligationKind: 'supplier_order',
            obligationId: 'po-due',
          },
        ],
      },
      now,
    );
    expect(scheduledReport.unscheduledObligations).toHaveLength(0);
    expect(scheduledReport.obligationSummary.scheduledCount).toBe(1);
    const uahScheduled = (scheduledReport.byCurrency as Record<string, any>).UAH;
    expect(uahScheduled.forecast.totalPlannedOutflows).toBe(3000);
  });

  it('marks reconciliation unavailable when period overlaps purged finance period snapshot seal', async () => {
    const now = new Date('2026-11-11T10:00:00.000Z');
    vi.spyOn(periodSnapshot, 'getActiveFinancePeriodSnapshot').mockResolvedValue({
      periodEnd: new Date('2026-11-05T23:59:59.999Z'),
      purgedTxCount: 150,
    } as never);
    vi.spyOn(Cashbox, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: { toString: () => 'cb1' }, name: 'Main Cash', balances: { UAH: 500 }, isArchived: false },
        ]),
      }),
    } as never);
    vi.spyOn(FinanceTransaction, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
      }),
    } as never);

    const report = await getCashboxesReport(
      { dateFrom: '2026-11-01', dateTo: '2026-11-11' },
      now,
    );
    expect(report.coverage.reconciliationUnavailableBySeal).toBe(true);
    expect((report.byCurrency as Record<string, any>).UAH.reconciliation.openingBalance).toBeNull();
    expect(report.coverage.warnings.length).toBeGreaterThan(0);

    // Check details endpoint respects active txs only
    vi.spyOn(Cashbox, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: { toString: () => 'cb1' }, name: 'Main Cash' }]) }),
    } as never);
    vi.spyOn(FinanceTransaction, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: { toString: () => 'tx1' },
            type: 'deposit',
            amount: 250,
            currency: 'UAH',
            toCashbox: { toString: () => 'cb1' },
            transactionDate: new Date('2026-11-09T10:00:00.000Z'),
            createdAt: new Date('2026-11-09T10:00:00.000Z'),
          },
        ]),
      }),
    } as never);
    const details = await getCashboxesReportDetails(
      { dateFrom: '2026-11-01', dateTo: '2026-11-11' },
      now,
    );
    expect(details.total).toBe(1);
    expect(details.items[0]?.toCashboxName).toBe('Main Cash');
  });
});
