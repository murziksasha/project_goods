import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Employee } from '../../../../entities/employee/model/types';
import {
  settingsTabs,
  type Administrator,
  type ServiceCenter,
  type SettingsTab,
  type WarehouseItem,
} from '../../model/warehouse-panel';

const settingsTabLabelKeys: Record<SettingsTab, string> = {
  'service-centers': 'warehouse.settings.tabs.serviceCenters',
  warehouses: 'warehouse.settings.tabs.warehouses',
  administrators: 'warehouse.settings.tabs.administrators',
};

export const WarehouseSettings = ({
  tab,
  onTabChange,
  employees,
  serviceCenters,
  warehouses,
  administrators,
  warehousesByServiceCenter,
  activeWarehousesByServiceCenter,
  warehouseProductCounts,
  onCreateServiceCenter,
  onEditServiceCenter,
  onCreateWarehouse,
  onEditWarehouse,
  onAdministratorChange,
  onSaveAdministrators,
  isSaving,
}: {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  employees: Employee[];
  serviceCenters: ServiceCenter[];
  warehouses: WarehouseItem[];
  administrators: Administrator[];
  warehousesByServiceCenter: Record<string, number>;
  activeWarehousesByServiceCenter: Record<string, number>;
  warehouseProductCounts: Record<string, number>;
  onCreateServiceCenter: () => void;
  onEditServiceCenter: (serviceCenter: ServiceCenter) => void;
  onCreateWarehouse: () => void;
  onEditWarehouse: (warehouse: WarehouseItem) => void;
  onAdministratorChange: (
    updater:
      | Administrator[]
      | ((current: Administrator[]) => Administrator[]),
  ) => void;
  onSaveAdministrators: () => void;
  isSaving: boolean;
}) => {
  const { t } = useTranslation();
  const serviceCenterMap = useMemo(
    () =>
      serviceCenters.reduce<Record<string, ServiceCenter>>(
        (acc, x) => {
          acc[x.id] = x;
          return acc;
        },
        {},
      ),
    [serviceCenters],
  );
  const warehouseMap = useMemo(
    () =>
      warehouses.reduce<Record<string, WarehouseItem>>((acc, x) => {
        acc[x.id] = x;
        return acc;
      }, {}),
    [warehouses],
  );
  const [adminWarehouseSearch, setAdminWarehouseSearch] = useState<
    Record<string, string>
  >({});
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const warehouseMultiselectRefs = useRef<Map<string, HTMLDetailsElement>>(
    new Map(),
  );

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      warehouseMultiselectRefs.current.forEach((detailsEl) => {
        if (detailsEl.open && !detailsEl.contains(event.target as Node)) {
          detailsEl.open = false;
        }
      });
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive),
    [warehouses],
  );
  const visibleWarehouses = useMemo(
    () =>
      warehouses.filter((warehouse) =>
        warehouseStatusFilter === 'all'
          ? true
          : warehouseStatusFilter === 'active'
            ? warehouse.isActive
            : !warehouse.isActive,
      ),
    [warehouseStatusFilter, warehouses],
  );

  const buildDefaultForWarehouses = (warehouseIds: string[]) => {
    const activeWarehouseIds = warehouseIds.filter(
      (warehouseId) => warehouseMap[warehouseId]?.isActive,
    );
    const firstWarehouseId = activeWarehouseIds[0];
    if (!firstWarehouseId)
      return { defaultWarehouseId: '', defaultLocationId: '' };
    const firstLocationId =
      warehouseMap[firstWarehouseId]?.locations[0]?.id ?? '';
    return {
      defaultWarehouseId: firstWarehouseId,
      defaultLocationId: firstLocationId,
    };
  };

  const ensureAdminDefaults = (
    administrator: Administrator,
    warehouseIds: string[],
  ) => {
    const activeWarehouseIds = warehouseIds.filter(
      (warehouseId) => warehouseMap[warehouseId]?.isActive,
    );
    const hasDefaultWarehouse = warehouseIds.includes(
      administrator.defaultWarehouseId,
    ) && warehouseMap[administrator.defaultWarehouseId]?.isActive;
    const hasDefaultLocation =
      warehouseMap[administrator.defaultWarehouseId]?.locations.some(
        (location) => location.id === administrator.defaultLocationId,
      ) ?? false;
    if (hasDefaultWarehouse && hasDefaultLocation)
      return administrator;
    return {
      ...administrator,
      ...buildDefaultForWarehouses(activeWarehouseIds),
    };
  };

  return (
    <div className='warehouse-settings-panel'>
      <div
        className='warehouse-settings-tabs'
        role='tablist'
        aria-label={t('warehouse.settings.tabsAriaLabel')}
      >
        {settingsTabs.map((settingsTab) => (
          <button
            key={settingsTab.key}
            type='button'
            className={
              settingsTab.key === tab
                ? 'warehouse-settings-tab warehouse-settings-tab-active'
                : 'warehouse-settings-tab'
            }
            onClick={() => onTabChange(settingsTab.key)}
          >
            {t(settingsTabLabelKeys[settingsTab.key])}
          </button>
        ))}
      </div>

      {tab === 'service-centers' ? (
        <>
          <div className='warehouse-settings-actions'>
            <button
              type='button'
              className='orders-create-button'
              onClick={onCreateServiceCenter}
            >
              {t('warehouse.settings.serviceCenters.create')}
            </button>
          </div>
          <div className='catalog-table-wrap'>
            <table className='catalog-table warehouse-settings-table'>
              <thead>
                <tr>
                  <th>
                    {t('warehouse.settings.serviceCenters.columns.name')}
                  </th>
                  <th>
                    {t('warehouse.settings.serviceCenters.columns.color')}
                  </th>
                  <th>
                    {t('warehouse.settings.serviceCenters.columns.address')}
                  </th>
                  <th>
                    {t('warehouse.settings.serviceCenters.columns.phone')}
                  </th>
                  <th>
                    {t('warehouse.settings.serviceCenters.columns.warehouses')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {serviceCenters.map((serviceCenter) => (
                  <tr key={serviceCenter.id}>
                    <td>
                      <button
                        type='button'
                        className='settings-link-button'
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                      >
                        {serviceCenter.name}
                      </button>
                    </td>
                    <td>
                      <button
                        type='button'
                        className='settings-color-dot'
                        style={{
                          backgroundColor: serviceCenter.color,
                        }}
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                        aria-label={t(
                          'warehouse.settings.serviceCenters.editAriaLabel',
                          { name: serviceCenter.name },
                        )}
                      />
                    </td>
                    <td>
                      <button
                        type='button'
                        className='settings-link-button'
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                      >
                        {serviceCenter.address}
                      </button>
                    </td>
                    <td>
                      <button
                        type='button'
                        className='settings-link-button'
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                      >
                        {serviceCenter.phone}
                      </button>
                    </td>
                    <td>
                      {activeWarehousesByServiceCenter[serviceCenter.id] ??
                        0}
                      {' / '}
                      {warehousesByServiceCenter[serviceCenter.id] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'warehouses' ? (
        <>
          <div className='warehouse-settings-actions'>
            <label className='warehouse-settings-filter'>
              <span>{t('warehouse.settings.warehouses.statusFilter')}</span>
              <select
                value={warehouseStatusFilter}
                onChange={(event) =>
                  setWarehouseStatusFilter(
                    event.target.value as typeof warehouseStatusFilter,
                  )
                }
              >
                <option value='all'>{t('warehouse.common.all')}</option>
                <option value='active'>{t('warehouse.common.active')}</option>
                <option value='inactive'>
                  {t('warehouse.common.inactive')}
                </option>
              </select>
            </label>
            <button
              type='button'
              className='orders-create-button'
              onClick={onCreateWarehouse}
            >
              {t('warehouse.settings.warehouses.createWarehouse')}
            </button>
          </div>
          <div className='catalog-table-wrap'>
            <table className='catalog-table warehouse-settings-table'>
              <thead>
                <tr>
                  <th>{t('warehouse.settings.warehouses.columns.id')}</th>
                  <th>{t('warehouse.settings.warehouses.columns.name')}</th>
                  <th>{t('warehouse.settings.warehouses.columns.status')}</th>
                  <th>
                    {t('warehouse.settings.warehouses.columns.location')}
                  </th>
                  <th>{t('warehouse.settings.warehouses.columns.address')}</th>
                  <th>{t('warehouse.settings.warehouses.columns.phone')}</th>
                  <th>
                    {t('warehouse.settings.warehouses.columns.locations')}
                  </th>
                  <th>
                    {t('warehouse.settings.warehouses.columns.products')}
                  </th>
                  <th>{t('warehouse.settings.warehouses.columns.action')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleWarehouses.map((warehouse) => {
                  const center =
                    serviceCenterMap[warehouse.serviceCenterId];
                  return (
                    <tr key={warehouse.id}>
                      <td>{warehouse.id.replace('w-', '')}</td>
                      <td>
                        <button
                          type='button'
                          className='settings-link-button'
                          onClick={() => onEditWarehouse(warehouse)}
                        >
                          {warehouse.name}
                        </button>
                      </td>
                      <td>
                        <span
                          className={
                            warehouse.isActive
                              ? 'receipt-status receipt-status-received'
                              : 'receipt-status receipt-status-cancelled'
                          }
                        >
                          {warehouse.isActive
                            ? t('warehouse.common.active')
                            : t('warehouse.common.inactive')}
                        </span>
                      </td>
                      <td>
                        <span className='warehouse-settings-center-chip'>
                          <i
                            style={{
                              color: center?.color ?? '#94a3b8',
                            }}
                          >
                            &bull;
                          </i>{' '}
                          {center?.name ?? '-'}
                        </span>
                      </td>
                      <td>{warehouse.receiptAddress || '-'}</td>
                      <td>{warehouse.receiptPhone || '-'}</td>
                      <td>
                        {t('warehouse.common.pcs', {
                          count: warehouse.locations.length,
                        })}
                      </td>
                      <td>{warehouseProductCounts[warehouse.id] ?? 0}</td>
                      <td>
                        <button
                          type='button'
                          className='secondary-button'
                          onClick={() => onEditWarehouse(warehouse)}
                        >
                          {t('warehouse.common.edit')}
                        </button>
                      </td>
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
          <div className='catalog-table-wrap warehouse-admin-table-wrap'>
            <table className='catalog-table warehouse-settings-table warehouse-admin-table'>
              <thead>
                <tr>
                  <th>{t('warehouse.settings.administrators.administrator')}</th>
                  <th>
                    {t('warehouse.settings.administrators.viewWarehouses')}
                  </th>
                  <th>
                    {t('warehouse.settings.administrators.viewDefaultLocation')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {administrators.map((administrator) => {
                  const employee = employees.find(
                    (item) => item.id === administrator.employeeId,
                  );
                  if (!employee) return null;
                  const availableLocations =
                    administrator.warehouseIds.flatMap(
                      (warehouseId) => {
                        const warehouse = warehouseMap[warehouseId];
                        if (!warehouse) return [];
                        return warehouse.locations.map(
                          (location) => ({
                            warehouseId: warehouse.id,
                            warehouseIsActive: warehouse.isActive,
                            locationId: location.id,
                            label: `${warehouse.name} ${location.name}`,
                          }),
                        );
                      },
                    ).filter((location) => location.warehouseIsActive);
                  const selectedWarehouseNames =
                    administrator.warehouseIds
                      .map(
                        (warehouseId) =>
                          warehouseMap[warehouseId]?.name,
                      )
                      .filter(Boolean);
                  const isAllSelected =
                    activeWarehouses.length > 0 &&
                    activeWarehouses.every((warehouse) =>
                      administrator.warehouseIds.includes(warehouse.id),
                    );
                  const warehouseSearch =
                    adminWarehouseSearch[administrator.employeeId] ??
                    '';
                  const filteredWarehouses = warehouses.filter(
                    (warehouse) =>
                      warehouse.name
                        .toLowerCase()
                        .includes(
                          warehouseSearch.trim().toLowerCase(),
                        ),
                  );
                  const defaultValue = `${administrator.defaultWarehouseId}:${administrator.defaultLocationId}`;
                  return (
                    <tr key={administrator.employeeId}>
                      <td>{employee.name}</td>
                      <td>
                        <details
                          className='warehouse-admin-multiselect'
                          ref={(element) => {
                            if (element) {
                              warehouseMultiselectRefs.current.set(
                                administrator.employeeId,
                                element,
                              );
                            } else {
                              warehouseMultiselectRefs.current.delete(
                                administrator.employeeId,
                              );
                            }
                          }}
                        >
                          <summary>
                            {isAllSelected
                              ? t(
                                  'warehouse.settings.administrators.allSelected',
                                  {
                                    count: administrator.warehouseIds.length,
                                  },
                                )
                              : selectedWarehouseNames.join(', ') ||
                                t(
                                  'warehouse.settings.administrators.selectWarehouses',
                                )}
                          </summary>
                          <div className='warehouse-admin-multiselect-menu'>
                            <input
                              value={warehouseSearch}
                              onChange={(event) =>
                                setAdminWarehouseSearch(
                                  (current) => ({
                                    ...current,
                                    [administrator.employeeId]:
                                      event.target.value,
                                  }),
                                )
                              }
                              placeholder={t(
                                'warehouse.settings.administrators.searchPlaceholder',
                              )}
                            />
                            <label className='warehouse-admin-checkline'>
                              <input
                                type='checkbox'
                                checked={isAllSelected}
                                onChange={(event) => {
                                  const nextWarehouseIds = event
                                    .target.checked
                                    ? activeWarehouses.map(
                                        (warehouse) => warehouse.id,
                                      )
                                    : [];
                                  onAdministratorChange((current) =>
                                    current.map((item) =>
                                      item.employeeId ===
                                      administrator.employeeId
                                        ? ensureAdminDefaults(
                                            {
                                              ...item,
                                              warehouseIds:
                                                nextWarehouseIds,
                                            },
                                            nextWarehouseIds,
                                          )
                                        : item,
                                    ),
                                  );
                                }}
                              />
                              <span>
                                {t(
                                  'warehouse.settings.administrators.selectAll',
                                )}
                              </span>
                            </label>
                            <div className='warehouse-admin-options'>
                              {filteredWarehouses.map((warehouse) => (
                                <label
                                  key={warehouse.id}
                                  className='warehouse-admin-checkline'
                                >
                                  <input
                                    type='checkbox'
                                    checked={administrator.warehouseIds.includes(
                                      warehouse.id,
                                    )}
                                    onChange={(event) => {
                                      const nextWarehouseIds = event
                                        .target.checked
                                        ? [
                                            ...administrator.warehouseIds,
                                            warehouse.id,
                                          ]
                                        : administrator.warehouseIds.filter(
                                            (warehouseId) =>
                                              warehouseId !==
                                              warehouse.id,
                                          );
                                      onAdministratorChange(
                                        (current) =>
                                          current.map((item) =>
                                            item.employeeId ===
                                            administrator.employeeId
                                              ? ensureAdminDefaults(
                                                  {
                                                    ...item,
                                                    warehouseIds:
                                                      nextWarehouseIds,
                                                  },
                                                  nextWarehouseIds,
                                                )
                                              : item,
                                          ),
                                      );
                                    }}
                                  />
                                  <span>{warehouse.name}</span>
                                  {!warehouse.isActive ? (
                                    <span className='catalog-inactive-badge'>
                                      {t('warehouse.common.inactive')}
                                    </span>
                                  ) : null}
                                </label>
                              ))}
                            </div>
                          </div>
                        </details>
                      </td>
                      <td>
                        <select
                          className='warehouse-admin-default-select'
                          value={defaultValue}
                          onChange={(event) => {
                            const [
                              defaultWarehouseId,
                              defaultLocationId,
                            ] = event.target.value.split(':');
                            onAdministratorChange((current) =>
                              current.map((item) =>
                                item.employeeId ===
                                administrator.employeeId
                                  ? {
                                      ...item,
                                      defaultWarehouseId,
                                      defaultLocationId,
                                    }
                                  : item,
                              ),
                            );
                          }}
                        >
                          {availableLocations.length === 0 ? (
                            <option value=''>
                              {t(
                                'warehouse.settings.administrators.selectLocation',
                              )}
                            </option>
                          ) : null}
                          {availableLocations.map((location) => (
                            <option
                              key={`${location.warehouseId}:${location.locationId}`}
                              value={`${location.warehouseId}:${location.locationId}`}
                            >
                              {location.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type='button'
            className='secondary-button'
            onClick={onSaveAdministrators}
            disabled={isSaving}
          >
            {isSaving
              ? t('warehouse.common.saving')
              : t('warehouse.common.saveChanges')}
          </button>
        </>
      ) : null}
    </div>
  );
};