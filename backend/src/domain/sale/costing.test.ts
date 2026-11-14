import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../product/model';
import { ServiceCatalog } from '../service-catalog/model';
import { FinancePolicy } from '../finance/model';
import { Sale } from './model';
import {
  assertNoUnauthorizedFinancialCostOverrides,
  buildNextStatusTransitions,
  computeProductSnapshotValues,
  computeServiceSnapshotValues,
  evaluateSaleCostWarnings,
  isProductLineItemEligibleForCostAudit,
  isServiceLineItemEligibleForCostAudit,
  prepareLineItemsWithCostSnapshots,
  resolveLineItemEffectiveCost,
  scaleReturnedLineItemCostSnapshots,
  updateSaleLineCosts,
} from './costing';

const svcFixedId = '507f1f77bcf86cd799439101';
const svcTimeId = '507f1f77bcf86cd799439102';
const prodId = '507f1f77bcf86cd799439201';
const saleId = '507f1f77bcf86cd799439301';

const managerWithFinance = {
  _id: { toString: () => 'emp-mgr-fin' },
  name: 'Olga Finance',
  role: 'manager',
  permissions: ['orders.manage', 'sales.manage', 'finance.view'],
} as never;

const managerWithoutFinance = {
  _id: { toString: () => 'emp-mgr' },
  name: 'Ivan Manager',
  role: 'manager',
  permissions: ['orders.manage', 'sales.manage'],
} as never;

const financeViewerOnly = {
  _id: { toString: () => 'emp-fin' },
  name: 'Petro Finance',
  role: 'support',
  permissions: ['finance.view', 'orders.view'],
} as never;

