import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createClient, getClients, getClientHistory } from '../../../../../entities/client/api/clientApi';
import type { Client, ClientHistory } from '../../../../../entities/client/model/types';
import { getClientPhones, getPrimaryClientPhone } from '../../../../../entities/client/model/forms';
import {
  clientMatchesPhoneQuery,
  formatClientPhonesLabel,
} from '../../../../../entities/client/lib/phone-match';
import type { Employee } from '../../../../../entities/employee/model/types';
import { hasEmployeePermission } from '../../../../../entities/employee/model/permissions';
import {
  createClientDevice,
  deleteClientDevice,
  getClientDevices,
  updateClientDevice,
} from '../../../../../entities/client-device/api/clientDeviceApi';
import {
  filterActiveClientDevicesForClient,
  getUnbindClientDeviceAction,
  unbindClientDevice,
} from '../../../../../entities/client-device/lib/unbind-client-device';
import type { ClientDevice } from '../../../../../entities/client-device/model/types';
import type { CatalogProduct } from '../../../../../entities/catalog-product/model/types';
import type { Product } from '../../../../../entities/product/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { CreateOrderRequestPayload } from '../../../model/order-request';
import {
  buildOrderDetailProductSuggestions,
  type OrderDetailProductSuggestion,
} from '../../../model/create-order-products';
import {
  createServiceCatalogItem,
  getServiceCatalogItems,
} from '../../../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog/model/types';
import { initialServiceCatalogForm } from '../../../../../entities/service-catalog/model/forms';
import { getWarehouseSettings } from '../../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings/model/types';
import {
  buildMissingServicePayload,
  shouldCreateMissingServiceOnSubmit,
} from '../../../model/missingService';
import {
  findBlacklistClientMatch,
  getBlacklistClientWarning,
  isBlacklistClient,
} from '../../../model/clients-workspace';
import { normalizeSerialNumber } from '../../../model/order-line-serials';
import {
  createOrderClientRequestsTabStorageKey,
  createOrderTabStorageKey,
  createSaleOrderItem,
  createSaleServiceOrderItem,
  extraOptionsLeft,
  extraOptionsRight,
  extractDeviceKit,
  filterActiveDevicesByQuery,
  formatPhone,
  parseDecimalInput,
  phoneDigitsOnly,
  saleExtraOptionsLeft,
  saleExtraOptionsRight,
  toApiPhone,
  toNameKey,
  topTabs,
  type ClientRequestTab,
  type SaleOrderItem,
  type SaleServiceOrderItem,
} from './create-order-card-shared';
import type { RapidSaleDraftItem } from '../../../model/rapid-sale-line-items';
import { CreateOrderDeviceModal } from './CreateOrderDeviceModal';
import { CreateOrderRepairSection } from './CreateOrderRepairSection';
import { CreateOrderSaleSection } from './CreateOrderSaleSection';
import { CreateOrderSaleServicesSection } from './CreateOrderSaleServicesSection';
import { OrderDetailCatalogServiceEditorModal } from '../order-detail/OrderDetailCatalogServiceEditorModal';
import { CreateOrderSidePanel } from './CreateOrderSidePanel';
import { RapidSaleModal } from './RapidSaleModal';

const getPhoneIdentity = (value: string) => phoneDigitsOnly(toApiPhone(value) || value);

const findClientByPhoneIdentity = (
  phoneIdentity: string,
  sources: Client[][],
): Client | null => {
  if (phoneIdentity.length < 3) return null;

  const seen = new Set<string>();
  for (const source of sources) {
    for (const client of source) {
      if (seen.has(client.id)) continue;
      seen.add(client.id);
      if (
        getClientPhones(client).some(
          (phone) => getPhoneIdentity(phone) === phoneIdentity,
        )
      ) {
        return client;
      }
    }
  }

  return null;
};

