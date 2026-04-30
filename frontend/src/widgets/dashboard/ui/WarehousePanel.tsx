import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Employee } from '../../../entities/employee/model/types';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { ProductForm } from '../../../features/manage-product/ui/ProductForm';
import { formatDate } from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';

type WarehouseTab = 'stock' | 'receipts' | 'expenses' | 'transfers' | 'logistics' | 'inventory' | 'settings';
type WarehouseSearchMode = 'serial' | 'name' | 'warehouse';
type SettingsTab = 'service-centers' | 'warehouses' | 'administrators';

type ServiceCenter = { id: string; name: string; color: string; address: string; phone: string };
type WarehouseLocation = { id: string; name: string };
type WarehouseItem = {
  id: string;
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: WarehouseLocation[];
};
type Administrator = {
  employeeId: string;
  warehouseIds: string[];
  defaultWarehouseId: string;
  defaultLocationId: string;
};
type ServiceCenterFormState = { name: string; color: string; address: string; phone: string };
type WarehouseFormState = {
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: string[];
};

type WarehousePanelProps = {
  products: Product[];
  employees: Employee[];
  isLoading: boolean;
  productForm: ProductFormValues;
  isProductSaving: boolean;
  isProductEditing: boolean;
  onProductChange: <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => void;
  onProductSubmit: () => void;
  onProductCancelEdit: () => void;
  onProductEdit: (product: Product) => void;
  onProductDelete: (product: Product) => void;
};

const tabs: Array<{ key: WarehouseTab; label: string; badge?: string }> = [
  { key: 'stock', label: 'Stock balances' },
  { key: 'receipts', label: 'Receipts', badge: '10' },
  { key: 'expenses', label: 'Expenses', badge: '4' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'settings', label: 'Settings' },
];

const searchModes: Array<{ key: WarehouseSearchMode; label: string }> = [
  { key: 'serial', label: 'By serial #' },
  { key: 'name', label: 'By name' },
  { key: 'warehouse', label: 'By warehouse' },
];

const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'service-centers', label: 'Сервісні центри' },
  { key: 'warehouses', label: 'Склади' },
  { key: 'administrators', label: 'Адміністратори' },
];

const initialServiceCenters: ServiceCenter[] = [
  { id: 'sc-1', name: 'Філія Ремонт Сервіс Чорноморськ', color: '#8b5cf6', address: 'вул. Вишнева 4 м. Чорноморськ Одеська обл', phone: '+380635567090' },
  { id: 'sc-2', name: 'Ремонт Сервіс Чорноморськ', color: '#10b981', address: 'вул. Віталія Шума 21 м. Чорноморськ Одеська обл', phone: '+380635567090' },
];

const initialWarehouses: WarehouseItem[] = [
  { id: 'w-1', name: 'Ремонт Сервіс Чорноморськ', isActive: true, serviceCenterId: 'sc-2', receiptAddress: 'вул. Віталія Шума буд. 2-Б м. Чорноморськ Одеська обл.', receiptPhone: '063 556 70 90', locations: [{ id: 'l-1', name: 'A' }, { id: 'l-2', name: 'Вітрина - 3' }] },
  { id: 'w-2', name: 'Філія Основний', isActive: true, serviceCenterId: 'sc-1', receiptAddress: 'вул. Вишнева, буд. 4 Чорноморськ Одеська обл.', receiptPhone: '063 556 70 90', locations: [{ id: 'l-3', name: 'A' }] },
];

const initialAdministrators: Administrator[] = [];

