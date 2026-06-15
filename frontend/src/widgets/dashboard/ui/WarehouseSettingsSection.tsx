import { useMemo, useState } from 'react';
import type { Employee } from '../../../entities/employee/model/types';
import {
  settingsTabs,
  type Administrator,
  type ServiceCenter,
  type SettingsTab,
  type WarehouseItem,
} from '../model/warehouse-panel';

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
        aria-label='Warehouse settings sections'
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
            {settingsTab.label}
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
              Create
            </button>
          </div>
          <div className='catalog-table-wrap'>
            <table className='catalog-table warehouse-settings-table'>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>color</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Warehouses</th>
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
                        aria-label={`Edit ${serviceCenter.name}`}
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
              <span>Status</span>
              <select
                value={warehouseStatusFilter}
                onChange={(event) =>
                  setWarehouseStatusFilter(
                    event.target.value as typeof warehouseStatusFilter,
                  )
                }
              >
                <option value='all'>All</option>
                <option value='active'>Active</option>
                <option value='inactive'>Inactive</option>
              </select>
            </label>
            <button
              type='button'
              className='orders-create-button'
              onClick={onCreateWarehouse}
            >
              Create Warehouse
            </button>
          </div>
          <div className='catalog-table-wrap'>
            <table className='catalog-table warehouse-settings-table'>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Locations</th>
                  <th>Products</th>
                  <th>Action</th>
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
                          {warehouse.isActive ? 'Active' : 'Inactive'}
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
                      <td>{warehouse.locations.length} pcs</td>
                      <td>{warehouseProductCounts[warehouse.id] ?? 0}</td>
                      <td>
                        <button
                          type='button'
                          className='secondary-button'
                          onClick={() => onEditWarehouse(warehouse)}
                        >
                          Edit
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
                  <th>Administrator</th>
                  <th>
                    View Warehouses, to which the administrator has
                    access
                  </th>
                  <th>
                    View Warehouse and Location, to which the
                    administrator has access
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
                        <details className='warehouse-admin-multiselect'>
                          <summary>
                            {isAllSelected
                              ? `All (${administrator.warehouseIds.length})`
                              : selectedWarehouseNames.join(', ') ||
                                'Select Warehouses'}
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
                              placeholder='Search'
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
                              <span>Select All</span>
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
                                      Inactive
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
                            <option value=''>Select Location</option>
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
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      ) : null}
    </div>
  );
};