type CreateOrderCardProps = {
  isSaving: boolean;
  employees: Employee[];
  currentEmployee: Employee | null;
  initialTab?: CreateOrderRequestPayload['sourceTab'];
  catalogProducts: CatalogProduct[];
  products: Product[];
  sales: Sale[];
  clients?: Client[];
  onClose: () => void;
  onSave: (payload: CreateOrderRequestPayload) => Promise<Sale | null>;
  onCreated?: (sale: Sale) => void;
  onRapidSale?: (items: RapidSaleDraftItem[]) => Promise<Sale | null>;
  onRapidSaleCreated?: (sale: Sale) => void;
  onError: (message: string) => void;
  onOpenClientCard?: (clientId: string) => void;
};

export const CreateOrderCard = ({
  isSaving,
  employees,
  currentEmployee,
  initialTab = 'repair',
  catalogProducts,
  products,
  sales,
  clients = [],
  onClose,
  onSave,
  onCreated,
  onRapidSale,
  onRapidSaleCreated,
  onError,
  onOpenClientCard,
}: CreateOrderCardProps) => {
  const { t } = useTranslation();
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
  const [saleServiceItems, setSaleServiceItems] = useState<SaleServiceOrderItem[]>([]);
  const [saleProductSuggestions, setSaleProductSuggestions] = useState<
    OrderDetailProductSuggestion[]
  >([]);
  const [isServicesSectionOpen, setIsServicesSectionOpen] = useState(false);
  const [serviceQuery, setServiceQuery] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState('1');
  const [serviceWarranty, setServiceWarranty] = useState('1');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceSuggestions, setServiceSuggestions] = useState<ServiceCatalogItem[]>([]);
  const [isServiceLookupLoading, setIsServiceLookupLoading] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [createServiceForm, setCreateServiceForm] = useState(initialServiceCatalogForm);
  const [isCreateServiceSaving, setIsCreateServiceSaving] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  useEffect(() => {
    if (activeTab !== 'sale') {
      setWarehouses([]);
      return;
    }

    let isActive = true;
    void getWarehouseSettings()
      .then((settings) => {
        if (isActive) setWarehouses(settings.warehouses);
      })
      .catch(() => {
        if (isActive) setWarehouses([]);
      });

    return () => {
      isActive = false;
    };
  }, [activeTab]);
  const [selectedDeviceSuggestionId, setSelectedDeviceSuggestionId] = useState<string | null>(null);
  const [focusedSaleItemId, setFocusedSaleItemId] = useState<string | null>(null);
  const [isClientLookupLoading, setIsClientLookupLoading] = useState(false);
  const [isDeviceLookupLoading, setIsDeviceLookupLoading] = useState(false);
  const [isSaleProductLookupLoading, setIsSaleProductLookupLoading] = useState(false);
  const [isClientEnsuring, setIsClientEnsuring] = useState(false);
  const [isRapidSaleModalOpen, setIsRapidSaleModalOpen] = useState(false);
  const [registeredClientDevices, setRegisteredClientDevices] = useState<
    ClientDevice[]
  >([]);
  const [unbindingDeviceId, setUnbindingDeviceId] = useState<string | null>(
    null,
  );
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
  const shouldShowClientSuggestions =
    !selectedClientId && (normalizedPhoneDigits.length >= 3 || clientName.trim().length >= 2);
  const visibleClientSuggestions = shouldShowClientSuggestions ? clientSuggestions : [];
  const blacklistClientMatch = useMemo(() => {
    if (selectedClient && isBlacklistClient(selectedClient)) {
      return selectedClient;
    }

    return findBlacklistClientMatch(
      clientSuggestions,
      clientPhone,
      clientName,
    );
  }, [clientName, clientPhone, clientSuggestions, selectedClient]);
  const blacklistClientWarning = blacklistClientMatch
    ? getBlacklistClientWarning(blacklistClientMatch)
    : null;
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
      const clientPhones = getClientPhones(client);
      const samePhone =
        normalizedInputPhone.length > 0 &&
        clientPhones.some((ph) => getPhoneIdentity(ph) === normalizedInputPhone);
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
  const saleServicesTotal = saleServiceItems.reduce((total, item) => {
    const price = parseDecimalInput(item.price);
    const quantity = Number.parseInt(item.quantity || '0', 10);
    return total + (Number.isFinite(price) ? price : 0) * (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
  const saleOrderTotal = saleItemsTotal + saleServicesTotal;
  const serviceLookupQuery = serviceQuery.trim();
  const hasExactServiceSuggestion = serviceSuggestions.some(
    (service) =>
      service.name.trim().toLowerCase() === serviceLookupQuery.toLowerCase(),
  );
  const canCreateMissingService =
    isServicesSectionOpen &&
    serviceLookupQuery.length >= 2 &&
    !isServiceLookupLoading &&
    serviceSuggestions.length === 0 &&
    !hasExactServiceSuggestion &&
    !selectedServiceId;
  const effectiveManagerId =
    canCurrentEmployeeManageOrders && currentEmployee ? currentEmployee.id : managerId;

  useEffect(() => {
    if (!shouldShowClientSuggestions) return;

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsClientLookupLoading(true);
      try {
        const localMatches = clients.filter((client) =>
          clientMatchesPhoneQuery(client, clientLookupQuery),
        );
        let apiMatches: Client[] = [];

        try {
          apiMatches = await getClients(clientLookupQuery);
        } catch {
          apiMatches = [];
        }

        const mergedSuggestions = new Map<string, Client>();
        localMatches.forEach((client) => mergedSuggestions.set(client.id, client));
        apiMatches.forEach((client) => mergedSuggestions.set(client.id, client));

        if (isActive) {
          setClientSuggestions(Array.from(mergedSuggestions.values()).slice(0, 6));
        }
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
  }, [clientLookupQuery, clients, shouldShowClientSuggestions]);

  // Auto-apply exact phone match from suggestions so that an existing client by phone
  // is preferred (even if user typed a different name). This prevents accidental
  // duplicate client creation and makes the "exact phone client" test pass.
  useEffect(() => {
    if (selectedClientId) return;
    const norm = getPhoneIdentity(clientPhone);
    if (norm.length < 3) return;
    const match = findClientByPhoneIdentity(norm, [clientSuggestions, clients]);
    if (match) {
      if (clientName.trim() !== match.name) {
        setClientName(match.name);
      }
      setSelectedClientId(match.id);
      setSelectedClient(match);
      setClientSuggestions([]);
    }
  }, [clientSuggestions, clientPhone, selectedClientId, clientName, clients]);

  useEffect(() => {
    if (!selectedClientId) {
      setClientHistory(null);
      setRegisteredClientDevices([]);
      return;
    }

    let isActive = true;
    void (async () => {
      try {
        const [history, devices] = await Promise.all([
          getClientHistory(selectedClientId),
          getClientDevices(''),
        ]);
        if (!isActive) return;
        setClientHistory(history);
        setRegisteredClientDevices(
          filterActiveClientDevicesForClient(devices, selectedClientId),
        );
      } catch {
        if (isActive) {
          setClientHistory(null);
          setRegisteredClientDevices([]);
        }
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
            buildOrderDetailProductSuggestions({
              products,
              catalogProducts,
              sales,
              query: saleProductLookupQuery,
              warehouses,
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
    warehouses,
  ]);

  useEffect(() => {
    if (
      activeTab !== 'sale' ||
      !isServicesSectionOpen ||
      serviceLookupQuery.length < 2 ||
      Boolean(selectedServiceId)
    ) {
      setServiceSuggestions([]);
      setIsServiceLookupLoading(false);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsServiceLookupLoading(true);
      try {
        const services = await getServiceCatalogItems(serviceLookupQuery);
        if (isActive) setServiceSuggestions(services.slice(0, 6));
      } catch {
        if (isActive) setServiceSuggestions([]);
      } finally {
        if (isActive) setIsServiceLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    activeTab,
    isServicesSectionOpen,
    selectedServiceId,
    serviceLookupQuery,
  ]);

  const toggleFlag = (flag: string) => {
    setSelectedFlags((current) =>
      current.includes(flag)
        ? current.filter((item) => item !== flag)
        : [...current, flag],
    );
  };

  const applyClient = (client: Client) => {
    setClientPhone(getPrimaryClientPhone(client));
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

  const removeDeviceFromLocalState = (deviceId: string) => {
    setRegisteredClientDevices((current) =>
      current.filter((device) => device.id !== deviceId),
    );
    setDeviceSuggestions((current) =>
      current.filter((device) => device.id !== deviceId),
    );
    if (selectedDeviceSuggestionId === deviceId) {
      setSelectedDeviceSuggestionId(null);
    }
  };

  const handleUnbindDevice = async (device: ClientDevice) => {
    if (!device.isActive || unbindingDeviceId) return;

    const action = getUnbindClientDeviceAction(device);
    const confirmMessage =
      action === 'delete'
        ? t('clients.card.devices.confirmDelete', { name: device.name })
        : t('clients.card.devices.confirmDeactivate', { name: device.name });

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setUnbindingDeviceId(device.id);
    try {
      const ok = await unbindClientDevice(device, {
        onDelete: async (deviceId) => {
          await deleteClientDevice(deviceId);
          return true;
        },
        onUpdate: async (deviceId, payload) => {
          await updateClientDevice(deviceId, payload);
          return true;
        },
      });
      if (ok) {
        removeDeviceFromLocalState(device.id);
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('dashboard.actions.errors.failedRemoveClientDevice'),
      );
    } finally {
      setUnbindingDeviceId(null);
    }
  };

  const updateSaleItem = (itemId: string, patch: Partial<SaleOrderItem>) => {
    setSaleItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const applySaleProduct = (
    itemId: string,
    suggestion: OrderDetailProductSuggestion,
  ) => {
    if (!suggestion.selectable) {
      onError(
        t('orders.create.errors.productCannotBeSelected', {
          reason: suggestion.availabilityLabel,
        }),
      );
      return;
    }

    const serialNumber = normalizeSerialNumber(suggestion.serialNumber);
    const unitPrice = suggestion.price > 0 ? String(suggestion.price) : '';

    if (suggestion.source === 'catalog') {
      updateSaleItem(itemId, {
        query: suggestion.name,
        source: 'catalog',
        productId: '',
        catalogProductId: suggestion.catalogProductId,
        article: '',
        serialNumber: '',
        price: unitPrice,
        unitPrice,
        quantity: '1',
        warrantyPeriod: String(suggestion.warrantyPeriod ?? 0),
      });
      setSaleProductSuggestions([]);
      return;
    }

    if (serialNumber) {
      updateSaleItem(itemId, {
        query: suggestion.name,
        source: 'stock',
        productId: suggestion.productId,
        catalogProductId: '',
        article: suggestion.article,
        serialNumber,
        price: unitPrice,
        unitPrice,
        quantity: '1',
        warrantyPeriod: String(suggestion.warrantyPeriod ?? 0),
      });
      setSaleProductSuggestions([]);
      return;
    }

    updateSaleItem(itemId, {
      query: suggestion.name,
      source: '',
      productId: '',
      catalogProductId: '',
      article: suggestion.article,
      serialNumber: '',
      price: unitPrice,
      unitPrice,
      quantity: '1',
      warrantyPeriod: String(suggestion.warrantyPeriod ?? 0),
    });
    setSaleProductSuggestions([]);
  };

  const resetServiceEntry = () => {
    setServiceQuery('');
    setServicePrice('');
    setServiceQuantity('1');
    setServiceWarranty('1');
    setSelectedServiceId('');
    setServiceSuggestions([]);
  };

  const applyServiceSuggestion = (service: ServiceCatalogItem) => {
    setServiceQuery(service.name);
    setServicePrice(String(service.price));
    setServiceQuantity('1');
    setServiceWarranty('1');
    setSelectedServiceId(service.id);
    setServiceSuggestions([]);
  };

  const addServiceItem = async () => {
    const normalizedName = serviceQuery.trim();
    if (normalizedName.length < 2) {
      onError(t('orders.rapidSale.errors.serviceName'));
      return;
    }

    let nextServiceId = selectedServiceId || undefined;
    if (
      shouldCreateMissingServiceOnSubmit({
        kind: 'service',
        normalizedName,
        selectedServiceId: nextServiceId,
        suggestionNames: serviceSuggestions.map((service) => service.name),
      })
    ) {
      try {
        const createdService = await createServiceCatalogItem(
          buildMissingServicePayload(
            normalizedName,
            parseDecimalInput(servicePrice) || 0,
          ),
        );
        nextServiceId = createdService.id;
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : t('orders.rapidSale.errors.failedCreateService'),
        );
        return;
      }
    }

    setSaleServiceItems((current) => [
      ...current,
      createSaleServiceOrderItem({
        serviceId: nextServiceId,
        name: normalizedName,
        price: servicePrice || '0',
        quantity: serviceQuantity || '1',
        warrantyPeriod: serviceWarranty || '1',
      }),
    ]);
    resetServiceEntry();
  };

  const openCreateServiceModal = () => {
    setCreateServiceForm({
      ...initialServiceCatalogForm,
      name: serviceLookupQuery,
      price: servicePrice,
    });
    setIsCreateServiceOpen(true);
  };

  const saveCreatedService = async () => {
    setIsCreateServiceSaving(true);
    try {
      const createdService = await createServiceCatalogItem(createServiceForm);
      applyServiceSuggestion(createdService);
      setIsCreateServiceOpen(false);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.rapidSale.errors.failedCreateService'),
      );
    } finally {
      setIsCreateServiceSaving(false);
    }
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
      onError(t('orders.create.errors.serializedOnePerLine'));
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
      if (newDeviceIsActive) {
        setRegisteredClientDevices((current) =>
          filterActiveClientDevicesForClient(
            [...current, created],
            selectedClient.id,
          ),
        );
      }
      setIsCreateDeviceModalOpen(false);
    } finally {
      setIsDeviceCreating(false);
    }
  };

  const ensureClientForDevice = async () => {
    if (isClientEnsuring) return selectedClient;

    const normalizedPhone = toApiPhone(clientPhone);
    const normalizedName = clientName.trim();
    if (!normalizedPhone || normalizedName.length < 2) {
      return selectedClient;
    }

    const normalizedPhoneDigits = getPhoneIdentity(normalizedPhone);
    const knownClient =
      findClientByPhoneIdentity(normalizedPhoneDigits, [
        clientSuggestions,
        clients,
      ]) ??
      (selectedClient &&
      getClientPhones(selectedClient).some(
        (phone) => getPhoneIdentity(phone) === normalizedPhoneDigits,
      )
        ? selectedClient
        : null);
    if (knownClient && selectedClientId !== knownClient.id) {
      applyClient(knownClient);
    }

    setIsClientEnsuring(true);
    try {
      const apiClients = await getClients(normalizedPhone);
      const existingClient =
        findClientByPhoneIdentity(normalizedPhoneDigits, [apiClients]) ??
        knownClient;

      if (existingClient) {
        applyClient(existingClient);
        return existingClient;
      }

      const createdClient = await createClient({
        phone: normalizedPhone,
        phones: [normalizedPhone],
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

    const normalizedSaleServiceItems = saleServiceItems
      .map((item) => ({
        id: item.id,
        serviceId: item.serviceId,
        name: item.name.trim(),
        price: String(Math.max(0, parseDecimalInput(item.price) || 0)),
        quantity: String(
          Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1),
        ),
        warrantyPeriod: String(
          Math.max(0, Number.parseInt(item.warrantyPeriod || '1', 10) || 1),
        ),
      }))
      .filter((item) => item.name.length >= 2);

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
      estimatedCost:
        activeTab === 'sale'
          ? String(Math.round(saleOrderTotal * 100) / 100)
          : '0',
      readyDate,
      readyTime,
      managerId: effectiveManagerId,
      masterId,
      extraFlags: selectedFlags,
      sourceTab: activeTab,
      saleItems: normalizedSaleItems,
      saleServiceItems: normalizedSaleServiceItems,
    });

    if (createdSale) {
      onClose();
      onCreated?.(createdSale);
    }
  };

  return (
    <section className="create-order-page">
      <header className="create-order-header">
        <h2>{t('orders.create.title')}</h2>
        <div className="create-order-header-actions">
          {activeTab === 'sale' && onRapidSale ? (
            <button
              type="button"
              className="secondary-button create-order-rapid-sale-button"
              onClick={() => setIsRapidSaleModalOpen(true)}
            >
              {t('orders.rapidSale.openButton')}
            </button>
          ) : null}
          <button type="button" className="create-order-close" aria-label={t('orders.create.closeForm')} onClick={onClose}>
            x
          </button>
        </div>
      </header>

      <div className="create-order-body">
        <div className="create-order-tabs" role="tablist" aria-label={t('orders.create.orderTypeTabs')}>
          {topTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={tab.key === activeTab ? 'create-order-tab create-order-tab-active' : 'create-order-tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className="create-order-grid">
          <div className="create-order-left">
            <h3 className="create-section-title">{t('orders.create.client')}</h3>
            <div className="create-row-2">
              <label className="field">
                <span>{t('orders.create.clientData')}</span>
                <input
                  value={clientPhone}
                  onChange={(event) => onClientPhoneChange(event.target.value)}
                  onBlur={onClientPhoneBlur}
                  placeholder={t('orders.create.phonePlaceholder')}
                />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input
                  value={clientName}
                  onChange={(event) => onClientNameChange(event.target.value)}
                  placeholder={t('orders.create.fullName')}
                />
              </label>
            </div>
            {(visibleClientSuggestions.length > 0 || isClientLookupLoading) ? (
              <div className="create-suggestions">
                {isClientLookupLoading ? <p>{t('orders.create.searchingClients')}</p> : null}
                {visibleClientSuggestions.map((client) => {
                  const isBlacklisted = isBlacklistClient(client);
                  return (
                    <button
                      key={client.id}
                      type="button"
                      className={
                        isBlacklisted
                          ? 'create-suggestion-item create-client-suggestion-blacklist'
                          : 'create-suggestion-item'
                      }
                      title={
                        isBlacklisted
                          ? t('orders.create.blacklist.clientInBlacklist')
                          : undefined
                      }
                      onClick={() => applyClient(client)}
                    >
                      <span className="create-client-suggestion-heading">
                        <strong>{client.name}</strong>
                        {isBlacklisted ? (
                          <span className="client-status-badge status-blacklist">
                            {t('orders.create.blacklist.badge')}
                          </span>
                        ) : null}
                      </span>
                      <span>{formatClientPhonesLabel(client)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {blacklistClientMatch ? (
              <button
                type="button"
                className="create-client-blacklist-warning"
                disabled={!onOpenClientCard}
                aria-label={t('orders.create.blacklist.openClientCard', {
                  name: blacklistClientMatch.name,
                })}
                onClick={() => onOpenClientCard?.(blacklistClientMatch.id)}
              >
                <span className="create-client-blacklist-warning-copy">
                  <strong>{t('orders.create.blacklist.clientInBlacklist')}</strong>
                  <span>
                    {blacklistClientMatch.name} / {blacklistClientMatch.phone}
                  </span>
                </span>
                <span className="create-client-blacklist-warning-message">
                  {t('orders.create.blacklist.checkBeforeCreate')}
                </span>
                <span className="client-status-badge status-blacklist">
                  {t('orders.create.blacklist.badge')}
                </span>
                <span className="visually-hidden">{blacklistClientWarning}</span>
              </button>
            ) : null}

            {activeTab === 'sale' ? (
              <>
                <CreateOrderSaleSection
                  saleItems={saleItems}
                  focusedSaleItem={focusedSaleItem}
                  visibleSaleProductSuggestions={visibleSaleProductSuggestions}
                  isSaleProductLookupLoading={isSaleProductLookupLoading}
                  saleItemsTotal={saleOrderTotal}
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
                <CreateOrderSaleServicesSection
                  isOpen={isServicesSectionOpen}
                  serviceQuery={serviceQuery}
                  servicePrice={servicePrice}
                  serviceQuantity={serviceQuantity}
                  serviceWarranty={serviceWarranty}
                  serviceSuggestions={serviceSuggestions}
                  isServiceLookupLoading={isServiceLookupLoading}
                  canCreateMissingService={canCreateMissingService}
                  saleServiceItems={saleServiceItems}
                  onToggle={() => setIsServicesSectionOpen((current) => !current)}
                  onServiceQueryChange={(value) => {
                    setServiceQuery(value);
                    setSelectedServiceId('');
                  }}
                  onServicePriceChange={setServicePrice}
                  onServiceQuantityChange={setServiceQuantity}
                  onServiceWarrantyChange={setServiceWarranty}
                  onApplyServiceSuggestion={applyServiceSuggestion}
                  onAddService={addServiceItem}
                  onOpenCreateService={openCreateServiceModal}
                  onRemoveServiceItem={(itemId) =>
                    setSaleServiceItems((current) =>
                      current.filter((item) => item.id !== itemId),
                    )
                  }
                />
              </>
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
                <span>{t('orders.create.estimatedReadyDate')}</span>
                <input type="date" value={readyDate} onChange={(event) => setReadyDate(event.target.value)} />
              </label>
              <label className="field">
                <span>&nbsp;</span>
                <input type="time" value={readyTime} onChange={(event) => setReadyTime(event.target.value)} />
              </label>
            </div>

            <h4 className="create-subtitle">{t('orders.create.additionalInformation')}</h4>
            <div className="create-checks-grid">
              <div className="create-checks-col">
                {(activeTab === 'sale' ? saleExtraOptionsLeft : extraOptionsLeft).map((option) => (
                  <label key={option.key} className="create-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(option.key)}
                      onChange={() => toggleFlag(option.key)}
                    />
                    <span>{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>
              <div className="create-checks-col">
                {(activeTab === 'sale' ? saleExtraOptionsRight : extraOptionsRight).map((option) => (
                  <label key={option.key} className="create-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFlags.includes(option.key)}
                      onChange={() => toggleFlag(option.key)}
                    />
                    <span>{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>
            </div>

            <h3 className="create-section-title">{t('orders.create.responsible')}</h3>
            <div className="create-row-2">
              <label className="field">
                  <span>{t('orders.columns.manager')}</span>
                <select
                  value={effectiveManagerId}
                  onChange={(event) => setManagerId(event.target.value)}
                  disabled={canCurrentEmployeeManageOrders}
                >
                  <option value="">{t('orders.create.selectManager')}</option>
                  {managers.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              {activeTab === 'repair' ? (
                <label className="field">
                  <span>{t('orders.columns.master')}</span>
                  <select value={masterId} onChange={(event) => setMasterId(event.target.value)}>
                    <option value="">{t('orders.create.selectMaster')}</option>
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
                {t('common.cancel')}
              </button>
              <button type="button" className="primary-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? t('orders.create.saving') : t('orders.create.saveOrder')}
              </button>
            </div>
          </div>

          <CreateOrderSidePanel
            hasSelectedClient={Boolean(selectedClientId)}
            registeredClientDevices={registeredClientDevices}
            unbindingDeviceId={unbindingDeviceId}
            activeClientRequests={activeClientRequests}
            activeClientRequestTab={activeClientRequestTab}
            selectedFlags={selectedFlags}
            onApplyDevice={applyDevice}
            onUnbindDevice={(device) => {
              void handleUnbindDevice(device);
            }}
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
      {isCreateServiceOpen ? (
        <OrderDetailCatalogServiceEditorModal
          title={t('orders.detail.lineItems.createService')}
          form={createServiceForm}
          isSaving={isCreateServiceSaving}
          isEditing
          onChange={(field, value) =>
            setCreateServiceForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSubmit={() => void saveCreatedService()}
          onClose={() => setIsCreateServiceOpen(false)}
        />
      ) : null}
      {isRapidSaleModalOpen && onRapidSale ? (
        <RapidSaleModal
          products={products}
          sales={sales}
          isSaving={isSaving}
          onClose={() => setIsRapidSaleModalOpen(false)}
          onError={onError}
          onSubmit={async (items) => {
            const createdSale = await onRapidSale(items);
            if (!createdSale) return;
            setIsRapidSaleModalOpen(false);
            onRapidSaleCreated?.(createdSale);
          }}
        />
      ) : null}
    </section>
  );
};



