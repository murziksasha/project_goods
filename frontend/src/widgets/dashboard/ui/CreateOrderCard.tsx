import { useEffect, useMemo, useState } from 'react';
import { createClient, getClients, getClientHistory } from '../../../entities/client/api/clientApi';
import type { Client, ClientHistory } from '../../../entities/client/model/types';
import type { Employee } from '../../../entities/employee/model/types';
import {
  createClientDevice,
  getClientDevices,
} from '../../../entities/client-device/api/clientDeviceApi';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import type { CreateOrderRequestPayload } from '../model/order-request';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import { SupplierOrderModal } from './SupplierOrderModal';
import { createSupplierOrder } from '../../../entities/supplier-order/api/supplierOrderApi';
import type { SupplierOrderFormValues } from '../../../entities/supplier-order/model/types';
import type { SupplierOrderModalSubmitPayload } from './SupplierOrderModal';

type CreateOrderCardProps = {
  isSaving: boolean;
  employees: Employee[];
  currentEmployee: Employee | null;
  initialTab?: CreateOrderRequestPayload['sourceTab'];
  suppliers: Supplier[];
  products: Product[];
  catalogProducts: CatalogProduct[];
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
  onSave: (payload: CreateOrderRequestPayload) => Promise<boolean>;
};

const topTabs: Array<{ key: CreateOrderRequestPayload['sourceTab']; label: string }> = [
  { key: 'repair', label: 'Repair order' },
  { key: 'sale', label: 'Sales order' },
];

const extraOptionsLeft = [
  'Device stays with client',
  'Urgent repair',
  'Accepted by post',
  'Start work without confirmation',
  'Client can wait for parts',
];

const extraOptionsRight = [
  'Courier took device',
  'Replacement device issued',
  'Home master call',
];

const saleExtraOptionsLeft = [
  'New sale',
  'Issued',
  'At postal company',
  'Waiting for supply',
];

const saleExtraOptionsRight = [
  'Reserved for client',
  'Needs invoice',
  'Warranty card issued',
  'Delivery required',
];

type SaleOrderItem = {
  id: string;
  query: string;
  catalogProductId: string;
  product: Product | null;
  price: string;
  unitPrice: string;
  quantity: string;
  warrantyPeriod: string;
  supplierOrderRequested: boolean;
};
type SaleProductSuggestion = {
  id: string;
  name: string;
  note: string;
  product: Product | null;
  catalogProductId: string;
};

const createSaleOrderItem = (): SaleOrderItem => ({
  id: crypto.randomUUID(),
  query: '',
  catalogProductId: '',
  product: null,
  price: '',
  unitPrice: '',
  quantity: '1',
  warrantyPeriod: '0',
  supplierOrderRequested: false,
});

const getProductWarehouse = (product: Product) =>
  product.purchasePlace.trim() || 'Main warehouse';

const formatPhone = (input: string) => {
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const normalizedDigits = digitsOnly.startsWith('380')
    ? digitsOnly.slice(3)
    : digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly;
  const localDigits = normalizedDigits.slice(0, 9);

  let result = '+380';
  if (localDigits.length > 0) result += ` ${localDigits.slice(0, 2)}`;
  if (localDigits.length > 2) result += ` ${localDigits.slice(2, 5)}`;
  if (localDigits.length > 5) result += ` ${localDigits.slice(5, 7)}`;
  if (localDigits.length > 7) result += ` ${localDigits.slice(7, 9)}`;
  return result;
};

const phoneDigitsOnly = (value: string) => value.replace(/\D/g, '');
const toNameKey = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');
const normalizeProductLookupKey = (value: string) =>
  toNameKey(value).replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ');
