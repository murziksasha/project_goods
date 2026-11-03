import { describe, expect, it } from 'vitest';
import { flexiblePhonePattern } from '../../shared/lib/phone-search';
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
      compact: '1',
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
      compact: true,
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
        { 'lineItems.name': { $regex: 'Nokia', $options: 'i' } },
        { 'lineItems.serialNumbers': { $regex: 'Nokia', $options: 'i' } },
      ]),
    );
  });

  it('parses pagination and multi-status filters', () => {
    const options = parseListSalesQuery({
      page: '2',
      pageSize: '999',
      statuses: 'new,paid',
      masterId: '507f1f77bcf86cd799439011',
      repairType: 'warranty',
    });
    expect(options.page).toBe(2);
    expect(options.pageSize).toBe(500);
    expect(options.statuses).toEqual(['new', 'paid']);
    expect(options.masterId).toBe('507f1f77bcf86cd799439011');
    expect(options.repairType).toBe('warranty');
  });

  describe('current sale item filters', () => {
    it('searches every current line name and serial without old snapshot labels', () => {
      const filter = buildSalesFilter({ kind: 'sale', q: 'Diagnostics [old]' });
      const branches = filter.$or as Array<Record<string, unknown>>;
      const textMatch = { $regex: 'Diagnostics \\[old\\]', $options: 'i' };

      expect(branches).toEqual(
        expect.arrayContaining([
          { recordNumber: textMatch },
          { note: textMatch },
          { userNote: textMatch },
          { 'clientSnapshot.name': textMatch },
          { 'clientSnapshot.phone': textMatch },
          { 'clientSnapshot.phones': textMatch },
          { 'lineItems.name': textMatch },
          { 'lineItems.serialNumbers': textMatch },
        ]),
      );
      expect(branches.some((branch) => 'productSnapshot.name' in branch)).toBe(false);
      expect(branches.some((branch) => 'productSnapshot.serialNumber' in branch)).toBe(false);
    });

    it('guards article lookup with a nonnull stock ID still present on a current product', () => {
      const filter = buildSalesFilter({ kind: 'sale', q: 'ART-1' });
      const branches = filter.$or as Array<Record<string, unknown>>;
      const articleBranches = branches.filter(
        (branch) => 'productSnapshot.article' in branch,
      );

      expect(articleBranches).toEqual([
        {
          product: { $ne: null },
          'productSnapshot.article': { $regex: 'ART-1', $options: 'i' },
          $expr: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$lineItems', []] },
                    as: 'item',
                    cond: {
                      $and: [
                        { $eq: ['$$item.kind', 'product'] },
                        { $eq: ['$$item.productId', '$product'] },
                      ],
                    },
                  },
                },
              },
              0,
            ],
          },
        },
      ]);
    });

    it('matches Product only against current product names', () => {
      expect(buildSalesFilter({ kind: 'sale', product: 'Cable' })).toEqual({
        kind: 'sale',
        lineItems: {
          $elemMatch: {
            kind: 'product',
            name: { $regex: 'Cable', $options: 'i' },
          },
        },
      });
    });

    it('matches Service only against current service names', () => {
      expect(buildSalesFilter({ kind: 'sale', service: 'Setup' })).toEqual({
        kind: 'sale',
        lineItems: {
          $elemMatch: {
            kind: 'service',
            name: { $regex: 'Setup', $options: 'i' },
          },
        },
      });
    });

    it.each(['repair', undefined] as const)(
      'keeps snapshot search and Product matching for kind=%s',
      (kind) => {
        const textFilter = buildSalesFilter({ kind, q: 'Original item' });
        const textMatch = { $regex: 'Original item', $options: 'i' };

        expect(textFilter.$or).toEqual(
          expect.arrayContaining([
            { 'productSnapshot.name': textMatch },
            { 'productSnapshot.serialNumber': textMatch },
            { 'productSnapshot.article': textMatch },
          ]),
        );
        expect(buildSalesFilter({ kind, product: 'Original item' }).$or).toEqual([
          { 'productSnapshot.name': textMatch },
          {
            lineItems: {
              $elemMatch: { kind: 'product', name: textMatch },
            },
          },
        ]);
      },
    );
  });

  describe('phone, note, and manager search', () => {
    const phoneMatch = {
      $regex: flexiblePhonePattern('063'),
      $options: 'i',
    };

    const regexFor = (branches: Array<Record<string, unknown>>, field: string) => {
      const match = branches.find((branch) => field in branch)?.[field] as
        | { $regex: string; $options: string }
        | undefined;
      expect(match).toBeDefined();
      return new RegExp(match!.$regex, match!.$options);
    };

    it('matches primary and additional snapshot phones from three local digits', () => {
      const branches = buildSalesFilter({ kind: 'repair', q: '+38063' }).$or as Array<
        Record<string, unknown>
      >;

      expect(branches).toEqual(
        expect.arrayContaining([
          { note: { $regex: '\\+38063', $options: 'i' } },
          { userNote: { $regex: '\\+38063', $options: 'i' } },
          { 'clientSnapshot.phone': phoneMatch },
          { 'clientSnapshot.phones': phoneMatch },
        ]),
      );
      expect(branches.some((branch) => 'managerSnapshot.name' in branch)).toBe(false);
    });

    it('does not phone-match a bare country code or a serial', () => {
      const bare = buildSalesFilter({ kind: 'sale', q: '+380' }).$or as Array<
        Record<string, unknown>
      >;
      expect(bare.some((branch) => 'clientSnapshot.phone' in branch)).toBe(false);
      expect(bare).toEqual(
        expect.arrayContaining([
          { note: { $regex: '\\+380', $options: 'i' } },
          { 'managerSnapshot.name': { $regex: '\\+380', $options: 'i' } },
          { 'issuedBySnapshot.name': { $regex: '\\+380', $options: 'i' } },
        ]),
      );

      const serial = buildSalesFilter({ kind: 'sale', q: 'S000123' }).$or as Array<
        Record<string, unknown>
      >;
      expect(serial).toEqual(
        expect.arrayContaining([
          { 'clientSnapshot.phone': { $regex: 'S000123', $options: 'i' } },
          { 'lineItems.serialNumbers': { $regex: 'S000123', $options: 'i' } },
        ]),
      );
    });

    it('applies the same phone rule to the client filter', () => {
      const fullPhone = {
        $regex: flexiblePhonePattern('0631112233'),
        $options: 'i',
      };
      const filter = buildSalesFilter({ client: '(063) 111-22-33' });
      expect(filter.$or).toEqual(
        expect.arrayContaining([
          { 'clientSnapshot.name': { $regex: '\\(063\\) 111-22-33', $options: 'i' } },
          { 'clientSnapshot.phone': fullPhone },
          { 'clientSnapshot.phones': fullPhone },
          { recordNumber: { $regex: '\\(063\\) 111-22-33', $options: 'i' } },
        ]),
      );
    });

    it('executes q and client phone regexes against legacy separators', () => {
      const query = '+380/63–111 22 33';
      const legacyPhone = '+380—63/111.22.33';
      const qBranches = buildSalesFilter({ kind: 'sale', q: query }).$or as Array<
        Record<string, unknown>
      >;
      const clientBranches = buildSalesFilter({ kind: 'sale', client: query }).$or as Array<
        Record<string, unknown>
      >;

      expect(regexFor(qBranches, 'clientSnapshot.phone').test(legacyPhone)).toBe(true);
      expect(regexFor(qBranches, 'clientSnapshot.phones').test(legacyPhone)).toBe(true);
      expect(regexFor(clientBranches, 'clientSnapshot.phone').test(legacyPhone)).toBe(true);
      expect(regexFor(clientBranches, 'clientSnapshot.phones').test(legacyPhone)).toBe(true);
    });

    it.each([
      'Rapid sale',
      'rapid',
      'pid sa',
      'Швидкий продаж',
      'швид',
      'видкий про',
    ])('matches rapid-sale alias %s in q and client filters', (alias) => {
      const qBranches = buildSalesFilter({ kind: 'sale', q: alias }).$or as Array<
        Record<string, unknown>
      >;
      const clientBranches = buildSalesFilter({ kind: 'sale', client: alias }).$or as Array<
        Record<string, unknown>
      >;

      expect(qBranches).toContainEqual({ isRapidSale: true });
      expect(clientBranches).toContainEqual({ isRapidSale: true });
    });

    it('keeps rapid-sale aliases scoped to sale results', () => {
      const repair = buildSalesFilter({ kind: 'repair', q: 'rapid' });
      const unrelated = buildSalesFilter({ kind: 'sale', q: 'Olena' });
      expect(repair.$or).not.toContainEqual({ isRapidSale: true });
      expect(unrelated.$or).not.toContainEqual({ isRapidSale: true });
    });
  });

  describe('kanban master query filters', () => {
    const validId1 = '507f1f77bcf86cd799439011';
    const validId2 = '507f191e810c19729de860ea';

    it('builds $in filter for masterIds only', () => {
      const options = parseListSalesQuery({
        masterIds: `${validId1},${validId2}`,
      });
      expect(options.masterIds).toEqual([validId1, validId2]);
      expect(hasSalesListFilters(options)).toBe(true);

      const filter = buildSalesFilter(options);
      expect(filter.master).toEqual({ $in: [validId1, validId2] });
    });

    it('builds { master: null } filter for unassigned master only', () => {
      const options = parseListSalesQuery({
        includeUnassignedMaster: 'true',
      });
      expect(options.includeUnassignedMaster).toBe(true);
      expect(hasSalesListFilters(options)).toBe(true);

      const filter = buildSalesFilter(options);
      expect(filter.master).toBeNull();
    });

    it('builds $or filter for both masterIds and includeUnassignedMaster', () => {
      const options = parseListSalesQuery({
        masterIds: validId1,
        includeUnassignedMaster: 'true',
      });
      expect(options.masterIds).toEqual([validId1]);
      expect(options.includeUnassignedMaster).toBe(true);

      const filter = buildSalesFilter(options);
      expect(filter.$or).toEqual([
        { master: { $in: [validId1] } },
        { master: null },
      ]);
    });

    it('drops invalid ObjectIds and keeps valid ones', () => {
      const options = parseListSalesQuery({
        masterIds: `${validId1},invalid-id,${validId2}`,
      });
      expect(options.masterIds).toEqual([validId1, validId2]);

      const allInvalidOptions = parseListSalesQuery({
        masterIds: 'not-an-id,also-bad',
      });
      expect(allInvalidOptions.masterIds).toBeUndefined();
      expect(hasSalesListFilters(allInvalidOptions)).toBe(false);

      const filterFromRawInvalid = buildSalesFilter({
        masterIds: ['invalid-id'],
      });
      expect(filterFromRawInvalid.master).toBeUndefined();
    });

    it('keeps legacy masterId behavior unchanged', () => {
      const options = parseListSalesQuery({
        masterId: validId1,
      });
      expect(options.masterId).toBe(validId1);
      const filter = buildSalesFilter(options);
      expect(filter.master).toBe(validId1);
    });
  });
});

