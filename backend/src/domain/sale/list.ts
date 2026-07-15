import { formatSale } from '../../shared/lib/formatters';
import { HttpError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Sale, type SaleDocument } from './model';
import { buildSalesFilter, parseListSalesQuery } from './list-sales-query';

export const listSales = async (query: Record<string, unknown> = {}) => {
  const options = parseListSalesQuery(query);
  const filter = buildSalesFilter(options);

  let findQuery = Sale.find(filter).sort({ saleDate: -1 });
  if (options.limit !== undefined) {
    findQuery = findQuery.limit(options.limit);
  }

  const sales = await findQuery.lean<SaleDocument[]>();
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