const toApiPhone = (input: string) => {
  const digits = phoneDigitsOnly(input);
  if (digits.startsWith('380') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+380${digits.slice(1)}`;
  if (digits.length === 9) return `+380${digits}`;
  return '';
};

const extractDeviceKit = (note: string) =>
  note
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

const getDeviceHistory = (history: ClientHistory | null) => {
  if (!history) return [];

  const seen = new Set<string>();
  return history.sales.filter((sale) => {
    const deviceItem = sale.lineItems?.find((item) => item.kind === 'product');
    const deviceName = (deviceItem?.name?.trim() || sale.product.name || '').toLowerCase();
    const serial = (sale.product.serialNumber || '').trim().toLowerCase();
    const dedupeKey = `${deviceName}::${serial}`;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });
};

const getOrderLink = (saleId: string, kind: 'repair' | 'sale') => {
  const url = new URL(window.location.href);
  url.searchParams.set('page', 'orders');
  url.searchParams.set('ordersTab', kind === 'sale' ? 'sales' : 'orders');
  url.searchParams.delete('createOrder');
  url.searchParams.set('saleId', saleId);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const CreateOrderCard = ({
  isSaving,
  employees,
  currentEmployee,
  initialTab = 'repair',
  suppliers,
  products,
  catalogProducts,
  onCreateSupplier,
  onSuccess,
  onError,
  onClose,
  onSave,
}: CreateOrderCardProps) => {
  const [activeTab, setActiveTab] = useState<CreateOrderRequestPayload['sourceTab']>(initialTab);
  const [clientPhone, setClientPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [deviceSerialNumber, setDeviceSerialNumber] = useState('');
  const [deviceColor, setDeviceColor] = useState('');
  const [deviceKit, setDeviceKit] = useState('');
  const [repairType, setRepairType] = useState('Paid');
  const [issueFromClient, setIssueFromClient] = useState('');
  const [externalView, setExternalView] = useState('');
  const [readyDate, setReadyDate] = useState('');
  const [readyTime, setReadyTime] = useState('');
  const [managerId, setManagerId] = useState('');
  const [masterId, setMasterId] = useState('');
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistory | null>(null);
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [deviceSuggestions, setDeviceSuggestions] = useState<ClientDevice[]>([]);
  const [isCreateDeviceModalOpen, setIsCreateDeviceModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceIsActive, setNewDeviceIsActive] = useState(true);
  const [isDeviceCreating, setIsDeviceCreating] = useState(false);
  const [saleItems, setSaleItems] = useState<SaleOrderItem[]>(() => [createSaleOrderItem()]);
  const [saleProductSuggestions, setSaleProductSuggestions] = useState<SaleProductSuggestion[]>([]);
  const [selectedDeviceSuggestionId, setSelectedDeviceSuggestionId] = useState<string | null>(null);
  const [focusedSaleItemId, setFocusedSaleItemId] = useState<string | null>(null);
  const [isClientLookupLoading, setIsClientLookupLoading] = useState(false);
  const [isDeviceLookupLoading, setIsDeviceLookupLoading] = useState(false);
  const [isSaleProductLookupLoading, setIsSaleProductLookupLoading] = useState(false);
  const [isClientEnsuring, setIsClientEnsuring] = useState(false);
  const [supplierOrderModalItemId, setSupplierOrderModalItemId] = useState<string | null>(null);

  const managers = employees.filter(
    (employee) =>
      employee.isActive &&
      (employee.role === 'owner' ||
        employee.role === 'manager' ||
        employee.permissions.includes('orders.manage')),
  );
  const masters = employees.filter(
    (employee) =>
      employee.isActive &&
      (employee.role === 'owner' ||
        employee.role === 'master' ||
        employee.permissions.includes('repairs.execute')),
  );
  const canCurrentEmployeeManageOrders =
    currentEmployee?.isActive === true &&
    (currentEmployee.role === 'owner' ||
      currentEmployee.role === 'manager' ||
      currentEmployee.permissions.includes('orders.manage'));

  const phoneDigits = clientPhone.replace(/\D/g, '');
  const normalizedPhoneDigits = phoneDigits.startsWith('380')
    ? phoneDigits.slice(3)
    : phoneDigits.startsWith('0')
      ? phoneDigits.slice(1)
      : phoneDigits;
  const clientLookupQuery = [
    normalizedPhoneDigits.length >= 3 ? normalizedPhoneDigits : '',
    clientName.trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  const deviceLookupQuery = [deviceName.trim(), deviceSerialNumber.trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
  const deviceHistory = useMemo(() => getDeviceHistory(clientHistory), [clientHistory]);
  const shouldShowClientSuggestions =
    !selectedClientId && (normalizedPhoneDigits.length >= 3 || clientName.trim().length >= 2);
  const visibleClientSuggestions = shouldShowClientSuggestions ? clientSuggestions : [];
  const resolvedClientForDeviceCreate = useMemo(() => {
    if (selectedClientId && selectedClient) {
      return selectedClient;
    }

    const normalizedInputPhone = phoneDigitsOnly(clientPhone);
    const normalizedInputName = clientName.trim().toLowerCase();
    if (normalizedInputPhone.length < 3 && normalizedInputName.length < 2) {
      return null;
    }

    const exactMatches = clientSuggestions.filter((client) => {
      const samePhone =
        normalizedInputPhone.length > 0 &&
        phoneDigitsOnly(client.phone) === normalizedInputPhone;
      const sameName =
        normalizedInputName.length >= 2 && client.name.trim().toLowerCase() === normalizedInputName;
      return samePhone || sameName;
    });

    return exactMatches.length === 1 ? exactMatches[0] : null;
  }, [selectedClientId, selectedClient, clientPhone, clientName, clientSuggestions]);
  const visibleClientHistory = selectedClientId ? clientHistory : null;
  const visibleDeviceSuggestions = useMemo(() => {
    if (deviceName.trim().length < 2) return [];

    const normalizedInput = toNameKey(deviceName);
    const uniqueByName = new Map<string, ClientDevice>();
    deviceSuggestions.forEach((device) => {
      const key = toNameKey(device.name);
      if (!key || key === normalizedInput || uniqueByName.has(key)) return;
      uniqueByName.set(key, device);
    });
    return Array.from(uniqueByName.values());
  }, [deviceName, deviceSuggestions]);
  const canCreateClientDevice =
    activeTab === 'repair' &&
    Boolean(resolvedClientForDeviceCreate) &&
    deviceName.trim().length >= 2 &&
    !isDeviceLookupLoading &&
    visibleDeviceSuggestions.length === 0;
  const focusedSaleItem =
    saleItems.find((item) => item.id === focusedSaleItemId) ?? saleItems[0] ?? null;
  const saleProductLookupQuery = focusedSaleItem?.query.trim() ?? '';
  const visibleSaleProductSuggestions =
    activeTab === 'sale' &&
    saleProductLookupQuery.length >= 2 &&
    !focusedSaleItem?.catalogProductId
      ? saleProductSuggestions
      : [];
  const saleItemsTotal = saleItems.reduce((total, item) => {
    const price = Number.parseFloat(item.price || '0');
    const quantity = Number.parseInt(item.quantity || '0', 10);
    return total + (Number.isFinite(price) ? price : 0) * (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
  const effectiveManagerId =
    canCurrentEmployeeManageOrders && currentEmployee ? currentEmployee.id : managerId;

  useEffect(() => {
    if (!shouldShowClientSuggestions) return;

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsClientLookupLoading(true);
      try {
        const clients = await getClients(clientLookupQuery);
        if (isActive) setClientSuggestions(clients.slice(0, 6));
      } catch {
        if (isActive) setClientSuggestions([]);
      } finally {
        if (isActive) setIsClientLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [clientLookupQuery, shouldShowClientSuggestions]);

  useEffect(() => {
    if (!selectedClientId) return;

    let isActive = true;
    void (async () => {
      try {
        const history = await getClientHistory(selectedClientId);
        if (isActive) setClientHistory(history);
      } catch {
        if (isActive) setClientHistory(null);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [selectedClientId]);

  useEffect(() => {
    if (deviceLookupQuery.length < 2 || Boolean(selectedDeviceSuggestionId)) {
      setDeviceSuggestions([]);
      setIsDeviceLookupLoading(false);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsDeviceLookupLoading(true);
      try {
        const devices = await getClientDevices(deviceLookupQuery);
        if (isActive) {
          setDeviceSuggestions(devices.filter((device) => device.isActive).slice(0, 8));
        }
      } catch {
        if (isActive) setDeviceSuggestions([]);
      } finally {
        if (isActive) setIsDeviceLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [deviceLookupQuery, selectedDeviceSuggestionId]);

  useEffect(() => {
    if (
      activeTab !== 'sale' ||
      saleProductLookupQuery.length < 2 ||
      Boolean(focusedSaleItem?.catalogProductId)
    ) {
      setSaleProductSuggestions([]);
      setIsSaleProductLookupLoading(false);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsSaleProductLookupLoading(true);
      try {
        if (isActive) {
          const normalizedLookupQuery =
            normalizeProductLookupKey(saleProductLookupQuery);
          const stockMatches = products
            .filter((product) => {
              if (!product.isActive) return false;
              const lookupFields = [
                product.name,
                product.article,
                product.serialNumber,
              ];
              return lookupFields.some((field) =>
                normalizeProductLookupKey(field).includes(
                  normalizedLookupQuery,
                ),
              );
            })
            .slice(0, 8)
            .map((product) => ({
              id: `stock-${product.id}`,
              name: product.name,
              note: `${product.serialNumber} / ${product.article}`,
              product,
              catalogProductId: '',
            }));
          const catalogMatches = catalogProducts
            .filter((product) =>
              normalizeProductLookupKey(product.name).includes(
                normalizedLookupQuery,
              ),
            )
            .slice(0, 8)
            .map((product) => ({
              id: `catalog-${product.id}`,
              name: product.name,
              note: product.note || 'Catalog product',
              product: null,
              catalogProductId: product.id,
            }));
          setSaleProductSuggestions(
            [...stockMatches, ...catalogMatches].slice(0, 8),
          );
        }
      } catch {
        if (isActive) setSaleProductSuggestions([]);
      } finally {
        if (isActive) setIsSaleProductLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, catalogProducts, focusedSaleItem?.catalogProductId, products, saleProductLookupQuery]);

  const toggleFlag = (flag: string) => {
    setSelectedFlags((current) =>
      current.includes(flag)
        ? current.filter((item) => item !== flag)
        : [...current, flag],
    );
  };

  const applyClient = (client: Client) => {
    setClientPhone(client.phone);
    setClientName(client.name);
    setSelectedClientId(client.id);
    setSelectedClient(client);
    setClientSuggestions([]);
  };

  const applyDevice = (device: ClientDevice) => {
    setDeviceName(device.name);
    setDeviceSerialNumber(device.serialNumber);
    setDeviceKit(extractDeviceKit(device.note));
    setSelectedDeviceSuggestionId(device.id);
    setDeviceSuggestions([]);
  };

  const updateSaleItem = (itemId: string, patch: Partial<SaleOrderItem>) => {
    setSaleItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const applySaleProduct = (
    itemId: string,
    suggestion: SaleProductSuggestion,
  ) => {
    updateSaleItem(itemId, {
      query: suggestion.name,
      catalogProductId: suggestion.catalogProductId,
      product: suggestion.product,
      supplierOrderRequested: false,
    });
    setSaleProductSuggestions([]);
  };

  const addSaleItem = () => {
    const item = createSaleOrderItem();
    setSaleItems((current) => [...current, item]);
    setFocusedSaleItemId(item.id);
  };

  const removeSaleItem = (itemId: string) => {
    setSaleItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== itemId),
    );
  };

  const handleSaleItemQuantityChange = (item: SaleOrderItem, value: string) => {
    const nextQuantity = Math.max(1, Number.parseInt(value || '1', 10) || 1);
    const previousQuantity = Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1);
    const currentPrice = Number.parseFloat(item.price || '0');
    const knownUnitPrice = Number.parseFloat(item.unitPrice || '0');
    const resolvedUnitPrice =
      Number.isFinite(knownUnitPrice) && knownUnitPrice > 0
        ? knownUnitPrice
        : Number.isFinite(currentPrice) && currentPrice > 0
          ? currentPrice / previousQuantity
          : 0;

    updateSaleItem(item.id, {
      quantity: String(nextQuantity),
      unitPrice: resolvedUnitPrice > 0 ? String(Math.round(resolvedUnitPrice * 100) / 100) : item.unitPrice,
      price:
        resolvedUnitPrice > 0
          ? String(Math.round(resolvedUnitPrice * nextQuantity * 100) / 100)
          : item.price,
    });
  };

  const handleSaleItemPriceChange = (item: SaleOrderItem, value: string) => {
    const normalizedPrice = value.trim();
    const quantity = Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1);
    const numericPrice = Number.parseFloat(normalizedPrice || '0');
    const resolvedUnitPrice =
      Number.isFinite(numericPrice) && numericPrice >= 0 ? numericPrice / quantity : 0;

    updateSaleItem(item.id, {
      price: normalizedPrice,
      unitPrice:
        Number.isFinite(resolvedUnitPrice) && resolvedUnitPrice >= 0
          ? String(Math.round(resolvedUnitPrice * 100) / 100)
          : item.unitPrice,
    });
  };

  const getShippingStatusLabel = (item: SaleOrderItem) => {
    if (item.product?.freeQuantity && item.product.freeQuantity > 0) return 'In stock';
    if (item.supplierOrderRequested) return 'Supplier order';
    return 'Order';
  };

  const handleShippingStatusClick = (item: SaleOrderItem) => {
    if (item.product?.freeQuantity && item.product.freeQuantity > 0) return;
    setSupplierOrderModalItemId(item.id);
  };

  const confirmSupplierOrderRequest = async (
    payload: SupplierOrderModalSubmitPayload,
  ) => {
    if (!supplierOrderModalItemId) return;

    try {
      const supplierOrderPayload: SupplierOrderFormValues = {
        supplierId: payload.supplierId,
        deliveryDate: payload.deliveryDate,
        supplyType: payload.supplyType,
        number: payload.number,
        note: payload.note,
        createdBy: currentEmployee?.name?.trim() || 'Administrator',
        orderBaseId: `SO-${Date.now()}`,
        items: payload.items,
      };
      await createSupplierOrder(supplierOrderPayload);
      updateSaleItem(supplierOrderModalItemId, {
        supplierOrderRequested: true,
      });
      setSelectedFlags((current) =>
        current.includes('Waiting for supply')
          ? current
          : [...current, 'Waiting for supply'],
      );
      onSuccess(
        'Supplier order created. It is now available in Warehouse Receipts and in Accounting orders queue when total is greater than 0.',
      );
      setSupplierOrderModalItemId(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to create supplier order.',
      );
    }
  };

  const onClientPhoneChange = (value: string) => {
    setClientPhone(value.replace(/[^\d+\s()-]/g, ''));
    setSelectedClientId(null);
    setSelectedClient(null);
  };

  const onClientPhoneBlur = () => {
    setClientPhone((current) => formatPhone(current));
  };

  const onClientNameChange = (value: string) => {
    setClientName(value);
    setSelectedClientId(null);
    setSelectedClient(null);
  };

  const createDeviceFromModal = async () => {
    const name = newDeviceName.trim();
    if (name.length < 2 || isDeviceCreating || !selectedClientId || !selectedClient) return;

    setIsDeviceCreating(true);
    try {
      const created = await createClientDevice({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: selectedClient.phone,
        name,
        serialNumber: '',
        note: deviceKit.trim(),
        source: 'repairOrder',
        isActive: newDeviceIsActive,
      });
      applyDevice(created);
      setIsCreateDeviceModalOpen(false);
    } finally {
      setIsDeviceCreating(false);
    }
  };

  const ensureClientForDevice = async () => {
    if (selectedClientId && selectedClient) return selectedClient;
    if (isClientEnsuring) return null;

    const normalizedPhone = toApiPhone(clientPhone);
    const normalizedName = clientName.trim();
    if (!normalizedPhone || normalizedName.length < 2) return null;

    const normalizedPhoneDigits = phoneDigitsOnly(normalizedPhone);
    const fromSuggestions = clientSuggestions.find(
      (client) => phoneDigitsOnly(client.phone) === normalizedPhoneDigits,
    );
    if (fromSuggestions) {
      applyClient(fromSuggestions);
      return fromSuggestions;
    }

    setIsClientEnsuring(true);
    try {
      const clients = await getClients(normalizedPhone);
      const existingClient =
        clients.find((client) => phoneDigitsOnly(client.phone) === normalizedPhoneDigits) ?? null;

      if (existingClient) {
        applyClient(existingClient);
        return existingClient;
      }

      const createdClient = await createClient({
        phone: normalizedPhone,
        name: normalizedName,
        note: '',
        status: 'new',
      });
      applyClient(createdClient);
      return createdClient;
    } catch {
      return null;
    } finally {
      setIsClientEnsuring(false);
    }
  };

  const handleSave = async () => {
    const normalizedSaleItems = saleItems.flatMap((item) => {
      const quantity = Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1);
      const totalPrice = Math.max(0, Number.parseFloat(item.price || '0') || 0);
      const knownUnitPrice = Math.max(0, Number.parseFloat(item.unitPrice || '0') || 0);
      const resolvedUnitPrice = knownUnitPrice > 0 ? knownUnitPrice : totalPrice / quantity;
      const normalizedUnitPrice = String(Math.round(resolvedUnitPrice * 100) / 100);

      return Array.from({ length: quantity }, (_, index) => ({
        id: `${item.id}-${index + 1}`,
        productId: item.catalogProductId || item.product?.id || '',
        name: item.product?.name ?? item.query.trim(),
        article: item.product?.article ?? '',
        serialNumber: item.product?.serialNumber ?? '',
        price: normalizedUnitPrice,
        quantity: '1',
        warrantyPeriod: item.warrantyPeriod,
        warehouse: item.product ? getProductWarehouse(item.product) : '',
      }));
    });

    const success = await onSave({
      clientPhone,
      clientName,
      discountCode: '',
      deviceName,
      deviceSerialNumber,
      deviceColor,
      deviceKit,
      serviceName: '',
      repairType,
      issueFromClient,
      externalView,
      estimatedCost: activeTab === 'sale' ? String(Math.round(saleItemsTotal * 100) / 100) : '0',
      readyDate,
      readyTime,
      managerId: effectiveManagerId,
      masterId,
      extraFlags: selectedFlags,
      sourceTab: activeTab,
      saleItems: normalizedSaleItems,
    });

      if (success) {
        onClose();
      }
  };

  return (
    <section className="create-order-page">
      <header className="create-order-header">
        <h2>Create order</h2>
        <button type="button" className="create-order-close" aria-label="Close create form" onClick={onClose}>
          x
        </button>
      </header>

      <div className="create-order-body">
        <div className="create-order-tabs" role="tablist" aria-label="Order type tabs">
          {topTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? 'create-order-tab create-order-tab-active' : 'create-order-tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="create-order-grid">
          <div className="create-order-left">
            <h3 className="create-section-title">Client</h3>
            <div className="create-row-2">
              <label className="field">
                <span>Client data *</span>
                <input
                  value={clientPhone}
                  onChange={(event) => onClientPhoneChange(event.target.value)}
                  onBlur={onClientPhoneBlur}
                  placeholder="+380"
                />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input
                  value={clientName}
                  onChange={(event) => onClientNameChange(event.target.value)}
                  placeholder="Full name"
                />
              </label>
            </div>
            {(visibleClientSuggestions.length > 0 || isClientLookupLoading) ? (
              <div className="create-suggestions">
                {isClientLookupLoading ? <p>Searching clients...</p> : null}
                {visibleClientSuggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="create-suggestion-item"
                    onClick={() => applyClient(client)}
                  >
                    <strong>{client.name}</strong>
                    <span>{client.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {activeTab === 'sale' ? (
              <>
                <h3 className="create-section-title">Products</h3>
                <div className="sale-items-list">
                  {saleItems.map((item, index) => {
                    const availableQuantity = item.product?.freeQuantity ?? 0;
                    return (
                      <div key={item.id} className="sale-item-row">
                        <label className="field sale-item-product">
                          <span>{`Product ${index + 1} *`}</span>
                          <input
                            value={item.query}
                            onFocus={() => setFocusedSaleItemId(item.id)}
                            onChange={(event) => {
                              setFocusedSaleItemId(item.id);
                              updateSaleItem(item.id, {
                                query: event.target.value,
                                catalogProductId: '',
                                product: null,
                              });
                            }}
                            placeholder="Name, serial or article"
                          />
                        </label>
                        <label className="field">
                          <span>Qty</span>
                          <NumberStepper
                            min={1}
                            max={availableQuantity || undefined}
                            value={item.quantity}
                            onChange={(value) => handleSaleItemQuantityChange(item, value)}
                          />
                        </label>
                        <label className="field">
                          <span>Price</span>
                          <NumberStepper
                            min={0}
                            value={item.price}
                            onChange={(value) => {
                              handleSaleItemPriceChange(item, value);
                            }}
                            placeholder="0"
                          />
                        </label>
                        <label className="field">
                          <span>Warranty</span>
                          <select
                            value={item.warrantyPeriod}
                            onChange={(event) =>
                              updateSaleItem(item.id, { warrantyPeriod: event.target.value })
                            }
                          >
                            <option value="0">None</option>
                            <option value="1">30 day</option>
                            <option value="3">3 month</option>
                            <option value="6">6 month</option>
                            <option value="12">1 year</option>
                            <option value="24">2 year</option>
                            <option value="36">3 year</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Shipping status</span>
                          <button
                            type="button"
                            className="secondary-button sale-item-status-button"
                            onClick={() => handleShippingStatusClick(item)}
                          >
                            {getShippingStatusLabel(item)}
                          </button>
                        </label>
                        <button
                          type="button"
                          className="toolbar-square-button sale-item-add-button"
                          onClick={index === saleItems.length - 1 ? addSaleItem : () => removeSaleItem(item.id)}
                          aria-label={index === saleItems.length - 1 ? 'Add product position' : 'Remove product position'}
                        >
                          {index === saleItems.length - 1 ? '+' : '-'}
                        </button>
                        {item.product ? (
                          <div className="sale-item-stock">
                            <span>{getProductWarehouse(item.product)}</span>
                            <span>{`${item.product.serialNumber} / available ${item.product.freeQuantity}`}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {(visibleSaleProductSuggestions.length > 0 || isSaleProductLookupLoading) ? (
                  <div className="create-suggestions">
                    {isSaleProductLookupLoading ? <p>Searching products in catalog...</p> : null}
                    {visibleSaleProductSuggestions.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="create-suggestion-item"
                        onClick={() => focusedSaleItem && applySaleProduct(focusedSaleItem.id, product)}
                      >
                        <strong>{product.name}</strong>
                        <span>{product.note}</span>
                      </button>
                    ))}
                    <div className="sale-order-unavailable">
                      <span>{`${Math.round(saleItemsTotal * 100) / 100} UAH`}</span>
                    </div>
                  </div>
                ) : null}

                <label className="field">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={issueFromClient}
                    onChange={(event) => setIssueFromClient(event.target.value)}
                    placeholder="Sale notes"
                  />
                </label>
              </>
            ) : (
              <>
                <h3 className="create-section-title">Device</h3>
                <div className="create-device-search">
                  <label className="field">
                    <span>Device #1 *</span>
                    <input
                      value={deviceName}
                      onFocus={() => {
                        void ensureClientForDevice();
                      }}
                      onChange={(event) => {
                        setSelectedDeviceSuggestionId(null);
                        setDeviceName(event.target.value);
                      }}
                      placeholder="Enter device name"
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!canCreateClientDevice || isClientEnsuring}
                    onClick={async () => {
                      const resolvedClient = resolvedClientForDeviceCreate ?? (await ensureClientForDevice());
                      if (!resolvedClient) return;

                      setSelectedClientId(resolvedClient.id);
                      setSelectedClient(resolvedClient);
                      setNewDeviceName(deviceName.trim());
                      setNewDeviceIsActive(true);
                      setIsCreateDeviceModalOpen(true);
                    }}
                  >
                    Create new
                  </button>
                </div>
                {(visibleDeviceSuggestions.length > 0 || isDeviceLookupLoading) ? (
                  <div className="create-suggestions">
                    {isDeviceLookupLoading ? <p>Searching devices...</p> : null}
                    {visibleDeviceSuggestions.map((device) => (
                      <button
                        key={device.id}
                        type="button"
                        className="create-suggestion-item"
                        onClick={() => applyDevice(device)}
                    >
                      <strong>{device.name}</strong>
                      <span>{device.serialNumber || '-'}</span>
                    </button>
                  ))}
                </div>
                ) : null}

                <div className="create-row-2">
                  <label className="field">
                    <span>&nbsp;</span>
                    <input
                      value={deviceColor}
                      onChange={(event) => setDeviceColor(event.target.value)}
                      placeholder="Device color"
                    />
                  </label>
                  <label className="field">
                    <span>&nbsp;</span>
                    <input
                      value={deviceSerialNumber}
                      onChange={(event) => {
                        setSelectedDeviceSuggestionId(null);
                        setDeviceSerialNumber(event.target.value);
                      }}
                      placeholder="Serial number"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Kit</span>
                  <input
                    value={deviceKit}
                    onChange={(event) => setDeviceKit(event.target.value)}
                    placeholder="Describe accessories"
                  />
                </label>

                <label className="field">
                  <span>Repair type</span>
                  <select value={repairType} onChange={(event) => setRepairType(event.target.value)}>
                    <option>Paid</option>
                    <option>Warranty</option>
                  </select>
                </label>

                <label className="field">
                  <span>Issue from client</span>
                  <textarea
                    rows={3}
                    value={issueFromClient}
                    onChange={(event) => setIssueFromClient(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>External condition</span>
                  <textarea
                    rows={3}
                    value={externalView}
                    onChange={(event) => setExternalView(event.target.value)}
                    placeholder="Scratches, dents..."
                  />
                </label>
              </>
            )}

            <div className="create-prepay-row">
              <label className="field">
                <span>Estimated ready date</span>
                <input type="date" value={readyDate} onChange={(event) => setReadyDate(event.target.value)} />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input type="time" value={readyTime} onChange={(event) => setReadyTime(event.target.value)} />
              </label>
            </div>

            <h4 className="create-subtitle">Additional information</h4>
            <div className="create-checks-grid">
              <div className="create-checks-col">
                {(activeTab === 'sale' ? saleExtraOptionsLeft : extraOptionsLeft).map((option) => (
                  <label key={option} className="create-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(option)}
                      onChange={() => toggleFlag(option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <div className="create-checks-col">
                {(activeTab === 'sale' ? saleExtraOptionsRight : extraOptionsRight).map((option) => (
                  <label key={option} className="create-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(option)}
                      onChange={() => toggleFlag(option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <h3 className="create-section-title">Responsible</h3>
            <div className="create-row-2">
              <label className="field">
                  <span>Manager</span>
                <select
                  value={effectiveManagerId}
                  onChange={(event) => setManagerId(event.target.value)}
                  disabled={canCurrentEmployeeManageOrders}
                >
                  <option value="">Select manager</option>
                  {managers.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              {activeTab === 'repair' ? (
                <label className="field">
                  <span>Master</span>
                  <select value={masterId} onChange={(event) => setMasterId(event.target.value)}>
                    <option value="">Select master</option>
                    {masters.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="create-order-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save order'}
              </button>
            </div>
          </div>

          <aside className="create-order-right">
            <section className="create-side-box">
              <h4>Client devices</h4>
              {deviceHistory.length ? (
                <div className="create-side-list">
                  {deviceHistory.map((sale) => (
                    (() => {
                      const deviceItem = sale.lineItems?.find((item) => item.kind === 'product');
                      const deviceNameValue = deviceItem?.name?.trim() || sale.product.name;
                      const serialValue = sale.product.serialNumber?.trim();
                      const displaySerial =
                        serialValue && serialValue.toUpperCase() !== 'REPAIR-PLACEHOLDER'
                          ? serialValue
                          : '';
                      return (
                        <button
                          key={sale.id}
                          type="button"
                          className="create-side-list-button"
                          onClick={() =>
                            applyDevice({
                              id: sale.product.id,
                              clientId: sale.client.id,
                              clientName: sale.client.name,
                              clientPhone: sale.client.phone,
                              name: deviceNameValue,
                              serialNumber: displaySerial,
                              note: '',
                              source: 'repairOrder',
                              isActive: true,
                              createdAt: sale.createdAt,
                              updatedAt: sale.updatedAt,
                            })
                          }
                        >
                          <strong>{deviceNameValue}</strong>
                          <span>{displaySerial || '-'}</span>
                        </button>
                      );
                    })()
                  ))}
                </div>
              ) : (
                <p>Select client to view devices that were already in service.</p>
              )}
            </section>

            <section className="create-side-box">
              <h4>Client requests</h4>
              {visibleClientHistory?.sales.length ? (
                <div className="create-side-list">
                  {visibleClientHistory.sales.slice(0, 5).map((sale) => (
                    (() => {
                      const deviceItem = sale.lineItems?.find((item) => item.kind === 'product');
                      const deviceNameValue = deviceItem?.name?.trim() || sale.product.name;
                      return (
                        <div key={sale.id} className="create-side-list-item">
                          <a
                            className="create-side-list-link"
                            href={getOrderLink(sale.id, sale.kind)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {sale.recordNumber ?? 'r------'}
                          </a>
                          <span>{deviceNameValue}</span>
                        </div>
                      );
                    })()
                  ))}
                </div>
              ) : (
                <p>Select client or device to view previous requests.</p>
              )}
            </section>

            <section className="create-side-box">
              <h4>Selected flags</h4>
              <p>{selectedFlags.length > 0 ? selectedFlags.join(', ') : 'No flags selected.'}</p>
            </section>
          </aside>
        </div>
      </div>
      {isCreateDeviceModalOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="catalog-edit-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title">
                <h2>Create device</h2>
              </div>
              <button
                type="button"
                className="create-order-close"
                onClick={() => setIsCreateDeviceModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </header>
            <div className="catalog-edit-body">
              <label className="field">
                <span>Name</span>
                <input
                  value={newDeviceName}
                  onChange={(event) => setNewDeviceName(event.target.value)}
                  placeholder="Device name"
                />
              </label>
              <label className="create-inline-checkbox">
                <input
                  type="checkbox"
                  checked={newDeviceIsActive}
                  onChange={(event) => setNewDeviceIsActive(event.target.checked)}
                />
                <span>Activity</span>
              </label>
            </div>
            <footer className="catalog-edit-footer">
              <button type="button" className="secondary-button" onClick={() => setIsCreateDeviceModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={
                  isDeviceCreating ||
                  !selectedClientId ||
                  !selectedClient ||
                  newDeviceName.trim().length < 2
                }
                onClick={() => void createDeviceFromModal()}
              >
                {isDeviceCreating ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      <SupplierOrderModal
        isOpen={Boolean(supplierOrderModalItemId)}
        suppliers={suppliers}
        initialProductName={
          supplierOrderModalItemId
            ? saleItems.find((item) => item.id === supplierOrderModalItemId)?.query ?? ''
            : ''
        }
        onClose={() => setSupplierOrderModalItemId(null)}
        onCreateSupplier={onCreateSupplier}
        onSuccess={onSuccess}
        onError={onError}
        onSubmit={confirmSupplierOrderRequest}
      />
    </section>
  );
};
