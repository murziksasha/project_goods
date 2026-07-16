import type { Employee } from '../../../../../entities/employee/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../../../entities/supplier-order/model/types';
import type { Product, ProductModelUpdatePayload } from '../../../../../entities/product/model/types';
import type { CatalogProduct } from '../../../../../entities/catalog-product/model/types';
import type { ClientDevice, ClientDeviceFormValues } from '../../../../../entities/client-device/model/types';
import type { PrintForm } from '../../../../../entities/settings/model/types';
import type {
  OrderLineItem,
  OrderStatus,
  OrderTabDefinition,
  TimelineEntry,
} from '../workspace/orders-workspace-shared';

export const orderDetailRelatedTabs: OrderTabDefinition[] = [
  { key: 'orders', labelKey: 'orders.tabs.orders' },
  { key: 'sales', labelKey: 'orders.tabs.sales' },
  { key: 'supplierOrders', labelKey: 'orders.tabs.supplierOrders' },
  { key: 'supplierInformation', labelKey: 'orders.tabs.supplierInformation' },
];

export type OrderDetailCardProps = {
  sale: Sale;
  sales: Sale[];
  supplierOrders: SupplierOrder[];
  employees: Employee[];
  status: OrderStatus;
  statusOptions: Array<{ key: OrderStatus; labelKey: string }>;
  comments: TimelineEntry[];
  lineItems: OrderLineItem[];
  products: Product[];
  printForms: PrintForm[];
  clientDevices: ClientDevice[];
  catalogProducts: CatalogProduct[];
  paidAmount: number;
  isReadOnly: boolean;
  canAddComment: boolean;
  canAcceptPayment: boolean;
  canRefundPayment: boolean;
  canCreateOrders: boolean;
  canManageSupplierOrders?: boolean;
  onCreateOrder: () => void;
  createOrderHref: string;
  onClose: () => void;
  onAddComment: (comment: string) => void;
  onAddLineItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onReplaceLineItem: (
    itemId: string,
    itemIndex: number | undefined,
    items: Array<Omit<OrderLineItem, 'id'>>,
  ) => void;
  onRemoveLineItem: (
    itemId: string,
    itemIndex?: number,
  ) => void;
  onUpdateLineItem: (
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => void;
  onReturnLineItem: (item: OrderLineItem) => void;
  onOpenRelatedSale: (sale: Sale) => void;
  onAcceptPayment: () => void;
  onOpenPrint: () => void;
  onRefundPayment: () => void;
  onDiscountChange: (discount: {
    mode: 'percent' | 'amount';
    value: number;
  }) => void;
  onOpenClientCard: () => void;
  onSupplierOrderCreated: () => Promise<void>;
  onCreateClientDevice: (payload: ClientDeviceFormValues) => Promise<boolean>;
  onUpdateClientDevice: (
    deviceId: string,
    payload: ClientDeviceFormValues,
  ) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
  onUpdateProductModel: (payload: ProductModelUpdatePayload) => Promise<boolean>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onSaveMainInfo: (payload: {
    deviceName: string;
    serialNumber: string;
    masterId: string;
    status: OrderStatus;
  }) => Promise<void>;
  onSaveUserNote: (userNote: string) => Promise<void>;
};