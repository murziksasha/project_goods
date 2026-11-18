import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct } from '../catalog-product/model';
import * as catalogProductService from '../catalog-product/service';
import * as serviceCatalogService from '../service-catalog/service';
import { Employee } from '../employee/model';
import { Product } from '../product/model';
import * as errors from '../../shared/lib/errors';
import { normalizeSaleKit } from '../../shared/lib/parse/sale';
import { normalizeSalePayload } from '../../shared/lib/parsers';
import { formatSale } from '../../shared/lib/formatters';
import { Sale } from './model';
import { updateSaleWorkspace } from './service';
import { leanResult, leanSelectResult, withFormatSaleFields } from './test-helpers';
import { assertSaleKitPayload } from './validators';
import {
  isAwayStatusWorkspacePatch,
  isKanbanBoardWorkspacePatch,
  isManualCommentWorkspacePatch,
} from './workspace-permissions';

const saleId = '507f1f77bcf86cd799439012';

describe('sale kit normalization and validation', () => {
  it('trims, collapses spaces and drops empty or duplicate items', () => {
    expect(normalizeSaleKit(['  ЗП ', '', 'сумка', 'зп', 'чохол   шкіряний', 7])).toEqual([
      'ЗП',
      'сумка',
      'чохол шкіряний',
    ]);
    expect(normalizeSaleKit(undefined)).toEqual([]);
    expect(normalizeSaleKit('ЗП')).toEqual([]);
    expect(normalizeSalePayload({ kit: [' ЗП ', 'сумка'] }).kit).toEqual(['ЗП', 'сумка']);
    expect(normalizeSalePayload({}).kit).toEqual([]);
  });

  it('accepts missing kit and valid lists', () => {
    expect(() => assertSaleKitPayload(undefined)).not.toThrow();
    expect(() => assertSaleKitPayload([])).not.toThrow();
    expect(() => assertSaleKitPayload(['ЗП', 'сумка'])).not.toThrow();
    // 21 raw entries collapse to 20 unique items after normalization.
    expect(() =>
      assertSaleKitPayload([...Array.from({ length: 20 }, (_, i) => `item ${i}`), 'item 0']),
    ).not.toThrow();
  });

  it('rejects non-lists, non-text items, too many items and too long items with 400', () => {
    const expect400 = (value: unknown, message: RegExp) => {
      try {
        assertSaleKitPayload(value);
        throw new Error('expected to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(errors.HttpError);
        expect((error as errors.HttpError).statusCode).toBe(400);
        expect((error as Error).message).toMatch(message);
      }
    };
    expect400('ЗП, сумка', /list/);
    expect400(['ЗП', 5], /text/);
    expect400(Array.from({ length: 21 }, (_, i) => `item ${i}`), /20 items/);
    expect400(['x'.repeat(81)], /80 characters/);
  });

  it('formats the kit in API responses', () => {
    const formatted = formatSale(
      withFormatSaleFields({
        _id: saleId,
        kind: 'repair',
        status: 'new',
        quantity: 1,
        salePrice: 0,
        note: '',
        kit: ['ЗП'],
        timeline: [],
        paymentHistory: [],
        lineItems: [],
      }) as never,
    );
    expect(formatted.kit).toEqual(['ЗП']);
  });
});

describe('workspace permission predicates treat kit as a content change', () => {
  const sale = {
    kind: 'repair',
    status: 'new',
    paidAmount: 0,
    master: null,
    issuedBy: null,
    productSnapshot: { name: 'Laptop', serialNumber: '' },
    discount: { mode: 'percent', value: 0 },
    paymentHistory: [],
    lineItems: [],
    timeline: [],
    userNote: '',
    kit: ['ЗП'],
  };

  it('does not allow a kit change through the kanban, away or chat shortcuts', () => {
    expect(isKanbanBoardWorkspacePatch(sale, { status: 'in_progress', kit: ['ЗП', 'сумка'] })).toBe(false);
    expect(isKanbanBoardWorkspacePatch(sale, { status: 'in_progress' })).toBe(true);
    expect(isKanbanBoardWorkspacePatch(sale, { status: 'in_progress', kit: [' ЗП '] })).toBe(true);
    expect(isAwayStatusWorkspacePatch(sale, { status: 'away', kit: [] })).toBe(false);
    expect(isAwayStatusWorkspacePatch(sale, { status: 'away' })).toBe(true);
    const timeline = [
      { id: 't1', author: 'A', message: 'hello', createdAt: '2026-11-18T10:00:00.000Z' },
    ];
    expect(isManualCommentWorkspacePatch(sale, { timeline, kit: ['сумка'] })).toBe(false);
    expect(isManualCommentWorkspacePatch(sale, { timeline })).toBe(true);
  });
});

describe('updateSaleWorkspace kit', () => {
  let currentSale: Record<string, unknown>;
  const updateCalls: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    updateCalls.length = 0;
    currentSale = withFormatSaleFields({
      _id: saleId,
      kind: 'repair',
      status: 'new',
      paidAmount: 0,
      salePrice: 0,
      quantity: 1,
      note: '(kits: old)',
      kit: ['ЗП'],
      productSnapshot: { article: 'REPAIR', name: 'Laptop', serialNumber: '' },
      timeline: [],
      paymentHistory: [],
      lineItems: [],
      discount: { mode: 'amount', value: 0 },
      master: null,
      issuedBy: null,
    });
    vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
      (value: unknown) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
    );
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => 0,
    });
    vi.spyOn(errors, 'assertNotStale').mockImplementation(() => undefined);
    vi.spyOn(catalogProductService, 'upsertCatalogProducts').mockResolvedValue(undefined as never);
    vi.spyOn(serviceCatalogService, 'attachServiceCatalogIds').mockImplementation(
      async (items) => items,
    );
    vi.spyOn(CatalogProduct, 'countDocuments').mockResolvedValue(0 as never);
    vi.spyOn(Sale, 'find').mockReturnValue(leanSelectResult([]) as never);
    vi.spyOn(Sale, 'findById').mockImplementation(() => leanResult(currentSale) as never);
    vi.spyOn(Sale, 'findByIdAndUpdate').mockImplementation((_id: unknown, update: any) => {
      updateCalls.push(update);
      return leanResult(withFormatSaleFields({ ...currentSale, ...update })) as never;
    });
    vi.spyOn(Product, 'findById').mockReturnValue(leanResult(null) as never);
    vi.spyOn(Employee, 'findById').mockReturnValue(leanResult(null) as never);
  });

  it('persists the edited kit together with the order-history entry', async () => {
    const historyEntry = {
      id: 'kit-1',
      kind: 'system',
      author: 'Олена',
      message: 'Олена оновив комплект: ЗП → ЗП, сумка.',
      createdAt: '2026-11-18T10:00:00.000Z',
    };
    const result = await updateSaleWorkspace(saleId, {
      kind: 'repair',
      status: 'new',
      kit: ['ЗП', ' сумка '],
      timeline: [historyEntry],
    });

    expect(updateCalls[0].kit).toEqual(['ЗП', 'сумка']);
    expect(updateCalls[0].timeline).toEqual([
      expect.objectContaining({ id: 'kit-1', kind: 'system', message: historyEntry.message }),
    ]);
    expect(result.kit).toEqual(['ЗП', 'сумка']);
  });

  it('keeps the stored kit when the patch does not mention it', async () => {
    await updateSaleWorkspace(saleId, { kind: 'repair', status: 'new' });
    expect(updateCalls[0].kit).toEqual(['ЗП']);
  });

  it('allows clearing the kit', async () => {
    await updateSaleWorkspace(saleId, { kind: 'repair', status: 'new', kit: [] });
    expect(updateCalls[0].kit).toEqual([]);
  });

  it('rejects an invalid kit before writing', async () => {
    await expect(
      updateSaleWorkspace(saleId, {
        kind: 'repair',
        status: 'new',
        kit: Array.from({ length: 21 }, (_, i) => `item ${i}`),
      }),
    ).rejects.toThrow(/20 items/);
    expect(updateCalls).toHaveLength(0);
  });
});