describe('sale costing & snapshot domain logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
      (value: unknown) =>
        typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
    );
  });

  it('computes fixed and time_rate service costs and distinguishes explicit 0 from missing', () => {
    const now = new Date('2026-10-01T10:00:00.000Z');

    const fixed = computeServiceSnapshotValues({
      quantity: 2,
      costMethod: 'fixed',
      fixedCost: 150,
      hourlyCost: null,
      recordedMinutes: null,
      directExpenses: 25,
      unitCostOverride: null,
      actorId: 'u1',
      actorName: 'User',
      capturedAt: now,
    });
    expect(fixed).toMatchObject({
      status: 'known',
      method: 'fixed',
      laborCost: 300,
      directExpenses: 25,
      totalCost: 325,
      unitCost: 162.5,
    });

    const timeRate = computeServiceSnapshotValues({
      quantity: 1,
      costMethod: 'time_rate',
      fixedCost: null,
      hourlyCost: 600,
      recordedMinutes: 45,
      directExpenses: 15,
      unitCostOverride: null,
      actorId: 'u1',
      actorName: 'User',
      capturedAt: now,
    });
    expect(timeRate).toMatchObject({
      status: 'known',
      method: 'time_rate',
      laborCost: 450,
      directExpenses: 15,
      totalCost: 465,
      unitCost: 465,
      recordedMinutes: 45,
      hourlyCost: 600,
    });

    const explicitZero = computeServiceSnapshotValues({
      quantity: 1,
      costMethod: 'fixed',
      fixedCost: 0,
      hourlyCost: null,
      recordedMinutes: null,
      directExpenses: null,
      unitCostOverride: null,
      actorId: 'u1',
      actorName: 'User',
      capturedAt: now,
    });
    expect(explicitZero).toMatchObject({
      status: 'known',
      totalCost: 0,
      unitCost: 0,
    });

    const missing = computeServiceSnapshotValues({
      quantity: 1,
      costMethod: 'fixed',
      fixedCost: null,
      hourlyCost: null,
      recordedMinutes: null,
      directExpenses: 20,
      unitCostOverride: null,
      actorId: 'u1',
      actorName: 'User',
      capturedAt: now,
    });
    expect(missing).toMatchObject({
      status: 'unknown',
      method: 'unknown',
      totalCost: null,
      unitCost: null,
    });

    const missingProduct = computeProductSnapshotValues({
      quantity: 1,
      productPrice: null,
      directExpenses: null,
      unitCostOverride: null,
      actorId: 'u1',
      actorName: 'User',
      capturedAt: now,
    });
    expect(missingProduct.status).toBe('unknown');
    expect(missingProduct.totalCost).toBeNull();
  });

  it('captures immutable snapshots on first stock-committed status and ignores subsequent catalog edits', async () => {
    let currentCatalogFixed = 120;
    let currentProductPrice = 400;

    vi.spyOn(ServiceCatalog, 'find').mockImplementation(
      () =>
        ({
          select: () => ({
            lean: async () => [
              {
                _id: { toString: () => svcFixedId },
                costMethod: 'fixed',
                fixedCost: currentCatalogFixed,
                hourlyCost: null,
                defaultDurationMinutes: null,
              },
              {
                _id: { toString: () => svcTimeId },
                costMethod: 'time_rate',
                fixedCost: null,
                hourlyCost: 400,
                defaultDurationMinutes: 30,
              },
            ],
          }),
        }) as never,
    );
    vi.spyOn(Product, 'find').mockImplementation(
      () =>
        ({
          select: () => ({
            lean: async () => [
              { _id: { toString: () => prodId }, price: currentProductPrice },
            ],
          }),
        }) as never,
    );

    const t0 = new Date('2026-10-01T08:00:00.000Z');
    const draft = await prepareLineItemsWithCostSnapshots({
      kind: 'repair',
      nextStatus: 'inRepair',
      incomingLineItems: [
        {
          id: 'li-prod',
          kind: 'product',
          productId: prodId,
          name: 'Battery',
          price: 900,
          quantity: 1,
        },
        {
          id: 'li-svc-1',
          kind: 'service',
          serviceId: svcFixedId,
          name: 'Diagnostics',
          price: 300,
          quantity: 1,
        },
      ],
      employee: managerWithFinance,
      now: t0,
    });
    expect(draft.firstStockCommittedAt).toBeNull();
    expect(draft.lineItems[0]?.costSnapshot).toBeNull();

    // Update catalog & stock cost BEFORE first commit -> commit captures current values.
    currentCatalogFixed = 180;
    currentProductPrice = 450;
    const t1 = new Date('2026-10-01T10:00:00.000Z');
    const committed = await prepareLineItemsWithCostSnapshots({
      kind: 'repair',
      nextStatus: 'issued',
      existingLineItems: draft.lineItems,
      incomingLineItems: draft.lineItems,
      existingFirstStockCommittedAt: draft.firstStockCommittedAt,
      employee: managerWithFinance,
      now: t1,
    });

    expect(committed.firstStockCommittedAt).toEqual(t1);
    expect(committed.lineItems[0]?.costSnapshot).toMatchObject({
      status: 'known',
      unitCost: 450,
      totalCost: 450,
      capturedAt: t1,
    });
    expect(committed.lineItems[1]?.costSnapshot).toMatchObject({
      status: 'known',
      unitCost: 180,
      totalCost: 180,
      capturedAt: t1,
    });

    // Mutate catalog AFTER commit and re-run transition -> snapshots MUST remain immutable.
    currentCatalogFixed = 999;
    currentProductPrice = 888;
    const t2 = new Date('2026-10-05T12:00:00.000Z');
    const reissued = await prepareLineItemsWithCostSnapshots({
      kind: 'repair',
      nextStatus: 'issued',
      existingLineItems: committed.lineItems,
      incomingLineItems: committed.lineItems,
      existingFirstStockCommittedAt: committed.firstStockCommittedAt,
      employee: managerWithFinance,
      now: t2,
    });

    expect(reissued.firstStockCommittedAt).toEqual(t1);
    expect(reissued.lineItems[0]?.costSnapshot?.totalCost).toBe(450);
    expect(reissued.lineItems[1]?.costSnapshot?.totalCost).toBe(180);
  });

  it('allows completion when costs are missing and emits non-blocking missing-cost warnings', async () => {
    vi.spyOn(ServiceCatalog, 'find').mockImplementation(
      () =>
        ({
          select: () => ({
            lean: async () => [
              {
                _id: { toString: () => svcFixedId },
                costMethod: 'fixed',
                fixedCost: null,
                hourlyCost: null,
                defaultDurationMinutes: null,
              },
            ],
          }),
        }) as never,
    );
    vi.spyOn(Product, 'find').mockImplementation(
      () => ({ select: () => ({ lean: async () => [] }) }) as never,
    );

    const committed = await prepareLineItemsWithCostSnapshots({
      kind: 'sale',
      nextStatus: 'paid',
      incomingLineItems: [
        {
          id: 'li-cat',
          kind: 'product',
          catalogProductId: '507f1f77bcf86cd799439999',
          name: 'Adapter',
          price: 500,
          quantity: 1,
        },
        {
          id: 'li-svc',
          kind: 'service',
          serviceId: svcFixedId,
          name: 'Setup',
          price: 200,
          quantity: 1,
        },
      ],
      employee: managerWithFinance,
    });

    expect(committed.lineItems[0]?.costSnapshot?.status).toBe('unknown');
    expect(committed.lineItems[1]?.costSnapshot?.status).toBe('unknown');
    expect(committed.costWarnings).toEqual({
      hasMissingCosts: true,
      missingCostCount: 2,
      missingCostLineItemIds: ['li-cat', 'li-svc'],
    });
  });

  it('never infers legacy service cost as 0 without snapshot and uses stock price only for linked Product', () => {
    const productMap = new Map<string, number | null>([[prodId, 310]]);

    const legacySvc = resolveLineItemEffectiveCost(
      {
        id: 'legacy-svc',
        kind: 'service',
        name: 'Legacy service',
        price: 300,
        quantity: 1,
      },
      productMap,
    );
    expect(legacySvc.status).toBe('unknown');
    expect(legacySvc.totalCost).toBeNull();

    const legacyCatalogProd = resolveLineItemEffectiveCost(
      {
        id: 'legacy-cat-prod',
        kind: 'product',
        name: 'Legacy adapter',
        price: 250,
        quantity: 2,
      },
      productMap,
    );
    expect(legacyCatalogProd.status).toBe('unknown');

    const legacyStockProd = resolveLineItemEffectiveCost(
      {
        id: 'legacy-stock-prod',
        kind: 'product',
        productId: prodId,
        name: 'Battery',
        price: 700,
        quantity: 2,
      },
      productMap,
    );
    expect(legacyStockProd).toMatchObject({
      status: 'known',
      unitCost: 310,
      totalCost: 620,
      source: 'legacy_product',
    });
  });

  it('enforces manage + finance.view permission for financial cost overrides', () => {
    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        incomingLineItems: [
          { id: '1', kind: 'service', name: 'Diagnostics', directExpenses: 50 },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/finance\.view/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'sale',
        incomingLineItems: [
          { id: '1', kind: 'product', name: 'Cable', unitCostOverride: 10 },
        ],
        employee: financeViewerOnly,
      }),
    ).toThrow(/finance\.view/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [
          {
            id: '1',
            kind: 'service',
            name: 'Repair',
            price: 500,
            quantity: 1,
            costMethod: 'fixed',
            fixedCost: 120,
          },
        ],
        incomingLineItems: [
          {
            id: '1',
            kind: 'service',
            name: 'Repair',
            price: 500,
            quantity: 1,
            costMethod: 'fixed',
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).not.toThrow();
  });

  it('persists requiresCostAudit only for products added without purchase price and preserves it after completion', async () => {
    const zeroPriceProdId = '507f1f77bcf86cd799439202';
    vi.spyOn(ServiceCatalog, 'find').mockImplementation(
      () => ({ select: () => ({ lean: async () => [] }) }) as never,
    );
    vi.spyOn(Product, 'find').mockImplementation(
      () =>
        ({
          select: () => ({
            lean: async () => [
              { _id: { toString: () => prodId }, price: 320 },
              { _id: { toString: () => zeroPriceProdId }, price: 0 },
            ],
          }),
        }) as never,
    );

    const draft = await prepareLineItemsWithCostSnapshots({
      kind: 'repair',
      nextStatus: 'inRepair',
      incomingLineItems: [
        {
          id: 'li-missing-prod',
          kind: 'product',
          catalogProductId: '507f1f77bcf86cd799439991',
          name: 'Custom Screen',
          price: 1200,
          quantity: 1,
        },
        {
          id: 'li-stock-prod',
          kind: 'product',
          productId: prodId,
          name: 'Battery',
          price: 800,
          quantity: 1,
        },
        {
          id: 'li-zero-stock-prod',
          kind: 'product',
          productId: zeroPriceProdId,
          name: 'Promo Sticker',
          price: 100,
          quantity: 1,
        },
        {
          id: 'li-explicit-zero',
          kind: 'product',
          name: 'Free Sim Tray',
          price: 50,
          quantity: 1,
          unitCostOverride: 0,
        },
        {
          id: 'li-svc',
          kind: 'service',
          serviceId: svcFixedId,
          name: 'Unknown Service',
          price: 400,
          quantity: 1,
        },
      ],
      employee: managerWithFinance,
    });

    expect(draft.lineItems[0]?.requiresCostAudit).toBe(true);
    expect(draft.lineItems[1]?.requiresCostAudit).toBe(false);
    expect(draft.lineItems[2]?.requiresCostAudit).toBe(false);
    expect(draft.lineItems[3]?.requiresCostAudit).toBe(false);
    // Service without calculated cost on add persists requiresCostAudit: true regardless of toggle
    expect(draft.lineItems[4]?.requiresCostAudit).toBe(true);

    // Legacy orders without persisted requiresCostAudit
    expect(
      isProductLineItemEligibleForCostAudit({
        id: 'leg-svc',
        kind: 'service',
        name: 'Svc',
        price: 100,
        quantity: 1,
        costSnapshot: { status: 'unknown', unitCost: null, totalCost: null, method: 'unknown', laborCost: null, directExpenses: null, recordedMinutes: null, hourlyCost: null, fixedCost: null, capturedAt: new Date(), capturedById: null, capturedByName: null },
      }),
    ).toBe(false);
    expect(
      isServiceLineItemEligibleForCostAudit({
        id: 'leg-svc',
        kind: 'service',
        name: 'Svc',
        price: 100,
        quantity: 1,
        costSnapshot: { status: 'unknown', unitCost: null, totalCost: null, method: 'unknown', laborCost: null, directExpenses: null, recordedMinutes: null, hourlyCost: null, fixedCost: null, capturedAt: new Date(), capturedById: null, capturedByName: null },
      }),
    ).toBe(true);
    expect(
      isProductLineItemEligibleForCostAudit({
        id: 'leg-known-prod',
        kind: 'product',
        productId: prodId,
        name: 'Priced',
        price: 100,
        quantity: 1,
        costSnapshot: { status: 'known', unitCost: 320, totalCost: 320, method: 'stock', laborCost: null, directExpenses: null, recordedMinutes: null, hourlyCost: null, fixedCost: null, capturedAt: new Date(), capturedById: null, capturedByName: null },
      }),
    ).toBe(false);
    expect(
      isProductLineItemEligibleForCostAudit({
        id: 'leg-audited-prod',
        kind: 'product',
        name: 'Old Missing',
        price: 100,
        quantity: 1,
        costSnapshot: { status: 'unknown', unitCost: null, totalCost: null, method: 'unknown', laborCost: null, directExpenses: null, recordedMinutes: null, hourlyCost: null, fixedCost: null, capturedAt: new Date(), capturedById: null, capturedByName: null },
        auditedCost: { status: 'known', unitCost: 50, totalCost: 50, method: 'manual', laborCost: null, directExpenses: null, recordedMinutes: null, hourlyCost: null, fixedCost: null, capturedAt: new Date(), capturedById: null, capturedByName: null },
        costAuditLog: [
          {
            id: 'a1',
            previousStatus: 'unknown',
            previousUnitCost: null,
            previousTotalCost: null,
            newStatus: 'known',
            newUnitCost: 50,
            newTotalCost: 50,
            method: 'manual',
            directExpenses: null,
            recordedMinutes: null,
            hourlyCost: null,
            fixedCost: null,
            reason: 'Filled',
            authorId: null,
            authorName: 'Owner',
            changedAt: new Date(),
          },
        ],
      }),
    ).toBe(true);
  });

  it('audits eligible products before/after closure, preserves requiresCostAudit, and rejects services or priced products', async () => {
    const tSnap = new Date('2026-10-01T10:00:00.000Z');
    let savedDoc: Record<string, unknown> = {
      _id: { toString: () => saleId },
      recordNumber: 'R000042',
      saleDate: tSnap,
      quantity: 1,
      salePrice: 1200,
      kind: 'repair',
      status: 'inRepair',
      paidAmount: 0,
      note: '',
      userNote: '',
      timeline: [],
      paymentHistory: [],
      lineItems: [
        {
          id: 'li-missing',
          kind: 'product',
          catalogProductId: '507f1f77bcf86cd799439991',
          name: 'Custom Screen',
          price: 700,
          quantity: 1,
          requiresCostAudit: true,
          costSnapshot: null,
          auditedCost: null,
          costAuditLog: [],
        },
        {
          id: 'li-priced-prod',
          kind: 'product',
          productId: prodId,
          name: 'Stock Cable',
          price: 200,
          quantity: 1,
          requiresCostAudit: false,
          costSnapshot: null,
          auditedCost: null,
          costAuditLog: [],
        },
        {
          id: 'li-svc',
          kind: 'service',
          serviceId: svcFixedId,
          name: 'Micro-soldering',
          price: 300,
          quantity: 1,
          requiresCostAudit: false,
          costSnapshot: null,
          auditedCost: null,
          costAuditLog: [],
        },
      ],
      discount: { mode: 'percent', value: 0 },
      client: { toString: () => 'client-1' },
      clientSnapshot: { name: 'Client', phone: '+380500000001', status: 'new' },
      product: null,
      productSnapshot: { article: 'REPAIR', name: 'Phone', serialNumber: '' },
      manager: null,
      master: null,
      issuedBy: null,
      createdAt: tSnap,
      updatedAt: tSnap,
    };

    vi.spyOn(ServiceCatalog, 'find').mockImplementation(
      () => ({ select: () => ({ lean: async () => [] }) }) as never,
    );
    vi.spyOn(Product, 'find').mockImplementation(
      () =>
        ({
          select: () => ({
            lean: async () => [{ _id: { toString: () => prodId }, price: 80 }],
          }),
        }) as never,
    );
    vi.spyOn(Sale, 'findById').mockImplementation(
      () => ({ lean: async () => savedDoc }) as never,
    );
    vi.spyOn(Sale, 'findByIdAndUpdate').mockImplementation((_id, update) => {
      savedDoc = { ...savedDoc, ...(update as Record<string, unknown>) };
      return { lean: async () => savedDoc } as never;
    });

    await expect(
      updateSaleLineCosts(
        saleId,
        { items: [{ lineItemId: 'li-missing', unitCost: 220 }] },
        managerWithoutFinance,
      ),
    ).rejects.toThrow(/finance\.view/i);

    // Rejects service line item audit when serviceAuditEnabled is false
    await expect(
      updateSaleLineCosts(
        saleId,
        { items: [{ lineItemId: 'li-svc', unitCost: 50 }], reason: 'Service attempt' },
        managerWithFinance,
      ),
    ).rejects.toThrow(/service cost audit is currently disabled/i);

    // Rejects product added with known stock price
    await expect(
      updateSaleLineCosts(
        saleId,
        { items: [{ lineItemId: 'li-priced-prod', unitCost: 90 }], reason: 'Priced attempt' },
        managerWithFinance,
      ),
    ).rejects.toThrow(/does not require cost audit/i);

    // Pre-payment completion with explicit 0 succeeds and keeps requiresCostAudit: true
    const completed = await updateSaleLineCosts(
      saleId,
      {
        items: [{ lineItemId: 'li-missing', unitCost: 0 }],
      },
      managerWithFinance,
    );

    const completedLine = completed.lineItems[0] as Record<string, unknown>;
    expect(completedLine.requiresCostAudit).toBe(true);
    expect(completedLine.auditedCost).toMatchObject({
      status: 'known',
      unitCost: 0,
      totalCost: 0,
    });

    // Simulate order closure with immutable unknown snapshot
    savedDoc = {
      ...savedDoc,
      status: 'issued',
      paidAmount: 1200,
      firstStockCommittedAt: tSnap,
      lineItems: (savedDoc.lineItems as Array<Record<string, unknown>>).map((li) =>
        li.id === 'li-missing'
          ? {
              ...li,
              costSnapshot: {
                status: 'unknown',
                unitCost: null,
                totalCost: null,
                method: 'unknown',
                laborCost: null,
                directExpenses: null,
                recordedMinutes: null,
                hourlyCost: null,
                fixedCost: null,
                capturedAt: tSnap,
                capturedById: null,
                capturedByName: null,
              },
            }
          : li,
      ),
    };

    // Correcting already-known cost requires a reason
    await expect(
      updateSaleLineCosts(
        saleId,
        { items: [{ lineItemId: 'li-missing', unitCost: 140 }] },
        managerWithFinance,
      ),
    ).rejects.toThrow(/reason is required/i);

    const corrected = await updateSaleLineCosts(
      saleId,
      {
        items: [
          {
            lineItemId: 'li-missing',
            unitCost: 140,
            directExpenses: 30,
          },
        ],
        reason: 'Invoice received from supplier',
      },
      managerWithFinance,
    );

    const correctedLine = corrected.lineItems[0] as Record<string, unknown>;
    expect(correctedLine.requiresCostAudit).toBe(true);
    expect((correctedLine.costSnapshot as Record<string, unknown>).status).toBe('unknown');
    expect(correctedLine.auditedCost).toMatchObject({
      status: 'known',
      totalCost: 170,
      directExpenses: 30,
    });
    const log = correctedLine.costAuditLog as Array<Record<string, unknown>>;
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({
      previousStatus: 'known',
      previousTotalCost: 0,
      newStatus: 'known',
      newTotalCost: 170,
      reason: 'Invoice received from supplier',
      authorName: 'Olga Finance',
    });

    // Preserved across subsequent prepareLineItemsWithCostSnapshots calls
    const rePrepared = await prepareLineItemsWithCostSnapshots({
      kind: 'repair',
      nextStatus: 'issued',
      existingLineItems: savedDoc.lineItems as never,
      incomingLineItems: savedDoc.lineItems as never,
      existingFirstStockCommittedAt: tSnap,
      employee: managerWithFinance,
    });
    expect(rePrepared.lineItems[0]?.requiresCostAudit).toBe(true);
    expect(rePrepared.lineItems[1]?.requiresCostAudit).toBe(false);
    expect(rePrepared.lineItems[2]?.requiresCostAudit).toBe(false);
  });

  it('scales partial return snapshots cleanly and appends status transitions', () => {
    const scaled = scaleReturnedLineItemCostSnapshots(
      {
        id: '1',
        kind: 'product',
        name: 'Cable',
        price: 100,
        quantity: 3,
        costSnapshot: {
          status: 'known',
          unitCost: 40,
          totalCost: 120,
          method: 'stock',
          laborCost: null,
          directExpenses: null,
          recordedMinutes: null,
          hourlyCost: null,
          fixedCost: null,
          capturedAt: new Date(),
          capturedById: null,
          capturedByName: null,
        },
      },
      2,
    );
    expect(scaled.quantity).toBe(2);
    expect(scaled.costSnapshot?.totalCost).toBe(80);
    expect(scaled.costSnapshot?.unitCost).toBe(40);

    const transitions = buildNextStatusTransitions({
      existingTransitions: [],
      fromStatus: 'new',
      toStatus: 'inRepair',
      employee: managerWithoutFinance,
      now: new Date('2026-10-02T10:00:00.000Z'),
    });
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      fromStatus: 'new',
      toStatus: 'inRepair',
      changedByName: 'Ivan Manager',
    });

    const warnings = evaluateSaleCostWarnings([
      {
        id: 'known-zero',
        kind: 'service',
        name: 'Free check',
        price: 0,
        quantity: 1,
        costSnapshot: {
          status: 'known',
          unitCost: 0,
          totalCost: 0,
          method: 'zero',
          laborCost: 0,
          directExpenses: null,
          recordedMinutes: null,
          hourlyCost: null,
          fixedCost: 0,
          capturedAt: new Date(),
          capturedById: null,
          capturedByName: null,
        },
      },
    ]);
    expect(warnings.hasMissingCosts).toBe(false);
  });

  it('audits eligible services when serviceAuditEnabled is true and preserves costs/history when disabled', async () => {
    const tSnap = new Date('2026-10-01T10:00:00.000Z');
    let serviceAuditEnabled = true;

    vi.spyOn(FinancePolicy, 'findOne').mockImplementation(
      () =>
        ({
          lean: async () => ({
            serviceAuditEnabled,
            serviceProfitMode: 'full',
            reportDefaults: {
              period: 'last30',
              source: 'all',
              showCharts: true,
              showTable: true,
            },
            version: 2,
          }),
        }) as never,
    );
    vi.spyOn(ServiceCatalog, 'find').mockImplementation(
      () =>
        ({
          select: () => ({
            lean: async () => [
              {
                _id: { toString: () => svcFixedId },
                costMethod: 'fixed',
                fixedCost: 120,
                hourlyCost: null,
                defaultDurationMinutes: null,
              },
            ],
          }),
        }) as never,
    );
    vi.spyOn(Product, 'find').mockImplementation(
      () => ({ select: () => ({ lean: async () => [] }) }) as never,
    );

    const prepared = await prepareLineItemsWithCostSnapshots({
      kind: 'repair',
      nextStatus: 'issued',
      incomingLineItems: [
        {
          id: 'svc-uncosted',
          kind: 'service',
          name: 'Custom soldering',
          price: 600,
          quantity: 1,
        },
        {
          id: 'svc-priced',
          kind: 'service',
          serviceId: svcFixedId,
          name: 'Catalog diagnostics',
          price: 300,
          quantity: 1,
        },
      ],
      employee: managerWithFinance,
      now: tSnap,
    });

    expect(prepared.lineItems[0]?.requiresCostAudit).toBe(true);
    expect(prepared.lineItems[1]?.requiresCostAudit).toBe(false);

    let savedDoc: Record<string, unknown> = {
      _id: { toString: () => saleId },
      recordNumber: 'R000099',
      saleDate: tSnap,
      quantity: 1,
      salePrice: 900,
      kind: 'repair',
      status: 'issued',
      paidAmount: 900,
      note: '',
      userNote: '',
      timeline: [],
      paymentHistory: [],
      lineItems: [
        ...prepared.lineItems,
        {
          id: 'svc-legacy-unknown',
          kind: 'service',
          name: 'Legacy service',
          price: 200,
          quantity: 1,
          costSnapshot: {
            status: 'unknown',
            unitCost: null,
            totalCost: null,
            method: 'unknown',
            laborCost: null,
            directExpenses: null,
            recordedMinutes: null,
            hourlyCost: null,
            fixedCost: null,
            capturedAt: tSnap,
            capturedById: null,
            capturedByName: null,
          },
          auditedCost: null,
          costAuditLog: [],
        },
      ],
      discount: { mode: 'percent', value: 0 },
      client: { toString: () => 'client-1' },
      clientSnapshot: { name: 'Client', phone: '+380500000001', status: 'new' },
      product: null,
      productSnapshot: { article: 'REPAIR', name: 'Phone', serialNumber: '' },
      manager: null,
      master: null,
      issuedBy: null,
      createdAt: tSnap,
      updatedAt: tSnap,
    };

    vi.spyOn(Sale, 'findById').mockImplementation(
      () => ({ lean: async () => savedDoc }) as never,
    );
    vi.spyOn(Sale, 'findByIdAndUpdate').mockImplementation((_id, update) => {
      savedDoc = { ...savedDoc, ...(update as Record<string, unknown>) };
      return { lean: async () => savedDoc } as never;
    });

    // Rejects catalog-priced service even when serviceAuditEnabled is true
    await expect(
      updateSaleLineCosts(
        saleId,
        { items: [{ lineItemId: 'svc-priced', fixedCost: 90 }], reason: 'Override' },
        managerWithFinance,
      ),
    ).rejects.toThrow(/does not require cost audit/i);

    // Audits uncosted service and legacy unknown-cost service
    const updated = await updateSaleLineCosts(
      saleId,
      {
        items: [
          {
            lineItemId: 'svc-uncosted',
            costMethod: 'time_rate',
            hourlyCost: 240,
            recordedMinutes: 30,
            directExpenses: 25,
          },
          {
            lineItemId: 'svc-legacy-unknown',
            costMethod: 'fixed',
            fixedCost: 80,
          },
        ],
      },
      managerWithFinance,
    );

    const auditedUncosted = updated.lineItems[0] as Record<string, unknown>;
    const auditedLegacy = updated.lineItems[2] as Record<string, unknown>;
    expect(auditedUncosted.requiresCostAudit).toBe(true);
    expect(auditedUncosted.auditedCost).toMatchObject({
      status: 'known',
      method: 'time_rate',
      totalCost: 145,
    });
    expect(auditedLegacy.requiresCostAudit).toBe(true);
    expect(auditedLegacy.auditedCost).toMatchObject({
      status: 'known',
      method: 'fixed',
      totalCost: 80,
    });

    // Disabling service audit blocks further service edits while preserving saved auditedCost & history
    serviceAuditEnabled = false;
    await expect(
      updateSaleLineCosts(
        saleId,
        {
          items: [{ lineItemId: 'svc-uncosted', fixedCost: 100 }],
          reason: 'Later adjustment',
        },
        managerWithFinance,
      ),
    ).rejects.toThrow(/service cost audit is currently disabled/i);

    const savedItems = savedDoc.lineItems as Array<Record<string, unknown>>;
    expect(savedItems[0]?.auditedCost).toMatchObject({ totalCost: 145 });
    expect((savedItems[0]?.costAuditLog as unknown[]).length).toBe(1);
  });
});

