import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../product/model';
import { ServiceCatalog } from '../service-catalog/model';
import { Sale } from './model';
import {
  assertNoUnauthorizedFinancialCostOverrides,
  buildNextStatusTransitions,
  computeProductSnapshotValues,
  computeServiceSnapshotValues,
  evaluateSaleCostWarnings,
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

  it('audits post-closure missing cost completion and subsequent corrections while retaining immutable snapshot', async () => {
    const tSnap = new Date('2026-10-01T10:00:00.000Z');
    let savedDoc: Record<string, unknown> = {
      _id: { toString: () => saleId },
      recordNumber: 'R000042',
      saleDate: tSnap,
      quantity: 1,
      salePrice: 500,
      kind: 'repair',
      status: 'issued',
      paidAmount: 500,
      note: '',
      userNote: '',
      timeline: [],
      paymentHistory: [],
      lineItems: [
        {
          id: 'li-missing',
          kind: 'service',
          serviceId: svcFixedId,
          name: 'Micro-soldering',
          price: 500,
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

    vi.spyOn(ServiceCatalog, 'find').mockImplementation(
      () => ({ select: () => ({ lean: async () => [] }) }) as never,
    );
    vi.spyOn(Product, 'find').mockImplementation(
      () => ({ select: () => ({ lean: async () => [] }) }) as never,
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

    const completed = await updateSaleLineCosts(
      saleId,
      {
        items: [{ lineItemId: 'li-missing', unitCost: 0 }],
        reason: 'Confirmed zero outsourced cost',
      },
      managerWithFinance,
    );

    expect(completed.costWarnings.hasMissingCosts).toBe(false);
    const completedLine = completed.lineItems[0] as Record<string, unknown>;
    expect((completedLine.costSnapshot as Record<string, unknown>).status).toBe('unknown');
    expect(completedLine.auditedCost).toMatchObject({
      status: 'known',
      unitCost: 0,
      totalCost: 0,
    });

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
        reason: 'Invoice received from contractor',
      },
      managerWithFinance,
    );

    const correctedLine = corrected.lineItems[0] as Record<string, unknown>;
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
      reason: 'Invoice received from contractor',
      authorName: 'Olga Finance',
    });
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
});
