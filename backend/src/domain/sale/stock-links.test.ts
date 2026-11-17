import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import { Product } from '../product/model';
import { Sale } from './model';
import {
  collectStockOrderLinks,
  listStockOrderLinks,
  STOCK_ORDER_LINK_LIMIT,
} from './stock-links';

const productId = '507f1f77bcf86cd799439011';
const otherProductId = '507f1f77bcf86cd799439012';
const saleId = '507f191e810c19729de860ea';
const otherSaleId = '507f191e810c19729de860eb';

const chain = <T>(rows: T[]) => ({
  select: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(rows),
  }),
});

describe('collectStockOrderLinks', () => {
  const products = [
    { id: productId, serialNumber: 'S000113' },
    { id: otherProductId, serialNumber: 'S000200' },
  ];

  it('returns every bound order, including issued and returned status', () => {
    expect(
      collectStockOrderLinks(products, [
        {
          id: saleId,
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
          productId: '',
          lineItems: [
            {
              kind: 'product',
              productId,
              serialNumbers: ['S000113'],
            },
          ],
        },
        {
          id: otherSaleId,
          recordNumber: 'r000100',
          kind: 'repair',
          status: 'returned',
          productId: '',
          lineItems: [
            {
              kind: 'product',
              productId,
              serialNumbers: ['s000113'],
            },
          ],
        },
      ]),
    ).toEqual([
      {
        productId,
        serialNumber: 'S000113',
        saleId: otherSaleId,
        recordNumber: 'r000100',
        kind: 'repair',
        status: 'returned',
      },
      {
        productId,
        serialNumber: 'S000113',
        saleId,
        recordNumber: 'r000255',
        kind: 'sale',
        status: 'issued',
      },
    ]);
  });

  it('links a legacy sale.product id and ignores a device serial and a service line', () => {
    expect(
      collectStockOrderLinks(products, [
        {
          id: saleId,
          recordNumber: 'r000010',
          kind: 'repair',
          status: 'new',
          productId,
          lineItems: [
            { kind: 'service', serialNumbers: ['S000113'] },
            {
              kind: 'product',
              productId: otherProductId,
              serialNumbers: ['OTHER'],
            },
          ],
        },
      ]),
    ).toEqual([
      {
        productId,
        serialNumber: 'S000113',
        saleId,
        recordNumber: 'r000010',
        kind: 'repair',
        status: 'new',
      },
    ]);
  });

  it('does not link a product id when the line serial belongs to another unit', () => {
    expect(
      collectStockOrderLinks(products, [
        {
          id: saleId,
          recordNumber: 'r000011',
          kind: 'sale',
          status: 'reserved',
          productId: '',
          lineItems: [
            {
              kind: 'product',
              productId,
              serialNumbers: ['S000200'],
            },
          ],
        },
      ]).map((link) => link.productId),
    ).toEqual([otherProductId]);
  });
});

describe('listStockOrderLinks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty list without querying when nothing was requested', async () => {
    const findProducts = vi.spyOn(Product, 'find');
    const findSales = vi.spyOn(Sale, 'find');

    await expect(listStockOrderLinks({})).resolves.toEqual({ links: [] });
    expect(findProducts).not.toHaveBeenCalled();
    expect(findSales).not.toHaveBeenCalled();
  });

  it('rejects a batch larger than the limit', async () => {
    const serials = Array.from(
      { length: STOCK_ORDER_LINK_LIMIT + 1 },
      (_, index) => `S${index}`,
    );

    await expect(listStockOrderLinks({ serials })).rejects.toEqual(
      expect.any(HttpError),
    );
  });

  it('queries products and sales and keeps the sale status', async () => {
    vi.spyOn(Product, 'find').mockReturnValue(
      chain([
        { _id: productId, serialNumber: 'S000113' },
      ]) as never,
    );
    vi.spyOn(Sale, 'find').mockReturnValue(
      chain([
        {
          _id: saleId,
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
          product: null,
          lineItems: [
            {
              kind: 'product',
              productId,
              serialNumbers: ['S000113'],
            },
          ],
        },
      ]) as never,
    );

    await expect(
      listStockOrderLinks({
        productIds: [productId],
        serials: ['s000113'],
      }),
    ).resolves.toEqual({
      links: [
        {
          productId,
          serialNumber: 'S000113',
          saleId,
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
        },
      ],
    });

    expect(Sale.find).toHaveBeenCalledWith({
      $or: expect.arrayContaining([
        { 'lineItems.productId': { $in: [productId] } },
        { product: { $in: [productId] } },
        {
          lineItems: {
            $elemMatch: {
              kind: 'product',
              serialNumbers: { $in: ['S000113'] },
            },
          },
        },
      ]),
    });
  });
});
