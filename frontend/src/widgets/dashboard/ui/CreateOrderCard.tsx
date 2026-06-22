import { useEffect, useMemo, useState } from 'react';
import { createClient, getClients, getClientHistory } from '../../../entities/client/api/clientApi';
import type { Client, ClientHistory } from '../../../entities/client/model/types';
import type { Employee } from '../../../entities/employee/model/types';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import {
  createClientDevice,
  getClientDevices,
} from '../../../entities/client-device/api/clientDeviceApi';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { CreateOrderRequestPayload } from '../model/order-request';
import {
  buildCreateOrderProductSuggestions,
  type CreateOrderProductSuggestion,
} from '../model/create-order-products';
import { normalizeSerialNumber } from '../model/order-line-serials';
import {
  createOrderClientRequestsTabStorageKey,
  createOrderTabStorageKey,
  createSaleOrderItem,
  extraOptionsLeft,
  extraOptionsRight,
  extractDeviceKit,
  filterActiveDevicesByQuery,
  formatPhone,
  getDeviceHistory,
  parseDecimalInput,
  phoneDigitsOnly,
  saleExtraOptionsLeft,
  saleExtraOptionsRight,
  toApiPhone,
  toNameKey,
  topTabs,
  type ClientRequestTab,
  type SaleOrderItem,
} from './create-order-card-shared';
import { CreateOrderDeviceModal } from './CreateOrderDeviceModal';
import { CreateOrderRepairSection } from './CreateOrderRepairSection';
import { CreateOrderSaleSection } from './CreateOrderSaleSection';
import { CreateOrderSidePanel } from './CreateOrderSidePanel';

const getPhoneIdentity = (value: string) => phoneDigitsOnly(toApiPhone(value) || value);

type CreateOrderCardProps = {
  isSaving: boolean;
  employees: Employee[];
  currentEmployee: Employee | null;
  initialTab?: CreateOrderRequestPayload['sourceTab'];
  catalogProducts: CatalogProduct[];
  products: Product[];
  sales: Sale[];
  onClose: () => void;
  onSave: (payload: CreateOrderRequestPayload) => Promise<Sale | null>;
  onCreated?: (sale: Sale) => void;
  onError: (message: string) => void;
};

