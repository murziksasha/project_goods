import { formatSale } from '../../shared/lib/formatters';
import { HttpError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Sale, type SaleDocument } from './model';

export const listSales = async () => {
  const sales = await Sale.find().sort({ saleDate: -1 }).lean<SaleDocument[]>();
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