describe('assertNoUnauthorizedFinancialCostOverrides unchanged cost field echoes', () => {
  const capturedAt = new Date('2026-10-01T10:00:00.000Z');
  const snapshot = {
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
    capturedById: 'emp-fin',
    capturedByName: 'Olga Finance',
  };
  const auditEntry = {
    id: 'audit-1',
    previousStatus: 'known' as const,
    previousUnitCost: 180,
    previousTotalCost: 180,
    newStatus: 'known' as const,
    newUnitCost: 200,
    newTotalCost: 200,
    method: 'fixed' as const,
    directExpenses: 0,
    recordedMinutes: null,
    hourlyCost: null,
    fixedCost: 200,
    reason: 'Price correction',
    authorId: 'emp-fin',
    authorName: 'Olga Finance',
    changedAt: capturedAt,
  };
  const existingLine = {
    id: '1',
    kind: 'service' as const,
    name: 'Repair',
    price: 500,
    quantity: 1,
    costMethod: 'fixed' as const,
    fixedCost: 200,
    costSnapshot: snapshot,
    auditedCost: { ...snapshot, totalCost: 220, unitCost: 220 },
    costAuditLog: [auditEntry],
  };

  it('allows echoing unchanged costSnapshot, auditedCost and costAuditLog without finance.view', () => {
    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [existingLine],
        incomingLineItems: [
          {
            id: '1',
            kind: 'service',
            name: 'Repair',
            price: 500,
            quantity: 1,
            // Dates echoed as ISO strings, matching a JSON-serialized frontend payload
            costSnapshot: {
              ...snapshot,
              capturedAt: capturedAt.toISOString(),
            },
            auditedCost: {
              ...snapshot,
              totalCost: 220,
              unitCost: 220,
              capturedAt: '2026-10-01T10:00:00.000Z',
            },
            costAuditLog: [
              { ...auditEntry, changedAt: capturedAt.toISOString() },
            ],
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).not.toThrow();
  });

  it('treats null, undefined and empty-array cost fields as equal', () => {
    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [
          {
            id: '1',
            kind: 'service',
            name: 'Repair',
            price: 500,
            quantity: 1,
            costSnapshot: null,
            auditedCost: undefined,
            costAuditLog: [],
          },
        ],
        incomingLineItems: [
          {
            id: '1',
            kind: 'service',
            name: 'Repair',
            price: 500,
            quantity: 1,
            costSnapshot: null,
            auditedCost: null,
            costAuditLog: [],
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).not.toThrow();
  });

  it('rejects a changed costSnapshot, auditedCost or costAuditLog without finance.view', () => {
    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [existingLine],
        incomingLineItems: [
          {
            id: '1',
            costSnapshot: { ...snapshot, totalCost: 999 },
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/Direct cost snapshot modifications require .*finance\.view/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [existingLine],
        incomingLineItems: [
          {
            id: '1',
            auditedCost: { ...existingLine.auditedCost, totalCost: 1 },
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/Direct audited cost modifications require .*finance\.view/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [existingLine],
        incomingLineItems: [
          {
            id: '1',
            costAuditLog: [
              { ...auditEntry, reason: 'Tampered reason' },
            ],
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/Direct cost audit log modifications are not permitted/i);
  });

  it('rejects non-empty cost fields on new lines, and allows empty ones, without finance.view', () => {
    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [],
        incomingLineItems: [
          {
            id: 'new-1',
            kind: 'service',
            name: 'New repair',
            costSnapshot: snapshot,
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/Direct cost snapshot modifications require .*finance\.view/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [],
        incomingLineItems: [
          {
            id: 'new-1',
            kind: 'service',
            name: 'New repair',
            auditedCost: snapshot,
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/Direct audited cost modifications require .*finance\.view/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [],
        incomingLineItems: [
          {
            id: 'new-1',
            kind: 'service',
            name: 'New repair',
            costAuditLog: [auditEntry],
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).toThrow(/Direct cost audit log modifications are not permitted/i);

    expect(() =>
      assertNoUnauthorizedFinancialCostOverrides({
        kind: 'repair',
        existingLineItems: [],
        incomingLineItems: [
          {
            id: 'new-1',
            kind: 'service',
            name: 'New repair',
            price: 100,
            quantity: 1,
            costSnapshot: null,
            auditedCost: null,
            costAuditLog: [],
          },
        ],
        employee: managerWithoutFinance,
      }),
    ).not.toThrow();
  });
});