export const CreateOrderCard = ({
  isSaving,
  employees,
  currentEmployee,
  initialTab = 'repair',
  catalogProducts,
  products,
  sales,
  onClose,
  onSave,
  onCreated,
  onError,
}: CreateOrderCardProps) => {
  const [activeTab, setActiveTab] = useState<CreateOrderRequestPayload['sourceTab']>(
    () => initialTab,
  );
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
  const [saleProductSuggestions, setSaleProductSuggestions] = useState<CreateOrderProductSuggestion[]>([]);
  const [selectedDeviceSuggestionId, setSelectedDeviceSuggestionId] = useState<string | null>(null);
  const [focusedSaleItemId, setFocusedSaleItemId] = useState<string | null>(null);
  const [isClientLookupLoading, setIsClientLookupLoading] = useState(false);
  const [isDeviceLookupLoading, setIsDeviceLookupLoading] = useState(false);
  const [isSaleProductLookupLoading, setIsSaleProductLookupLoading] = useState(false);
  const [isClientEnsuring, setIsClientEnsuring] = useState(false);
  const [activeClientRequestTab, setActiveClientRequestTab] = useState<ClientRequestTab>(
    () => (initialTab === 'sale' ? 'sales' : 'orders'),
  );

  const managers = employees.filter(
    (employee) =>
      employee.isActive &&
      hasEmployeePermission(employee, 'orders.manage'),
  );
  const masters = employees.filter(
    (employee) =>
      employee.isActive &&
      (employee.role === 'master' ||
        hasEmployeePermission(employee, 'repairs.execute')),
  );
  const canCurrentEmployeeManageOrders =
    currentEmployee?.isActive === true &&
    hasEmployeePermission(currentEmployee, 'orders.manage');

  const phoneDigits = clientPhone.replace(/\D/g, '');
  const normalizedPhoneDigits = phoneDigits.startsWith('380')
    ? phoneDigits.slice(3)
    : phoneDigits.startsWith('0')
      ? phoneDigits.slice(1)
      : phoneDigits;
  const clientLookupQuery = [
    normalizedPhoneDigits.length >= 3 ? normalizedPhoneDigits : clientName.trim(),
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

    const normalizedInputPhone = getPhoneIdentity(clientPhone);
    const normalizedInputName = clientName.trim().toLowerCase();
    if (normalizedInputPhone.length < 3 && normalizedInputName.length < 2) {
      return null;
    }

    const exactMatches = clientSuggestions.filter((client) => {
      const samePhone =
        normalizedInputPhone.length > 0 &&
        getPhoneIdentity(client.phone) === normalizedInputPhone;
      const sameName =
        normalizedInputName.length >= 2 && client.name.trim().toLowerCase() === normalizedInputName;
      return samePhone || sameName;
    });

    return exactMatches.length === 1 ? exactMatches[0] : null;
  }, [selectedClientId, selectedClient, clientPhone, clientName, clientSuggestions]);
  const visibleClientHistory = selectedClientId ? clientHistory : null;
  const repairClientRequests = useMemo(
    () => visibleClientHistory?.sales.filter((sale) => sale.kind === 'repair') ?? [],
    [visibleClientHistory],
  );
  const saleClientRequests = useMemo(
    () => visibleClientHistory?.sales.filter((sale) => sale.kind === 'sale') ?? [],
    [visibleClientHistory],
  );
  const activeClientRequests =
    activeClientRequestTab === 'orders' ? repairClientRequests : saleClientRequests;
  const hasExactDeviceMatch = useMemo(() => {
    if (deviceName.trim().length < 2) return false;
    const normalizedInput = toNameKey(deviceName);
    return deviceSuggestions.some(
      (device) =>
        device.isActive && toNameKey(device.name) === normalizedInput,
    );
  }, [deviceName, deviceSuggestions]);
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
    !selectedDeviceSuggestionId &&
    !isDeviceLookupLoading &&
    !hasExactDeviceMatch &&
    visibleDeviceSuggestions.length === 0;
  const focusedSaleItem =
    saleItems.find((item) => item.id === focusedSaleItemId) ?? saleItems[0] ?? null;
  const saleProductLookupQuery = focusedSaleItem?.query.trim() ?? '';
  const visibleSaleProductSuggestions =
    activeTab === 'sale' &&
    saleProductLookupQuery.length >= 2 &&
    !focusedSaleItem?.catalogProductId &&
    !focusedSaleItem?.productId
      ? saleProductSuggestions
      : [];
  const saleItemsTotal = saleItems.reduce((total, item) => {
    const price = parseDecimalInput(item.price);
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
    setActiveClientRequestTab(activeTab === 'sale' ? 'sales' : 'orders');
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(createOrderTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        createOrderClientRequestsTabStorageKey,
        activeClientRequestTab,
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeClientRequestTab]);

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
          let suggestions = filterActiveDevicesByQuery(
            devices,
            deviceLookupQuery,
          );

          if (suggestions.length === 0) {
            const allDevices = await getClientDevices('');
            if (!isActive) return;
            suggestions = filterActiveDevicesByQuery(
              allDevices,
              deviceLookupQuery,
            );
          }

          setDeviceSuggestions(suggestions.slice(0, 8));
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
      Boolean(focusedSaleItem?.catalogProductId) ||
      Boolean(focusedSaleItem?.productId)
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
          setSaleProductSuggestions(
            buildCreateOrderProductSuggestions({
              products,
              catalogProducts,
              sales,
              query: saleProductLookupQuery,
              limit: 8,
            }),
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
  }, [
    activeTab,
    catalogProducts,
    focusedSaleItem?.catalogProductId,
    focusedSaleItem?.productId,
    products,
    saleProductLookupQuery,
    sales,
  ]);

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
    suggestion: CreateOrderProductSuggestion,
  ) => {
    if (!suggestion.selectable) {
      onError(`Product cannot be selected: ${suggestion.availabilityLabel}.`);
      return;
    }

    const serialNumber = normalizeSerialNumber(suggestion.serialNumber);
    const isSerializedStock =
      suggestion.source === 'stock' && Boolean(serialNumber);
    const unitPrice = suggestion.price > 0 ? String(suggestion.price) : '';

    updateSaleItem(itemId, {
      query: suggestion.name,
      source: suggestion.source,
      productId: suggestion.productId,
      catalogProductId: suggestion.catalogProductId,
      article: suggestion.article,
      serialNumber,
      price: unitPrice,
      unitPrice,
      quantity: isSerializedStock ? '1' : '1',
      warrantyPeriod: String(suggestion.warrantyPeriod ?? 0),
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
    if (item.source === 'stock' && item.serialNumber) {
      updateSaleItem(item.id, {
        quantity: '1',
        price: item.unitPrice || item.price,
      });
      onError('Serialized products are sold one serial per line. Add each serial separately.');
      return;
    }

    const nextQuantity = Math.max(1, Number.parseInt(value || '1', 10) || 1);
    const previousQuantity = Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1);
    const currentPrice = parseDecimalInput(item.price);
    const knownUnitPrice = parseDecimalInput(item.unitPrice);
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
    const numericPrice = parseDecimalInput(normalizedPrice);
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

    const normalizedPhoneDigits = getPhoneIdentity(normalizedPhone);
    const fromSuggestions = clientSuggestions.find(
      (client) => getPhoneIdentity(client.phone) === normalizedPhoneDigits,
    );
    if (fromSuggestions) {
      applyClient(fromSuggestions);
      return fromSuggestions;
    }

    setIsClientEnsuring(true);
    try {
      const clients = await getClients(normalizedPhone);
      const existingClient =
        clients.find((client) => getPhoneIdentity(client.phone) === normalizedPhoneDigits) ?? null;

      if (existingClient) {
        applyClient(existingClient);
        return existingClient;
      }

      const createdClient = await createClient({
        phone: normalizedPhone,
        name: normalizedName,
        email: '',
        address: '',
        registrationId: '',
        iban: '',
        note: '',
        status: '',
      });
      applyClient(createdClient);
      return createdClient;
    } catch {
      return null;
    } finally {
      setIsClientEnsuring(false);
    }
  };

  const openCreateDeviceModal = async () => {
    const resolvedClient =
      resolvedClientForDeviceCreate ?? (await ensureClientForDevice());
    if (!resolvedClient) return;

    setSelectedClientId(resolvedClient.id);
    setSelectedClient(resolvedClient);
    setNewDeviceName(deviceName.trim());
    setNewDeviceIsActive(true);
    setIsCreateDeviceModalOpen(true);
  };

  const handleSave = async () => {
    const normalizedSaleItems = saleItems.map((item) => {
      const quantity = Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1);
      const totalPrice = Math.max(0, parseDecimalInput(item.price) || 0);
      const knownUnitPrice = Math.max(0, parseDecimalInput(item.unitPrice) || 0);
      const resolvedUnitPrice = knownUnitPrice > 0 ? knownUnitPrice : totalPrice / quantity;
      const normalizedUnitPrice = String(Math.round(resolvedUnitPrice * 100) / 100);
      const serialNumber = normalizeSerialNumber(item.serialNumber);

      return {
        id: item.id,
        productId: item.source === 'stock' ? item.productId : '',
        catalogProductId:
          item.source === 'catalog' ? item.catalogProductId : undefined,
        name: item.query.trim(),
        article: item.article,
        serialNumber,
        serialNumbers:
          item.source === 'stock' && serialNumber ? [serialNumber] : undefined,
        price:
          item.source === 'stock' && serialNumber
            ? normalizedUnitPrice
            : String(Math.round(totalPrice * 100) / 100),
        quantity:
          item.source === 'stock' && serialNumber ? '1' : String(quantity),
        warrantyPeriod: item.warrantyPeriod,
        warehouse: '',
      };
    });

    const createdSale = await onSave({
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

    if (createdSale) {
      onClose();
      onCreated?.(createdSale);
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
              <CreateOrderSaleSection
                saleItems={saleItems}
                focusedSaleItem={focusedSaleItem}
                visibleSaleProductSuggestions={visibleSaleProductSuggestions}
                isSaleProductLookupLoading={isSaleProductLookupLoading}
                saleItemsTotal={saleItemsTotal}
                issueFromClient={issueFromClient}
                onIssueFromClientChange={setIssueFromClient}
                onFocusSaleItem={setFocusedSaleItemId}
                onUpdateSaleItem={updateSaleItem}
                onSaleItemQuantityChange={handleSaleItemQuantityChange}
                onSaleItemPriceChange={handleSaleItemPriceChange}
                onAddSaleItem={addSaleItem}
                onRemoveSaleItem={removeSaleItem}
                onApplySaleProduct={applySaleProduct}
              />
            ) : (
              <CreateOrderRepairSection
                deviceName={deviceName}
                deviceSerialNumber={deviceSerialNumber}
                deviceColor={deviceColor}
                deviceKit={deviceKit}
                repairType={repairType}
                issueFromClient={issueFromClient}
                externalView={externalView}
                canCreateClientDevice={canCreateClientDevice}
                isClientEnsuring={isClientEnsuring}
                selectedDeviceSuggestionId={selectedDeviceSuggestionId}
                hasExactDeviceMatch={hasExactDeviceMatch}
                visibleDeviceSuggestions={visibleDeviceSuggestions}
                isDeviceLookupLoading={isDeviceLookupLoading}
                onDeviceNameChange={setDeviceName}
                onDeviceSerialNumberChange={setDeviceSerialNumber}
                onDeviceColorChange={setDeviceColor}
                onDeviceKitChange={setDeviceKit}
                onRepairTypeChange={setRepairType}
                onIssueFromClientChange={setIssueFromClient}
                onExternalViewChange={setExternalView}
                onClearSelectedDeviceSuggestion={() =>
                  setSelectedDeviceSuggestionId(null)
                }
                onEnsureClientForDevice={ensureClientForDevice}
                onOpenCreateDevice={openCreateDeviceModal}
                onApplyDevice={applyDevice}
              />
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

          <CreateOrderSidePanel
            deviceHistory={deviceHistory}
            activeClientRequests={activeClientRequests}
            activeClientRequestTab={activeClientRequestTab}
            selectedFlags={selectedFlags}
            onApplyDevice={applyDevice}
            onClientRequestTabChange={setActiveClientRequestTab}
          />
        </div>
      </div>
      {isCreateDeviceModalOpen ? (
        <CreateOrderDeviceModal
          name={newDeviceName}
          isActive={newDeviceIsActive}
          isSaving={isDeviceCreating}
          canSave={
            Boolean(selectedClientId) &&
            Boolean(selectedClient) &&
            newDeviceName.trim().length >= 2
          }
          onNameChange={setNewDeviceName}
          onIsActiveChange={setNewDeviceIsActive}
          onClose={() => setIsCreateDeviceModalOpen(false)}
          onSave={() => void createDeviceFromModal()}
        />
      ) : null}
    </section>
  );
};



