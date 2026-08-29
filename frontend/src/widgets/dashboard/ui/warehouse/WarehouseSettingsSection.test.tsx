import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '../../../../entities/employee/model/types';
import type {
  Administrator,
  ServiceCenter,
  WarehouseItem,
} from '../../model/warehouse-panel';
import { WarehouseSettings } from './WarehouseSettingsSection';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const serviceCenter: ServiceCenter = {
  id: 'sc-1',
  name: 'Kyiv Center',
  color: '#118fd0',
  address: 'Khreshchatyk 1',
  phone: '+380111',
};

const warehouses: WarehouseItem[] = [
  {
    id: 'w-1',
    name: 'Main',
    isActive: true,
    serviceCenterId: 'sc-1',
    receiptAddress: 'Street 1',
    receiptPhone: '+380222',
    locations: [{ id: 'l-1', name: 'A1' }],
  },
  {
    id: 'w-2',
    name: 'Archive',
    isActive: false,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-2', name: 'Bin' }],
  },
];

const employee: Employee = {
  id: 'e-1',
  name: 'Owner',
  phone: '',
  email: '',
  username: 'owner',
  role: 'owner',
  permissions: [],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const administrators: Administrator[] = [
  {
    employeeId: 'e-1',
    warehouseIds: ['w-1'],
    defaultWarehouseId: 'w-1',
    defaultLocationId: 'l-1',
  },
];

const renderSettings = (
  overrides?: Partial<Parameters<typeof WarehouseSettings>[0]>,
) => {
  const onTabChange = vi.fn();
  const onCreateServiceCenter = vi.fn();
  const onSaveAdministrators = vi.fn();
  render(
    <WarehouseSettings
      tab={overrides?.tab ?? 'service-centers'}
      onTabChange={onTabChange}
      employees={overrides?.employees ?? [employee]}
      serviceCenters={overrides?.serviceCenters ?? [serviceCenter]}
      warehouses={overrides?.warehouses ?? warehouses}
      administrators={overrides?.administrators ?? administrators}
      warehousesByServiceCenter={
        overrides?.warehousesByServiceCenter ?? { 'sc-1': 2 }
      }
      activeWarehousesByServiceCenter={
        overrides?.activeWarehousesByServiceCenter ?? { 'sc-1': 1 }
      }
      warehouseProductCounts={overrides?.warehouseProductCounts ?? { 'w-1': 4 }}
      onCreateServiceCenter={onCreateServiceCenter}
      onEditServiceCenter={overrides?.onEditServiceCenter ?? vi.fn()}
      onCreateWarehouse={overrides?.onCreateWarehouse ?? vi.fn()}
      onEditWarehouse={overrides?.onEditWarehouse ?? vi.fn()}
      onAdministratorChange={overrides?.onAdministratorChange ?? vi.fn()}
      onSaveAdministrators={onSaveAdministrators}
      isSaving={overrides?.isSaving ?? false}
    />,
  );
  return { onTabChange, onCreateServiceCenter, onSaveAdministrators };
};

describe('WarehouseSettings', () => {
  it('shows empty service-center copy and create action', () => {
    const { onCreateServiceCenter } = renderSettings({ serviceCenters: [] });
    expect(screen.getByText('No service centers yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreateServiceCenter).toHaveBeenCalledTimes(1);
  });

  it('switches settings tabs', () => {
    const { onTabChange } = renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Warehouses' }));
    expect(onTabChange).toHaveBeenCalledWith('warehouses');
  });

  it('filters warehouses by status', () => {
    renderSettings({ tab: 'warehouses' });
    expect(screen.getByText('Main')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('All'), {
      target: { value: 'active' },
    });
    expect(screen.getByText('Main')).toBeTruthy();
    expect(screen.queryByText('Archive')).toBeNull();
  });

  it('adds data-labels and saves administrators', () => {
    const { onSaveAdministrators } = renderSettings({ tab: 'administrators' });
    expect(
      document.querySelector('td[data-label="Administrator"]'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSaveAdministrators).toHaveBeenCalledTimes(1);
  });
});
