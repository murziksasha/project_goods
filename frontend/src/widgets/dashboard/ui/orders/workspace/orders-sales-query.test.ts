import { describe, expect, it } from 'vitest';
import { emptyOrdersFilters, kanbanVisibleRepairStatuses } from './orders-workspace-shared';
import { buildOrdersSalesListParams, SALES_KANBAN_PAGE_SIZE } from './orders-sales-query';

describe('buildOrdersSalesListParams', () => {
  it('pages repair orders with compact projection', () => {
    expect(
      buildOrdersSalesListParams({
        tab: 'orders',
        filters: {
          ...emptyOrdersFilters,
          dateFrom: '2026-01-01',
          favoritesOnly: true,
          statuses: ['new', 'ready'],
        },
        searchValue: 'r0001',
        page: 2,
        pageSize: 30,
      }),
    ).toEqual({
      kind: 'repair',
      compact: true,
      page: 2,
      pageSize: 30,
      dateFrom: '2026-01-01',
      dateTo: undefined,
      isFavorite: true,
      statuses: ['new', 'ready'],
      masterId: undefined,
      assigneeId: undefined,
      repairType: undefined,
      paymentMethod: undefined,
      q: 'r0001',
      recordNumber: undefined,
      client: undefined,
      product: undefined,
      service: undefined,
    });
  });

  it('loads visible kanban statuses without table paging', () => {
    const params = buildOrdersSalesListParams({
      tab: 'kanban',
      filters: { ...emptyOrdersFilters, assigneeId: 'master-1' },
      searchValue: '',
      page: 4,
      pageSize: 30,
    });
    expect(params.kind).toBe('repair');
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(SALES_KANBAN_PAGE_SIZE);
    expect(params.statuses).toEqual([...kanbanVisibleRepairStatuses]);
    expect(params.masterId).toBe('master-1');
  });

  it('maps sales tab sale type to isRapidSale and skips repair type', () => {
    expect(
      buildOrdersSalesListParams({
        tab: 'sales',
        filters: {
          ...emptyOrdersFilters,
          saleType: 'rapid',
          repairType: 'warranty',
        },
        searchValue: 'mouse',
        page: 1,
        pageSize: 30,
      }),
    ).toMatchObject({
      kind: 'sale',
      isRapidSale: true,
      repairType: undefined,
      q: 'mouse',
    });

    expect(
      buildOrdersSalesListParams({
        tab: 'sales',
        filters: { ...emptyOrdersFilters, saleType: 'regular' },
        searchValue: '',
        page: 1,
        pageSize: 30,
      }).isRapidSale,
    ).toBe(false);
  });
});
