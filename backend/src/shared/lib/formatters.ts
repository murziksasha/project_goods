import type { ClientDocument } from '../../domain/client/model';
import type { EmployeeDocument } from '../../domain/employee/model';
import type { ProductDocument } from '../../domain/product/model';
import type { SaleDocument } from '../../domain/sale/model';
import type { SupplierDocument } from '../../domain/supplier/model';
import type { ClientDeviceDocument } from '../../domain/client-device/model';
import type { CatalogProductDocument } from '../../domain/catalog-product/model';

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
    warehouseId: product.warehouseId ?? '',
    locationId: product.locationId ?? '',
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
  email: client.email ?? '',
  address: client.address ?? '',
  registrationId: client.registrationId ?? '',
  iban: client.iban ?? '',
  note: client.note,
  status: client.status,
  createdAt: client.createdAt.toISOString(),
  updatedAt: client.updatedAt.toISOString(),
});

export const formatSupplier = (supplier: SupplierDocument) => ({
  id: supplier._id.toString(),
  phone: supplier.phone,
  name: supplier.name,
  note: supplier.note,
  supplierOrder: supplier.supplierOrder ?? '',
  isActive: supplier.isActive,
  createdAt: supplier.createdAt.toISOString(),
  updatedAt: supplier.updatedAt.toISOString(),
});

export const formatCatalogProduct = (item: CatalogProductDocument, usageCount = 0) => ({
  id: item._id.toString(),
  name: item.name,
  note: item.note ?? '',
  isActive: item.isActive ?? true,
  usageCount,
  canRemove: usageCount === 0,
  sourceTags: item.sourceTags ?? [],
  lastSeenAt: item.lastSeenAt ? item.lastSeenAt.toISOString() : item.updatedAt.toISOString(),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const formatClientDevice = (device: ClientDeviceDocument, usageCount = 0) => ({
  id: device._id.toString(),
  clientId: device.client ? device.client.toString() : '',
  clientName: device.clientName,
  clientPhone: device.clientPhone,
  name: device.name,
  serialNumber: device.serialNumber ?? '',
  note: device.note ?? '',
  source: device.source,
  isActive: device.isActive ?? true,
  usageCount,
  canRemove: usageCount === 0,
  createdAt: device.createdAt.toISOString(),
  updatedAt: device.updatedAt.toISOString(),
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
    paymentMethod: entry.paymentMethod === 'non-cash' ? 'non-cash' : 'cash',
    amount: entry.amount,
    cashboxId: entry.cashboxId,
    cashboxName: entry.cashboxName,
    author: entry.author,
    createdAt: entry.createdAt.toISOString(),
  })),
  lineItems: (sale.lineItems ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    productId: item.productId ? item.productId.toString() : undefined,
    catalogProductId: item.catalogProductId
      ? item.catalogProductId.toString()
      : undefined,
    serviceId: item.serviceId ? item.serviceId.toString() : undefined,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    warrantyPeriod: item.warrantyPeriod ?? 0,
    serialNumbers: (item.serialNumbers ?? []).map((serial) => String(serial)),
  })),
  discount: {
    mode: sale.discount?.mode === 'percent' ? 'percent' : 'amount',
    value: sale.discount?.value ?? 0,
  },
  client: {
    id: sale.client.toString(),
    ...sale.clientSnapshot,
  },
  product: {
    id: sale.product ? sale.product.toString() : '',
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

