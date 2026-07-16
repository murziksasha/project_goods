import { describe, expect, it } from 'vitest';
import {
  buildSalesFilter,
  hasSalesListFilters,
  parseListSalesQuery,
  SALES_LIST_MAX_LIMIT,
} from './list-sales-query';

describe('list-sales-query', () => {
  it('parses empty query as full-list options', () => {
    expect(parseListSalesQuery({})).toEqual({});
    expect(hasSalesListFilters(parseListSalesQuery({}))).toBe(false);
  });

  it('parses kind, status, flags, client, search, and clamps limit', () => {
    const options = parseListSalesQuery({
      kind: 'SALE',
      status: 'issued',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      isFavorite: 'true',
      isRapidSale: '0',
      clientId: '507f1f77bcf86cd799439011',
      q: 'iPhone',
      limit: '99999',
    });

    expect(options).toEqual({
      kind: 'sale',
      status: 'issued',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      isFavorite: true,
      isRapidSale: false,
      clientId: '507f1f77bcf86cd799439011',
      q: 'iPhone',
      limit: SALES_LIST_MAX_LIMIT,
    });
    expect(hasSalesListFilters(options)).toBe(true);
  });

  it('accepts query alias for search text', () => {
    expect(parseListSalesQuery({ query: '  r000001  ' }).q).toBe('r000001');
  });

  it('ignores invalid kind, dates, ids, and limit', () => {
    expect(
      parseListSalesQuery({
        kind: 'invoice',
        dateFrom: '01-01-2026',
        clientId: 'not-an-id',
        limit: '0',
        isFavorite: 'maybe',
      }),
    ).toEqual({});
  });

  it('builds mongo filter with date range and text search', () => {
    const filter = buildSalesFilter(
      parseListSalesQuery({
        kind: 'repair',
        status: 'new',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        isFavorite: 'true',
        q: 'Nokia',
      }),
    );

    expect(filter.kind).toBe('repair');
    expect(filter.status).toBe('new');
    expect(filter.isFavorite).toBe(true);
    expect(filter.saleDate).toEqual({
      $gte: new Date('2026-03-01T00:00:00.000Z'),
      $lte: new Date('2026-03-31T23:59:59.999Z'),
    });
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { recordNumber: { $regex: 'Nokia', $options: 'i' } },
        { 'clientSnapshot.name': { $regex: 'Nokia', $options: 'i' } },
      ]),
    );
  });
});
