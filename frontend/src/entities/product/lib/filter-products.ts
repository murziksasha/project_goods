import type { Product } from '../model/types';

export const filterProducts = (products: Product[], query: string) => {
  if (!query) {
    return products;
  }

  const normalizedQuery = query.toLowerCase();

  return products.filter((product) =>
    [
      product.name,
      product.article,
      product.serialNumber,
      product.note,
      product.purchasePlace,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  );
};