const paginationPageSizeOptions = [10, 30, 50, 100];
const getSearchText = (product: Product, mode: WarehouseSearchMode) => (mode === 'serial' ? product.serialNumber : mode === 'warehouse' ? product.purchasePlace : [product.name, product.article, product.note].join(' '));
const toServiceCenterForm = (c?: ServiceCenter): ServiceCenterFormState => ({ name: c?.name ?? '', color: c?.color ?? '#000000', address: c?.address ?? '', phone: c?.phone ?? '+380' });
const toWarehouseForm = (w?: WarehouseItem): WarehouseFormState => ({ name: w?.name ?? '', isActive: w?.isActive ?? true, serviceCenterId: w?.serviceCenterId ?? '', receiptAddress: w?.receiptAddress ?? '', receiptPhone: w?.receiptPhone ?? '', locations: w?.locations.map((x) => x.name) ?? [''] });

export const WarehousePanel = ({ products, employees, isLoading, productForm, isProductSaving, isProductEditing, onProductChange, onProductSubmit, onProductCancelEdit, onProductEdit, onProductDelete }: WarehousePanelProps) => {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('stock');
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<WarehouseSearchMode>('serial');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('service-centers');
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>(initialServiceCenters);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>(initialWarehouses);
  const [administrators, setAdministrators] = useState<Administrator[]>(initialAdministrators);
  const [serviceCenterModalId, setServiceCenterModalId] = useState<string | null>(null);
  const [serviceCenterForm, setServiceCenterForm] = useState<ServiceCenterFormState>(toServiceCenterForm());
  const [warehouseModalId, setWarehouseModalId] = useState<string | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(toWarehouseForm());
  const activeEmployees = useMemo(() => employees.filter((employee) => employee.isActive), [employees]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => getSearchText(product, searchMode).toLowerCase().includes(normalizedQuery));
  }, [products, query, searchMode]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [currentPage, filteredProducts, pageSize]);

  const warehousesByServiceCenter = useMemo(() => warehouses.reduce<Record<string, number>>((acc, warehouse) => {
    acc[warehouse.serviceCenterId] = (acc[warehouse.serviceCenterId] ?? 0) + 1;
    return acc;
  }, {}), [warehouses]);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, filteredProducts.length, pageSize]);

  useEffect(() => setCurrentPage(1), [activeTab, searchMode]);

  useEffect(() => {
    setAdministrators((current) => {
      const currentByEmployee = current.reduce<Record<string, Administrator>>((acc, administrator) => {
        acc[administrator.employeeId] = administrator;
        return acc;
      }, {});
      return activeEmployees.map((employee) => currentByEmployee[employee.id] ?? {
        employeeId: employee.id,
        warehouseIds: warehouses[0] ? [warehouses[0].id] : [],
        defaultWarehouseId: warehouses[0]?.id ?? '',
        defaultLocationId: warehouses[0]?.locations[0]?.id ?? '',
      });
    });
  }, [activeEmployees, warehouses]);

  const saveServiceCenter = () => {
    const normalizedName = serviceCenterForm.name.trim();
    if (!normalizedName) return;
    if (serviceCenterModalId === 'new') {
      setServiceCenters((current) => [...current, { id: `sc-${Date.now()}`, name: normalizedName, color: serviceCenterForm.color, address: serviceCenterForm.address.trim(), phone: serviceCenterForm.phone.trim() }]);
    } else {
      setServiceCenters((current) => current.map((x) => (x.id === serviceCenterModalId ? { ...x, name: normalizedName, color: serviceCenterForm.color, address: serviceCenterForm.address.trim(), phone: serviceCenterForm.phone.trim() } : x)));
    }
    setServiceCenterModalId(null);
  };

  const saveWarehouse = () => {
    const normalizedName = warehouseForm.name.trim();
    const normalizedLocations = warehouseForm.locations.map((x) => x.trim()).filter(Boolean);
    if (!normalizedName || !warehouseForm.serviceCenterId || normalizedLocations.length === 0) return;
    const locations = normalizedLocations.map((name, index) => ({ id: `l-${Date.now()}-${index}`, name }));
    if (warehouseModalId === 'new') {
      setWarehouses((current) => [...current, { id: `w-${Date.now()}`, name: normalizedName, isActive: warehouseForm.isActive, serviceCenterId: warehouseForm.serviceCenterId, receiptAddress: warehouseForm.receiptAddress.trim(), receiptPhone: warehouseForm.receiptPhone.trim(), locations }]);
    } else {
      setWarehouses((current) => current.map((x) => (x.id === warehouseModalId ? { ...x, name: normalizedName, isActive: warehouseForm.isActive, serviceCenterId: warehouseForm.serviceCenterId, receiptAddress: warehouseForm.receiptAddress.trim(), receiptPhone: warehouseForm.receiptPhone.trim(), locations } : x)));
    }
    setWarehouseModalId(null);
  };

  return (
    <section className="panel warehouse-panel">
      <div className="warehouse-tabs" role="tablist" aria-label="Warehouse sections">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={tab.key === activeTab ? 'warehouse-tab warehouse-tab-active' : 'warehouse-tab'} onClick={() => setActiveTab(tab.key)}>
            <span>{tab.label}</span>
            {tab.badge ? <strong>{tab.badge}</strong> : null}
          </button>
        ))}
      </div>

      {activeTab !== 'settings' ? (
        <div className="warehouse-toolbar">
          <button type="button" className="toolbar-square-button" aria-label="Previous page">‹</button>
          <span className="warehouse-page-number">1</span>
          <button type="button" className="toolbar-square-button" aria-label="Next page">›</button>
          <button type="button" className="toolbar-square-button" aria-label="Filters">☷</button>
          <button type="button" className="toolbar-filter-button">Filter</button>
          <div className="orders-search-group warehouse-search-group">
            <input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Search stock" />
            <button type="button">Find</button>
          </div>
          <div className="warehouse-search-modes">
            {searchModes.map((mode) => (
              <button key={mode.key} type="button" className={mode.key === searchMode ? 'warehouse-mode-button warehouse-mode-button-active' : 'warehouse-mode-button'} onClick={() => { setSearchMode(mode.key); setCurrentPage(1); }}>
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'receipts' ? <div className="warehouse-receipt"><ProductForm form={productForm} isSaving={isProductSaving} isEditing={isProductEditing} onChange={onProductChange} onSubmit={onProductSubmit} onCancelEdit={onProductCancelEdit} /></div> : null}

      {activeTab === 'settings' ? (
        <WarehouseSettings
          tab={settingsTab}
          onTabChange={setSettingsTab}
          employees={activeEmployees}
          serviceCenters={serviceCenters}
          warehouses={warehouses}
          administrators={administrators}
          warehousesByServiceCenter={warehousesByServiceCenter}
          onCreateServiceCenter={() => { setServiceCenterModalId('new'); setServiceCenterForm(toServiceCenterForm()); }}
          onEditServiceCenter={(serviceCenter) => { setServiceCenterModalId(serviceCenter.id); setServiceCenterForm(toServiceCenterForm(serviceCenter)); }}
          onCreateWarehouse={() => { setWarehouseModalId('new'); setWarehouseForm(toWarehouseForm()); }}
          onEditWarehouse={(warehouse) => { setWarehouseModalId(warehouse.id); setWarehouseForm(toWarehouseForm(warehouse)); }}
          onAdministratorChange={setAdministrators}
        />
      ) : activeTab === 'stock' || activeTab === 'receipts' ? (
        <>
          <StockTable products={paginatedProducts} isLoading={isLoading} onEdit={onProductEdit} onDelete={onProductDelete} />
          <PaginationPanel totalItems={filteredProducts.length} page={currentPage} pageSize={pageSize} pageSizeOptions={paginationPageSizeOptions} onPageChange={setCurrentPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setCurrentPage(1); }} />
        </>
      ) : <p className="empty-state">This warehouse section is ready for the next workflow.</p>}

      {serviceCenterModalId ? (
        <ModalShell title={serviceCenterModalId === 'new' ? 'Додати сервісний центр' : 'Редагувати сервісний центр'} onClose={() => setServiceCenterModalId(null)} onSubmit={saveServiceCenter} submitLabel={serviceCenterModalId === 'new' ? 'Створити' : 'Зберегти'} canSubmit={serviceCenterForm.name.trim().length > 1}>
          <label className="field"><span>Назва:</span><input value={serviceCenterForm.name} onChange={(event) => setServiceCenterForm((current) => ({ ...current, name: event.target.value }))} placeholder="Введіть назву" /></label>
          <label className="field">
            <span>Колір (#000000):</span>
            <div className="warehouse-settings-color-field">
              <input value={serviceCenterForm.color} onChange={(event) => setServiceCenterForm((current) => ({ ...current, color: event.target.value }))} placeholder="#000000" />
              <input type="color" aria-label="Колір сервісного центру" value={serviceCenterForm.color} onChange={(event) => setServiceCenterForm((current) => ({ ...current, color: event.target.value }))} />
            </div>
          </label>
          <label className="field"><span>Адреса:</span><input value={serviceCenterForm.address} onChange={(event) => setServiceCenterForm((current) => ({ ...current, address: event.target.value }))} placeholder="Введіть адресу" /></label>
          <label className="field"><span>Телефон:</span><input value={serviceCenterForm.phone} onChange={(event) => setServiceCenterForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+380" /></label>
        </ModalShell>
      ) : null}

      {warehouseModalId ? (
        <ModalShell title={warehouseModalId === 'new' ? 'Додати склад' : 'Редагувати склад'} onClose={() => setWarehouseModalId(null)} onSubmit={saveWarehouse} submitLabel={warehouseModalId === 'new' ? 'Створити' : 'Зберегти'} canSubmit={warehouseForm.name.trim().length > 1 && Boolean(warehouseForm.serviceCenterId) && warehouseForm.locations.some((location) => location.trim().length > 0)}>
          <label className="field"><span>Назва:</span><input value={warehouseForm.name} onChange={(event) => setWarehouseForm((current) => ({ ...current, name: event.target.value }))} placeholder="Введіть назву" /></label>
          <label className="create-inline-checkbox"><input type="checkbox" checked={warehouseForm.isActive} onChange={(event) => setWarehouseForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Активність</span></label>
          <label className="field">
            <span>Належність до сервісного центру:</span>
            <select value={warehouseForm.serviceCenterId} onChange={(event) => setWarehouseForm((current) => ({ ...current, serviceCenterId: event.target.value }))}>
              <option value="">Оберіть сервісний центр</option>
              {serviceCenters.map((serviceCenter) => <option key={serviceCenter.id} value={serviceCenter.id}>{serviceCenter.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Адреса для квитанції:</span><input value={warehouseForm.receiptAddress} onChange={(event) => setWarehouseForm((current) => ({ ...current, receiptAddress: event.target.value }))} /></label>
          <label className="field"><span>Телефон для квитанції:</span><input value={warehouseForm.receiptPhone} onChange={(event) => setWarehouseForm((current) => ({ ...current, receiptPhone: event.target.value }))} /></label>
          <div className="field">
            <span>Локації:</span>
            <div className="warehouse-settings-locations">
              {warehouseForm.locations.map((location, index) => (
                <input key={`${warehouseModalId}-location-${index}`} value={location} onChange={(event) => { const nextLocations = [...warehouseForm.locations]; nextLocations[index] = event.target.value; setWarehouseForm((current) => ({ ...current, locations: nextLocations })); }} placeholder="Вкажіть назву локації" />
              ))}
            </div>
            <button type="button" className="warehouse-settings-add-location" onClick={() => setWarehouseForm((current) => ({ ...current, locations: [...current.locations, ''] }))}>+ Додати локацію</button>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
};

const WarehouseSettings = ({ tab, onTabChange, employees, serviceCenters, warehouses, administrators, warehousesByServiceCenter, onCreateServiceCenter, onEditServiceCenter, onCreateWarehouse, onEditWarehouse, onAdministratorChange }: {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  employees: Employee[];
  serviceCenters: ServiceCenter[];
  warehouses: WarehouseItem[];
  administrators: Administrator[];
  warehousesByServiceCenter: Record<string, number>;
  onCreateServiceCenter: () => void;
  onEditServiceCenter: (serviceCenter: ServiceCenter) => void;
  onCreateWarehouse: () => void;
  onEditWarehouse: (warehouse: WarehouseItem) => void;
  onAdministratorChange: (updater: Administrator[] | ((current: Administrator[]) => Administrator[])) => void;
}) => {
  const serviceCenterMap = useMemo(() => serviceCenters.reduce<Record<string, ServiceCenter>>((acc, x) => { acc[x.id] = x; return acc; }, {}), [serviceCenters]);
  const warehouseMap = useMemo(() => warehouses.reduce<Record<string, WarehouseItem>>((acc, x) => { acc[x.id] = x; return acc; }, {}), [warehouses]);
  const [adminWarehouseSearch, setAdminWarehouseSearch] = useState<Record<string, string>>({});

  const buildDefaultForWarehouses = (warehouseIds: string[]) => {
    const firstWarehouseId = warehouseIds[0];
    if (!firstWarehouseId) return { defaultWarehouseId: '', defaultLocationId: '' };
    const firstLocationId = warehouseMap[firstWarehouseId]?.locations[0]?.id ?? '';
    return { defaultWarehouseId: firstWarehouseId, defaultLocationId: firstLocationId };
  };

  const ensureAdminDefaults = (administrator: Administrator, warehouseIds: string[]) => {
    const hasDefaultWarehouse = warehouseIds.includes(administrator.defaultWarehouseId);
    const hasDefaultLocation = warehouseMap[administrator.defaultWarehouseId]?.locations.some((location) => location.id === administrator.defaultLocationId) ?? false;
    if (hasDefaultWarehouse && hasDefaultLocation) return administrator;
    return { ...administrator, ...buildDefaultForWarehouses(warehouseIds) };
  };

  return (
    <div className="warehouse-settings-panel">
      <div className="warehouse-settings-tabs" role="tablist" aria-label="Warehouse settings sections">
        {settingsTabs.map((settingsTab) => (
          <button key={settingsTab.key} type="button" className={settingsTab.key === tab ? 'warehouse-settings-tab warehouse-settings-tab-active' : 'warehouse-settings-tab'} onClick={() => onTabChange(settingsTab.key)}>{settingsTab.label}</button>
        ))}
      </div>

      {tab === 'service-centers' ? (
        <>
          <div className="warehouse-settings-actions"><button type="button" className="orders-create-button" onClick={onCreateServiceCenter}>Створити</button></div>
          <div className="catalog-table-wrap">
            <table className="catalog-table warehouse-settings-table">
              <thead><tr><th>Назва</th><th>Колір</th><th>Адреса</th><th>Телефон</th><th>Кіл-ть складів</th></tr></thead>
              <tbody>
                {serviceCenters.map((serviceCenter) => (
                  <tr key={serviceCenter.id}>
                    <td><button type="button" className="settings-link-button" onClick={() => onEditServiceCenter(serviceCenter)}>{serviceCenter.name}</button></td>
                    <td><button type="button" className="settings-color-dot" style={{ backgroundColor: serviceCenter.color }} onClick={() => onEditServiceCenter(serviceCenter)} aria-label={`Редагувати ${serviceCenter.name}`} /></td>
                    <td><button type="button" className="settings-link-button" onClick={() => onEditServiceCenter(serviceCenter)}>{serviceCenter.address}</button></td>
                    <td><button type="button" className="settings-link-button" onClick={() => onEditServiceCenter(serviceCenter)}>{serviceCenter.phone}</button></td>
                    <td>{warehousesByServiceCenter[serviceCenter.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'warehouses' ? (
        <>
          <div className="warehouse-settings-actions"><button type="button" className="orders-create-button" onClick={onCreateWarehouse}>Створити</button></div>
          <div className="catalog-table-wrap">
            <table className="catalog-table warehouse-settings-table">
              <thead><tr><th>Id</th><th>Назва</th><th>Належність до Сервісного центру</th><th>Адреса для квитанції</th><th>Телефон для квитанції</th><th>Локації</th></tr></thead>
              <tbody>
                {warehouses.map((warehouse) => {
                  const center = serviceCenterMap[warehouse.serviceCenterId];
                  return (
                    <tr key={warehouse.id}>
                      <td>{warehouse.id.replace('w-', '')}</td>
                      <td><button type="button" className="settings-link-button" onClick={() => onEditWarehouse(warehouse)}>{warehouse.name}</button></td>
                      <td><span className="warehouse-settings-center-chip"><i style={{ color: center?.color ?? '#94a3b8' }}>●</i> {center?.name ?? '-'}</span></td>
                      <td>{warehouse.receiptAddress || '-'}</td>
                      <td>{warehouse.receiptPhone || '-'}</td>
                      <td>{warehouse.locations.length} шт.</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'administrators' ? (
        <>
          <div className="catalog-table-wrap warehouse-admin-table-wrap">
            <table className="catalog-table warehouse-settings-table warehouse-admin-table">
              <thead><tr><th>Співробітник</th><th>Вкажіть склади, до яких співробітник має доступ</th><th>Вкажіть склад та локацію, на котру за замовчуванням переміщується пристрій прийнятий на ремонт цим співробітником</th></tr></thead>
              <tbody>
                {administrators.map((administrator) => {
                  const employee = employees.find((item) => item.id === administrator.employeeId);
                  if (!employee) return null;
                  const availableLocations = administrator.warehouseIds.flatMap((warehouseId) => {
                    const warehouse = warehouseMap[warehouseId];
                    if (!warehouse) return [];
                    return warehouse.locations.map((location) => ({ warehouseId: warehouse.id, locationId: location.id, label: `${warehouse.name} ${location.name}` }));
                  });
                  const selectedWarehouseNames = administrator.warehouseIds.map((warehouseId) => warehouseMap[warehouseId]?.name).filter(Boolean);
                  const isAllSelected = administrator.warehouseIds.length > 0 && administrator.warehouseIds.length === warehouses.length;
                  const warehouseSearch = adminWarehouseSearch[administrator.employeeId] ?? '';
                  const filteredWarehouses = warehouses.filter((warehouse) => warehouse.name.toLowerCase().includes(warehouseSearch.trim().toLowerCase()));
                  const defaultValue = `${administrator.defaultWarehouseId}:${administrator.defaultLocationId}`;
                  return (
                    <tr key={administrator.employeeId}>
                      <td>{employee.name}</td>
                      <td>
                        <details className="warehouse-admin-multiselect">
                          <summary>{isAllSelected ? `Усі вибрані (${administrator.warehouseIds.length})` : selectedWarehouseNames.join(', ') || 'Оберіть склади'}</summary>
                          <div className="warehouse-admin-multiselect-menu">
                            <input
                              value={warehouseSearch}
                              onChange={(event) => setAdminWarehouseSearch((current) => ({ ...current, [administrator.employeeId]: event.target.value }))}
                              placeholder="Пошук"
                            />
                            <label className="warehouse-admin-checkline">
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(event) => {
                                  const nextWarehouseIds = event.target.checked ? warehouses.map((warehouse) => warehouse.id) : [];
                                  onAdministratorChange((current) => current.map((item) => (item.employeeId === administrator.employeeId ? ensureAdminDefaults({ ...item, warehouseIds: nextWarehouseIds }, nextWarehouseIds) : item)));
                                }}
                              />
                              <span>Обрати все</span>
                            </label>
                            <div className="warehouse-admin-options">
                              {filteredWarehouses.map((warehouse) => (
                                <label key={warehouse.id} className="warehouse-admin-checkline">
                                  <input
                                    type="checkbox"
                                    checked={administrator.warehouseIds.includes(warehouse.id)}
                                    onChange={(event) => {
                                      const nextWarehouseIds = event.target.checked
                                        ? [...administrator.warehouseIds, warehouse.id]
                                        : administrator.warehouseIds.filter((warehouseId) => warehouseId !== warehouse.id);
                                      onAdministratorChange((current) => current.map((item) => (item.employeeId === administrator.employeeId ? ensureAdminDefaults({ ...item, warehouseIds: nextWarehouseIds }, nextWarehouseIds) : item)));
                                    }}
                                  />
                                  <span>{warehouse.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </details>
                      </td>
                      <td>
                        <select className="warehouse-admin-default-select" value={defaultValue} onChange={(event) => {
                          const [defaultWarehouseId, defaultLocationId] = event.target.value.split(':');
                          onAdministratorChange((current) => current.map((item) => (item.employeeId === administrator.employeeId ? { ...item, defaultWarehouseId, defaultLocationId } : item)));
                        }}>
                          {availableLocations.length === 0 ? <option value="">Оберіть склад</option> : null}
                          {availableLocations.map((location) => <option key={`${location.warehouseId}:${location.locationId}`} value={`${location.warehouseId}:${location.locationId}`}>{location.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="secondary-button">Зберегти</button>
        </>
      ) : null}
    </div>
  );
};

const ModalShell = ({ title, children, onClose, onSubmit, submitLabel, canSubmit }: { title: string; children: ReactNode; onClose: () => void; onSubmit: () => void; submitLabel: string; canSubmit: boolean }) => (
  <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="catalog-edit-modal warehouse-settings-modal">
      <header className="catalog-edit-header"><h2>{title}</h2><button type="button" className="ghost-button" onClick={onClose}>×</button></header>
      <div className="catalog-edit-body warehouse-settings-modal-body">{children}</div>
      <footer className="catalog-edit-footer warehouse-settings-modal-footer">
        <button type="button" className="secondary-button" onClick={onClose}>Скасувати</button>
        <button type="button" className="primary-button" onClick={onSubmit} disabled={!canSubmit}>{submitLabel}</button>
      </footer>
    </div>
  </div>
);

const StockTable = ({ products, isLoading, onEdit, onDelete }: { products: Product[]; isLoading: boolean; onEdit: (product: Product) => void; onDelete: (product: Product) => void }) => {
  if (isLoading) return <p className="empty-state">Loading warehouse stock...</p>;
  if (products.length === 0) return <p className="empty-state">No stock rows found.</p>;
  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table warehouse-stock-table">
        <thead><tr><th><input type="checkbox" aria-label="Select all stock rows" /></th><th>Name</th><th>Serial #</th><th>Article</th><th>Date</th><th>Qty</th><th>Retail</th><th>Purchase</th><th>Warehouse</th><th>Location</th><th>Client order</th><th>Supplier order</th><th>Supplier</th><th>Note</th><th>Action</th></tr></thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td><input type="checkbox" aria-label={`Select ${product.name}`} /></td>
              <td className="catalog-name-cell">{product.name}</td>
              <td>{product.serialNumber}</td>
              <td>{product.article}</td>
              <td>{formatDate(product.purchaseDate)}</td>
              <td>{product.quantity} pcs</td>
              <td>{product.salePriceOptions[0] ?? product.price}</td>
              <td>{product.price}</td>
              <td>{product.purchasePlace || 'Main warehouse'}</td>
              <td>{product.freeQuantity > 0 ? 'A' : '-'}</td>
              <td>-</td>
              <td>-</td>
              <td>{product.purchasePlace || '-'}</td>
              <td>{product.note || '-'}</td>
              <td><div className="catalog-row-actions"><button type="button" className="ghost-button" onClick={() => onEdit(product)}>Edit</button><button type="button" className="danger-button" onClick={() => onDelete(product)}>×</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
