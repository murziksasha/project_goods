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
    isActive: product.isActive ?? true,
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
  email: employee.email ?? '',
  username: employee.username ?? '',
  role: employee.role,
  permissions: employee.permissions,
  isActive: employee.isActive,
  isRegistered: Boolean(employee.username),
  note: employee.note,
  createdAt: employee.createdAt.toISOString(),
  updatedAt: employee.updatedAt.toISOString(),
});

export const formatSale = (sale: SaleDocument) => ({
  id: sale._id.toString(),
  recordNumber: sale.recordNumber ?? null,
  saleDate: sale.saleDate.toISOString(),
  quantity: sale.quantity,
  salePrice: sale.salePrice,
  kind: sale.kind,
  status: sale.status,
  paidAmount: sale.paidAmount ?? 0,
  note: sale.note,
  timeline: (sale.timeline ?? []).map((entry) => ({
    id: entry.id,
    author: entry.author,
    message: entry.message,
    createdAt: entry.createdAt.toISOString(),
  })),
  paymentHistory: (sale.paymentHistory ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type,
    amount: entry.amount,
    cashboxId: entry.cashboxId,
    cashboxName: entry.cashboxName,
    author: entry.author,
    createdAt: entry.createdAt.toISOString(),
  })),
  lineItems: (sale.lineItems ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    productId: item.productId ? item.productId.toString() : '',
    serviceId: item.serviceId ? item.serviceId.toString() : '',
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    warrantyPeriod: item.warrantyPeriod ?? 0,
  })),
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
  issuedBy: sale.issuedBy
    ? {
        id: sale.issuedBy.toString(),
        ...(sale.issuedBySnapshot ?? { name: '', role: '' }),
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
