import { formatSale } from '../../shared/lib/formatters';
import { HttpError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Sale, type SaleDocument } from './model';
import {
  buildSalesFilter,
  parseListSalesQuery,
  SALES_LIST_COMPACT_EXCLUDE,
} from './list-sales-query';

export const getSaleById = async (saleId: string) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const sale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!sale) {
    throw new HttpError(404, 'Sale not found.');
  }
  return formatSale(sale);
};

export const listSales = async (query: Record<string, unknown> = {}) => {
  const options = parseListSalesQuery(query);
  const filter = buildSalesFilter(options);

  // Query builder is typed loosely: Mongoose select() changes generics and breaks reassignment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let findQuery: any = Sale.find(filter).sort({ saleDate: -1 });
  if (options.compact) {
    findQuery = findQuery.select(SALES_LIST_COMPACT_EXCLUDE);
  }

  if (options.page !== undefined && options.pageSize !== undefined) {
    const skip = (options.page - 1) * options.pageSize;
    const [total, sales] = await Promise.all([
      Sale.countDocuments(filter),
      findQuery.skip(skip).limit(options.pageSize).lean() as Promise<SaleDocument[]>,
    ]);
    return {
      items: sales.map(formatSale),
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  if (options.limit !== undefined) {
    findQuery = findQuery.limit(options.limit);
  }

  const sales = (await findQuery.lean()) as SaleDocument[];
  return sales.map(formatSale);
};

export const updateSaleFavorite = async (
  saleId: string,
  payload: { isFavorite?: unknown },
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const existingSale = await Sale.findById(saleId);
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }

  existingSale.isFavorite = payload.isFavorite === true;
  const updatedSale = await existingSale.save();
  return formatSale(updatedSale.toObject<SaleDocument>());
};
