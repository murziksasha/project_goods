import type { ClientDocument } from '../../domain/client/model';
import type { EmployeeDocument } from '../../domain/employee/model';
import type { ProductDocument } from '../../domain/product/model';
import type { SaleDocument } from '../../domain/sale/model';

export const formatProduct = (product: ProductDocument) => {
  const freeQuantity = Math.max(product.quantity - product.reservedQuantity, 0);

  return {
    id: product._id.toString(),
    name: product.name,
    article: product.article,
    serialNumber: product.serialNumber ?? '',
    price: product.price,
    salePriceOptions: product.salePriceOptions ?? [],
    note: product.note ?? '',
    quantity: product.quantity,
    reservedQuantity: product.reservedQuantity,
    freeQuantity,
    isInStock: freeQuantity > 0,
    purchasePlace: product.purchasePlace,
    purchaseDate: product.purchaseDate ? product.purchaseDate.toISOString() : null,
    warrantyPeriod: product.warrantyPeriod,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
};

export const formatClient = (client: ClientDocument) => ({
  id: client._id.toString(),
  phone: client.phone,
  name: client.name,
  note: client.note,
  status: client.status,
  createdAt: client.createdAt.toISOString(),
  updatedAt: client.updatedAt.toISOString(),
});

export const formatEmployee = (employee: EmployeeDocument) => ({
  id: employee._id.toString(),
  name: employee.name,
  phone: employee.phone,
  role: employee.role,
  permissions: employee.permissions,
  isActive: employee.isActive,
  note: employee.note,
  createdAt: employee.createdAt.toISOString(),
  updatedAt: employee.updatedAt.toISOString(),
});

export const formatSale = (sale: SaleDocument) => ({
  id: sale._id.toString(),
  saleDate: sale.saleDate.toISOString(),
  quantity: sale.quantity,
  salePrice: sale.salePrice,
  note: sale.note,
  client: {
    id: sale.client.toString(),
    ...sale.clientSnapshot,
  },
  product: {
    id: sale.product.toString(),
    ...sale.productSnapshot,
    serialNumber: sale.productSnapshot?.serialNumber ?? '',
  },
  manager: sale.manager
    ? {
        id: sale.manager.toString(),
        ...(sale.managerSnapshot ?? { name: '', role: '' }),
      }
    : null,
  master: sale.master
    ? {
        id: sale.master.toString(),
        ...(sale.masterSnapshot ?? { name: '', role: '' }),
      }
    : null,
  createdAt: sale.createdAt.toISOString(),
  updatedAt: sale.updatedAt.toISOString(),
});

export const formatClientHistory = (
  client: ClientDocument,
  sales: SaleDocument[],
) => ({
  client: formatClient(client),
  sales: sales.map(formatSale),
  stats: {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, sale) => sum + sale.salePrice * sale.quantity, 0),
    totalItemsSold: sales.reduce((sum, sale) => sum + sale.quantity, 0),
  },
});
