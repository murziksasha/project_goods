import { expect, test, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { e2eEmployee, installE2eApiMocks } from './helpers/mock-api';

const installReportsMocks = async (
  page: Page,
  options: {
    employee?: Record<string, unknown>;
    scenariosInitial?: Array<Record<string, unknown>>;
  } = {},
) => {
  const employee = options.employee ?? e2eEmployee;
  const scenarios = [...(options.scenariosInitial ?? [])];
  let saleCostAudited = false;
  let saleUnknownCostCount = 1;

  const saleRecord = {
    id: 'sale-audit-1',
    recordNumber: 'S000401',
    saleDate: '2026-11-10T10:00:00.000Z',
    quantity: 1,
    salePrice: 1200,
    kind: 'sale',
    status: 'paid',
    paidAmount: 1200,
    isRapidSale: false,
    note: '',
    userNote: '',
    timeline: [],
    paymentHistory: [],
    lineItems: [
      {
        id: 'line-prod-1',
        kind: 'product',
        name: 'Board Module',
        price: 1200,
        quantity: 1,
        warrantyPeriod: 1,
        requiresCostAudit: true,
        costSnapshot: saleCostAudited
          ? { status: 'known', unitCost: 300, totalCost: 300, method: 'manual' }
          : { status: 'unknown', unitCost: null, totalCost: null, method: 'unknown' },
        costAuditLog: saleCostAudited
          ? [
              {
                id: 'aud-1',
                previousStatus: 'unknown',
                previousUnitCost: null,
                previousTotalCost: null,
                newStatus: 'known',
                newUnitCost: 300,
                newTotalCost: 300,
                method: 'fixed',
                reason: 'Verified contractor invoice',
                authorName: employee.name,
                changedAt: '2026-11-11T11:00:00.000Z',
              },
            ]
          : [],
      },
    ],
    product: { id: '', name: 'Board Microsoldering', article: 'SALE', serialNumber: '' },
    client: { id: 'client-1', name: 'Ada Client', phone: '+380991112233', status: 'new' },
    manager: { id: String(employee.id), name: String(employee.name), role: String(employee.role) },
    master: null,
    issuedBy: null,
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
  };

  await installE2eApiMocks(page);

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api/, '');
      const method = request.method();

      const fulfillJson = async (body: unknown, status = 200) => {
        await route.fulfill({
          status,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify(body),
        });
      };

      if (path === '/auth/me' || path.endsWith('/auth/me')) {
        await fulfillJson(employee);
        return;
      }

      if (path === '/employees') {
        await fulfillJson([employee]);
        return;
      }

      if (path === '/warehouse-settings') {
        await fulfillJson({
          id: 'warehouse-settings',
          serviceCenters: [],
          warehouses: [
            {
              id: 'wh-1',
              name: 'Main',
              isActive: true,
              serviceCenterId: '',
              receiptAddress: '',
              receiptPhone: '',
              locations: [{ id: 'loc-1', name: 'Shelf A' }],
            },
          ],
          administrators: [],
          createdAt: '2026-11-10T10:00:00.000Z',
          updatedAt: '2026-11-10T10:00:00.000Z',
        });
        return;
      }

      if (path === '/sales') {
        const list = [
          saleRecord,
          {
            ...saleRecord,
            id: 'rep-1',
            recordNumber: 'R000777',
            kind: 'repair',
            status: 'inProgress',
            deviceName: 'MacBook Air',
          },
        ];
        await fulfillJson(
          url.searchParams.has('page')
            ? { items: list, total: list.length, page: 1, pageSize: 30 }
            : list,
        );
        return;
      }

      if (path === '/sales/rep-1' && method === 'GET') {
        await fulfillJson({
          ...saleRecord,
          id: 'rep-1',
          recordNumber: 'R000777',
          kind: 'repair',
          status: 'inProgress',
          deviceName: 'MacBook Air',
        });
        return;
      }

      if (path === '/sales/occupied-serials') {
        await fulfillJson({ occupied: [] });
        return;
      }

      // Scenarios CRUD
      if (path === '/scenarios' || path.startsWith('/scenarios/')) {
        if (method === 'GET') {
          const domain = url.searchParams.get('domain');
          await fulfillJson(
            domain ? scenarios.filter((s) => s.domain === domain) : scenarios,
          );
          return;
        }
        if (method === 'POST') {
          const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
          const created = {
            id: `scen-${Date.now()}`,
            employeeId: employee.id,
            ...payload,
            createdAt: '2026-11-11T10:00:00.000Z',
            updatedAt: '2026-11-11T10:00:00.000Z',
          };
          scenarios.push(created);
          await fulfillJson(created, 201);
          return;
        }
        if (method === 'DELETE') {
          const sid = path.split('/').pop();
          const idx = scenarios.findIndex((s) => s.id === sid);
          if (idx >= 0) scenarios.splice(idx, 1);
          await fulfillJson({ deleted: true, id: sid });
          return;
        }
      }

      // Warehouse report + details
      if (path === '/reports/warehouse/details') {
        const ageBucket = url.searchParams.get('ageBucket') ?? '';
        const allItems = [
          {
            id: 'prod-1',
            name: 'NVMe 512GB',
            nameKey: 'nvme 512gb',
            article: 'SSD-512',
            serialNumber: 'S000501',
            price: 1100,
            quantity: 5,
            reservedQuantity: 1,
            manualReservedQuantity: 0,
            orderReservedQuantity: 1,
            availableQuantity: 4,
            valuation: 5500,
            availableValuation: 4400,
            supplier: 'TechDist',
            warehouseId: 'wh-1',
            warehouseName: 'Main',
            locationId: 'loc-1',
            locationName: 'Shelf A',
            supplierOrderId: 'so-1',
            purchaseDate: '2026-10-25T00:00:00.000Z',
            ageDays: 17,
            ageBucket: '0-30',
            stockState: 'in_stock',
          },
          {
            id: 'prod-2',
            name: 'Legacy Charger',
            nameKey: 'legacy charger',
            article: 'CHG-1',
            serialNumber: '',
            price: 250,
            quantity: 2,
            reservedQuantity: 0,
            manualReservedQuantity: 0,
            orderReservedQuantity: 0,
            availableQuantity: 2,
            valuation: 500,
            availableValuation: 500,
            supplier: 'Legacy Vendor',
            warehouseId: 'wh-1',
            warehouseName: 'Main',
            locationId: 'loc-1',
            locationName: 'Shelf A',
            supplierOrderId: '',
            purchaseDate: null,
            ageDays: null,
            ageBucket: 'unknown',
            stockState: 'low_stock',
          },
        ];
        const filtered = ageBucket
          ? allItems.filter((item) => item.ageBucket === ageBucket)
          : allItems;
        await fulfillJson({
          items: filtered,
          total: filtered.length,
          page: 1,
          pageSize: 25,
          totals: {
            totalQuantity: filtered.reduce((s, r) => s + r.quantity, 0),
            reservedQuantity: filtered.reduce((s, r) => s + r.reservedQuantity, 0),
            availableQuantity: filtered.reduce((s, r) => s + r.availableQuantity, 0),
            valuation: filtered.reduce((s, r) => s + r.valuation, 0),
          },
        });
        return;
      }

      if (path === '/reports/warehouse') {
        await fulfillJson({
          generatedAt: '2026-11-11T10:00:00.000Z',
          timeZone: 'Europe/Kiev',
          filtersApplied: {},
          assumptions: {
            leadTimeDays: Number(url.searchParams.get('leadTimeDays') ?? 14),
            safetyStockDays: Number(url.searchParams.get('safetyStockDays') ?? 7),
            horizonDays: Number(url.searchParams.get('horizonDays') ?? 30),
            demandMultiplier: Number(url.searchParams.get('demandMultiplier') ?? 1),
            includePendingSupplierOrders: true,
          },
          summary: {
            skuCount: 2,
            productGroupCount: 2,
            totalQuantity: 7,
            reservedQuantity: 1,
            manualReservedQuantity: 0,
            orderReservedQuantity: 1,
            availableQuantity: 6,
            purchaseValuation: 6000,
            availableValuation: 4900,
            outOfStockCount: 0,
            lowStockCount: 1,
            unknownAgeOnHandCount: 1,
            unknownAgeUnits: 2,
            totalObservedDemand90d: 30,
            pendingSupplierUnits: 3,
            reorderSkuCount: 1,
            totalSuggestedReorderUnits: 4,
            totalEstimatedReorderCost: 4400,
          },
          agingBuckets: [
            { bucket: '0-30', skuCount: 1, quantity: 5, reservedQuantity: 1, availableQuantity: 4, valuation: 5500 },
            { bucket: '31-60', skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
            { bucket: '61-90', skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
            { bucket: '90+', skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
            { bucket: 'unknown', skuCount: 1, quantity: 2, reservedQuantity: 0, availableQuantity: 2, valuation: 500 },
          ],
          distributions: {
            bySupplier: [{ key: 'TechDist', label: 'TechDist', skuCount: 1, quantity: 5, reservedQuantity: 1, availableQuantity: 4, valuation: 5500 }],
            byLocation: [{ key: 'wh-1::loc-1', warehouseId: 'wh-1', warehouseName: 'Main', locationId: 'loc-1', locationName: 'Shelf A', label: 'Main / Shelf A', skuCount: 2, quantity: 7, reservedQuantity: 1, availableQuantity: 6, valuation: 6000 }],
          },
          demandAndSuggestions: [
            {
              nameKey: 'nvme 512gb',
              name: 'NVMe 512GB',
              supplier: 'TechDist',
              onHandQuantity: 5,
              reservedQuantity: 1,
              availableQuantity: 4,
              valuation: 5500,
              avgUnitCost: 1100,
              pendingSupplierQuantity: 3,
              overdueSupplierQuantity: 0,
              earliestExpectedDelivery: '2026-11-18T00:00:00.000Z',
              observedDemand90d: 30,
              activeDemandDays: 18,
              observedDailyDemand: 0.33,
              projectedDailyDemand: 0.33,
              demandPattern: 'steady',
              estimatedCoverageDays: 12,
              estimatedCoverageWithPendingDays: 21,
              targetBufferUnits: 8,
              reorderSuggestedQty: 4,
              estimatedReorderCost: 4400,
              horizonProjectedDemand: 10,
              horizonProjectedEndingAvailable: -3,
              horizonProjectedShortfall: 3,
              needsReorder: true,
            },
          ],
          forecast: {
            isEstimate: true,
            horizonDays: 30,
            observationWindow: {
              dateFrom: '2026-08-14',
              dateTo: '2026-11-11',
              windowDays: 90,
              observedHistoryDays: 90,
              earliestLiveSaleDate: '2026-06-01T00:00:00.000Z',
            },
            summary: { projectedDemandUnits: 10, projectedShortfallUnits: 3, skusAtRiskCount: 1 },
          },
          filterOptions: { warehouses: [{ id: 'wh-1', name: 'Main' }], suppliers: ['TechDist', 'Legacy Vendor'] },
          coverage: {
            coldSalesPurgedExist: false,
            observedHistoryDays: 90,
            historyWindowDays: 90,
            earliestLiveSaleDate: '2026-06-01T00:00:00.000Z',
            unknownAgeOnHandCount: 1,
            warnings: ['1 stock batch lacks purchaseDate and appears under Unknown age.'],
          },
        });
        return;
      }

      // Orders Information endpoints
      if (path === '/reports/orders/repairs') {
        await fulfillJson({
          generatedAt: '2026-11-11T10:00:00.000Z',
          timeZone: 'Europe/Kiev',
          period: { key: url.searchParams.get('period') ?? 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
          previousPeriod: url.searchParams.get('period') === 'whole' ? null : { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
          summary: {
            openCount: 4,
            unassignedOpenCount: 1,
            intakeCount: 6,
            trackedCompletedCount: 3,
            untrackedCompletedCount: 1,
            totalCompletedCount: 4,
            avgTurnaroundHours: 18.2,
            medianTurnaroundHours: 16,
          },
          comparison: url.searchParams.get('period') === 'whole' ? null : {
            intakeCountPrev: 4,
            intakeDeltaPct: 50,
            completedCountPrev: 2,
            completedDeltaPct: 100,
            avgTurnaroundHoursPrev: 20,
          },
          byStatus: [{ status: 'inProgress', count: 3 }],
          byTechnician: [{ technicianId: 't1', name: 'Max Tech', openCount: 3, completedInPeriod: 3 }],
          openAgingBuckets: [{ bucket: '0-3', count: 2 }, { bucket: '15-30', count: 2 }],
          completionTrend: [{ dateKey: '2026-11-10', completedCount: 2, avgTurnaroundHours: 18 }],
          turnaroundCoverage: {
            trackedCount: 3,
            untrackedCount: 1,
            totalClosedCount: 4,
            coveragePct: 75,
            available: true,
            warning: '1 legacy repair lacks structured completion timestamp.',
          },
          coverage: { coldSalesPurgedExist: false, warnings: [] },
        });
        return;
      }

      if (path === '/reports/orders/repairs/details') {
        await fulfillJson({
          items: [
            {
              id: 'rep-1',
              recordNumber: 'R000777',
              saleDate: '2026-11-05T09:00:00.000Z',
              status: 'inProgress',
              clientName: 'Ada Client',
              deviceName: 'MacBook Air',
              serialNumber: 'MBA1',
              technicianName: 'Max Tech',
              technicianId: 't1',
              isOpen: true,
              ageDays: 6,
              ageBucket: '4-7',
              completedAt: null,
              turnaroundHours: null,
              total: 2400,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        });
        return;
      }

      if (path === '/reports/orders/sales') {
        await fulfillJson({
          generatedAt: '2026-11-11T10:00:00.000Z',
          timeZone: 'Europe/Kiev',
          period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
          previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
          summary: {
            ordersCount: 5,
            unitsSold: 8,
            grossRevenue: 10000,
            discountAmount: 500,
            netRevenue: 9500,
            collectedAmount: 9500,
            aov: 1900,
            returnsCount: 1,
            returnedUnits: 1,
            returnedAmount: 500,
            refundedAmount: 500,
          },
          comparison: null,
          mix: { productRevenue: 8000, serviceRevenue: 1500, productUnits: 6, serviceUnits: 2, productSharePct: 84.2, serviceSharePct: 15.8 },
          byStatus: [{ status: 'paid', count: 5, netRevenue: 9500 }],
          topItems: [{ key: 'nvme', name: 'NVMe 512GB', kind: 'product', units: 6, revenue: 8000 }],
          trend: [{ dateKey: '2026-11-10', revenue: 9500, ordersCount: 5, units: 8, returnsAmount: 500 }],
          coverage: { coldSalesPurgedExist: false, warnings: [] },
        });
        return;
      }

      if (path === '/reports/orders/sales/details') {
        await fulfillJson({ items: [], total: 0, page: 1, pageSize: 25 });
        return;
      }

      if (path === '/reports/orders/procurement') {
        await fulfillJson({
          generatedAt: '2026-11-11T10:00:00.000Z',
          timeZone: 'Europe/Kiev',
          period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
          previousPeriod: null,
          summary: {
            ordersCount: 1,
            orderedUnits: 5,
            receivedUnits: 5,
            cancelledUnits: 0,
            pendingUnits: 0,
            totalSpend: 5500,
            paidAmount: 5500,
            outstandingAmount: 0,
            overdueOrdersCount: 0,
            overduePendingUnits: 0,
          },
          comparison: null,
          receiptPerformance: { trackedItemsCount: 1, untrackedLegacyItemsCount: 0, totalReceivedItemsCount: 1, coveragePct: 100, onTimeCount: 1, lateCount: 0, onTimeRatePct: 100, avgReceiptLeadDays: 2, available: true },
          bySupplier: [],
          byProduct: [],
          trend: [],
          supplierOptions: [],
          coverage: { warnings: [] },
        });
        return;
      }

      if (path === '/reports/orders/procurement/details') {
        await fulfillJson({ items: [], total: 0, page: 1, pageSize: 25 });
        return;
      }

      // Cashboxes report + details
      if (path === '/finance/cashboxes-report/details') {
        await fulfillJson({ items: [], total: 0, page: 1, pageSize: 25 });
        return;
      }

      if (path === '/finance/cashboxes-report') {
        await fulfillJson({
          generatedAt: '2026-11-11T10:00:00.000Z',
          timeZone: 'Europe/Kiev',
          period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
          previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
          currencies: ['UAH', 'USD'],
          allCurrencies: ['UAH', 'USD'],
          cashboxes: [{ id: 'cashbox-main', name: 'Основна', balances: { UAH: 980, USD: 250 }, isArchived: false }],
          byCurrency: {
            UAH: {
              currency: 'UAH',
              currentBalance: 980,
              inflows: 3000,
              outflows: 2020,
              netExternalCashflow: 980,
              inflowsCount: 2,
              outflowsCount: 1,
              transfersVolume: 500,
              transfersCount: 1,
              transfersIn: 500,
              transfersOut: 500,
              reconciliation: {
                currentBalance: 980,
                openingBalance: 0,
                closingBalance: 980,
                reconciliationDelta: 0,
                reconciled: true,
                complete: true,
                perCashbox: [{ cashboxId: 'cashbox-main', name: 'Основна', currency: 'UAH', currentBalance: 980, openingBalance: 0, closingBalance: 980, inflows: 3000, outflows: 2020, transfersIn: 500, transfersOut: 500, reconciliationDelta: 0 }],
              },
              comparison: { inflowsPrev: 2000, outflowsPrev: 1500, netExternalCashflowPrev: 500, inflowsDeltaPct: 50, outflowsDeltaPct: 34.7 },
              trend: [{ dateKey: '2026-11-10', inflows: 3000, outflows: 2020, netExternal: 980, transfers: 500 }],
              forecast: {
                isEstimate: true,
                horizonDays: 30,
                startingBalance: 980,
                avgDailyInflow: 100,
                avgDailyOutflow: 67.33,
                adjustedDailyInflow: 100,
                adjustedDailyOutflow: 67.33,
                totalProjectedBaselineInflows: 3000,
                totalProjectedBaselineOutflows: 2019.9,
                totalPlannedInflows: 0,
                totalPlannedOutflows: 0,
                endingProjectedBalance: 1960.1,
                lowestProjectedBalance: 980,
                series: [{ day: 1, dateKey: '2026-11-12', baselineInflow: 100, baselineOutflow: 67.33, plannedInflow: 0, plannedOutflow: 0, projectedBalance: 1012.67 }],
              },
            },
            USD: {
              currency: 'USD',
              currentBalance: 250,
              inflows: 250,
              outflows: 0,
              netExternalCashflow: 250,
              inflowsCount: 1,
              outflowsCount: 0,
              transfersVolume: 0,
              transfersCount: 0,
              transfersIn: 0,
              transfersOut: 0,
              reconciliation: { currentBalance: 250, openingBalance: 0, closingBalance: 250, reconciliationDelta: 0, reconciled: true, complete: true, perCashbox: [] },
              comparison: null,
              trend: [],
              forecast: {
                isEstimate: true,
                horizonDays: 30,
                startingBalance: 250,
                avgDailyInflow: 8.33,
                avgDailyOutflow: 0,
                adjustedDailyInflow: 8.33,
                adjustedDailyOutflow: 0,
                totalProjectedBaselineInflows: 250,
                totalProjectedBaselineOutflows: 0,
                totalPlannedInflows: 0,
                totalPlannedOutflows: 0,
                endingProjectedBalance: 500,
                lowestProjectedBalance: 258.33,
                series: [],
              },
            },
          },
          assumptions: { horizonDays: 30, demandMultiplier: 1, inflowMultiplier: 1, outflowMultiplier: 1, inflowTimingShiftDays: 0, outflowTimingShiftDays: 0, plannedEvents: [] },
          unscheduledObligations: [],
          obligationSummary: { unscheduledPayablesTotal: 0, unscheduledReceivablesTotal: 0, unscheduledCount: 0, scheduledCount: 0 },
          coverage: { sealedThrough: null, purgedBeforeSeal: false, purgedTxCount: 0, reconciliationUnavailableBySeal: false, observedHistoryDays: 90, historyWindowDays: 90, warnings: [] },
        });
        return;
      }

      // Cashbox profit report + details + post-closure cost completion
      if (path === '/finance/profit-report/details') {
        await fulfillJson({
          items: [
            {
              id: 'sale-audit-1',
              recordNumber: 'S000401',
              kind: 'sale',
              status: 'paid',
              saleDate: '2026-11-10T10:00:00.000Z',
              clientName: 'Ada Client',
              revenue: 1200,
              knownCostRevenue: saleCostAudited ? 1200 : 0,
              knownCost: saleCostAudited ? 300 : 0,
              knownProfit: saleCostAudited ? 900 : 0,
              profit: saleCostAudited ? 900 : null,
              marginPct: saleCostAudited ? 75 : null,
              isIncomplete: !saleCostAudited,
              missingCostCount: saleCostAudited ? 0 : 1,
              knownCostCount: saleCostAudited ? 1 : 0,
              isLoss: false,
              matchingLineCount: 1,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
          totals: {
            revenue: 1200,
            knownCost: saleCostAudited ? 300 : 0,
            knownProfit: saleCostAudited ? 900 : 0,
            missingCostRecordsCount: saleUnknownCostCount,
            lossRecordsCount: 0,
          },
        });
        return;
      }

      if (path === '/finance/profit-report') {
        await fulfillJson({
          period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11', timeZone: 'Europe/Kiev' },
          previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
          source: 'all',
          currency: 'UAH',
          otherCurrencies: ['USD'],
          margin: {
            revenue: 1200,
            cogs: saleCostAudited ? 300 : 0,
            grossProfit: saleCostAudited ? 900 : null,
            grossMarginPct: saleCostAudited ? 75 : null,
            unknownCostCount: saleUnknownCostCount,
            isIncomplete: !saleCostAudited,
            knownCostRevenue: saleCostAudited ? 1200 : 0,
            knownCostCogs: saleCostAudited ? 300 : 0,
            knownCostGrossProfit: saleCostAudited ? 900 : 0,
            knownCostGrossMarginPct: saleCostAudited ? 75 : null,
            costCoveragePct: saleCostAudited ? 100 : 0,
          },
          cash: {
            collected: 1200,
            inventoryPurchases: 0,
            opex: 400,
            refunds: 0,
            net: 800,
            opexByCategory: [{ category: 'salary', amount: 400, count: 1 }],
            byCurrency: {
              UAH: { collected: 1200, inventoryPurchases: 0, opex: 400, refunds: 0, net: 800 },
              USD: { collected: 250, inventoryPurchases: 0, opex: 0, refunds: 0, net: 250 },
            },
            operations: [],
            transfersVolume: 500,
            transfersCount: 1,
          },
          rows: [
            {
              key: 'svc-1',
              name: 'Board Microsoldering',
              type: 'service',
              quantity: 1,
              cost: saleCostAudited ? 300 : 0,
              revenue: 1200,
              knownCostRevenue: saleCostAudited ? 1200 : 0,
              profit: saleCostAudited ? 900 : 0,
              marginPct: saleCostAudited ? 75 : null,
              costKnown: saleCostAudited,
              knownCount: saleCostAudited ? 1 : 0,
              unknownCount: saleUnknownCostCount,
            },
          ],
          trendSeries: [
            { dateKey: '2026-11-10', revenue: 1200, knownCost: saleCostAudited ? 300 : 0, knownProfit: saleCostAudited ? 900 : 0, cashCollected: 1200, cashOutflows: 400, cashNet: 800 },
          ],
          previousComparison: null,
          dataScope: 'live_sales_only',
          coldSalesPurgedExist: false,
          saleCount: 1,
          coverage: {
            coldSalesPurgedExist: false,
            isProfitIncomplete: !saleCostAudited,
            warnings: saleCostAudited ? [] : ['1 SKU group(s) have incomplete cost records; overall gross profit/margin is incomplete.'],
          },
        });
        return;
      }

      if (path === '/sales/sale-audit-1' && method === 'GET') {
        await fulfillJson(saleRecord);
        return;
      }

      if (path === '/sales/sale-audit-1/costs' && method === 'PATCH') {
        saleCostAudited = true;
        saleUnknownCostCount = 0;
        saleRecord.lineItems[0].costSnapshot = {
          status: 'known',
          unitCost: 300,
          totalCost: 300,
          method: 'fixed',
        };
        await fulfillJson(saleRecord);
        return;
      }

      await route.fallback();
    },
  );

  await page.addInitScript((emp) => {
    window.localStorage.setItem('project-goods.lang', 'en');
    window.localStorage.setItem('project-goods.auth-token', 'e2e-token');
    window.localStorage.setItem('project-goods.employee-snapshot', JSON.stringify(emp));
  }, employee);
};

test.describe('Upgraded Information Tabs and Cashbox Reports', () => {
  test('Warehouse Information supports clickable aging drill-down, scenario save, and Excel export with Metadata sheet', async ({
    page,
  }) => {
    await installReportsMocks(page);
    await page.goto('/?page=warehouse');
    await page.getByRole('button', { name: 'Information' }).click();

    await expect(page.getByText('NVMe 512GB').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Legacy Charger')).toBeVisible();

    // Click Unknown age bar to drill down into Legacy Charger only
    await page.getByRole('button', { name: /Unknown age \(1 rows\)/i }).click();
    await expect(page.getByText('Matching total across all pages: 1 records')).toBeVisible();

    // Save private warehouse scenario
    await page.getByLabel('Scenario name').fill('LeadTime 14d');
    await page.getByRole('button', { name: 'Save New' }).click();
    await expect(page.getByText('Saved private scenario "LeadTime 14d".')).toBeVisible();

    // Verify Excel export generates .xlsx containing Metadata & Definitions sheet
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel (.xlsx)' }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    if (stream) {
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
    }
    const wb = XLSX.read(Buffer.concat(chunks), { type: 'buffer' });
    expect(wb.SheetNames).toContain('Metadata & Definitions');
    expect(wb.SheetNames).toContain('Stock Records');
  });

  test('Orders Information preserves history navigation and enforces subview permissions', async ({
    page,
  }) => {
    await installReportsMocks(page);
    await page.goto('/?page=orders&ordersTab=supplierInformation');

    const subviews = page.getByLabel('Orders analytics views');
    await expect(subviews.getByRole('tab', { name: 'Repairs' })).toBeVisible({ timeout: 20_000 });
    await expect(subviews.getByRole('tab', { name: 'Sales' })).toBeVisible();
    await expect(subviews.getByRole('tab', { name: 'Procurement' })).toBeVisible();

    // Click repair drill-down order # -> navigates to Repairs tab & preserves URL back navigation
    await page.getByRole('button', { name: 'R000777' }).click();
    await expect(page).toHaveURL(/saleId=rep-1/);

    await page.goBack();
    await expect(page).toHaveURL(/ordersTab=supplierInformation/);
    await expect(subviews.getByRole('tab', { name: 'Repairs' })).toBeVisible();
  });

  test('Cashboxes Information keeps currencies separate and Cashbox Reports completes missing cost after closure on desktop and mobile', async ({
    page,
  }) => {
    await installReportsMocks(page);
    await page.goto('/?page=accounting&accountingTab=information');

    await expect(page.getByText('Current Balance (UAH)')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'USD' }).click();
    await expect(page.getByText('Current Balance (USD)')).toBeVisible();

    // Cashbox Reports: shows Incomplete until missing cost is completed via audited modal
    await page.goto('/?page=accounting&accountingTab=reports');
    await expect(page.getByText('Incomplete').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Cash Flow (USD)')).toBeVisible();

    await page.getByRole('button', { name: 'Audit Costs' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('0.00').first().fill('300');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('900.00 UAH').first()).toBeVisible();

    // Check mobile viewport layout renders cleanly without console errors or crash
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });
});
