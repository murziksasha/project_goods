import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Supplier } from '../../../../entities/supplier';
import {
  CatalogServiceModal,
  CatalogSuggestionProductModal,
  ClientDeviceModal,
  SupplierModal,
} from './ProductCatalogModals';

const supplier: Supplier = {
  id: 'supplier-1abc4c51e0',
  name: 'Алексей Пульты Копейка Парусная 7',
  phone: '+380939238080',
  phones: ['+380939238080'],
  supplierOrder: '',
  note: '',
  isActive: true,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SupplierModal Add new', () => {
  it('does not clone the same phone and asks for a unique number', () => {
    const onCreate = vi.fn(async () => true);

    render(
      <SupplierModal
        supplier={supplier}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add new' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Create supplier' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('+380')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(`${supplier.name} (new)`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create' }),
    ).toBeDisabled();
  });

  it('creates a new supplier after the phone is unique', async () => {
    const onCreate = vi.fn(async () => true);
    const onClose = vi.fn();

    render(
      <SupplierModal
        supplier={supplier}
        onClose={onClose}
        onSave={vi.fn(async () => undefined)}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add new' }));
    fireEvent.change(screen.getByDisplayValue('+380'), {
      target: { value: '+380501112233' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: `${supplier.name} (new)`,
        phone: '+380501112233',
        note: '',
        isActive: true,
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ProductCatalogModals duplicate merge flow', () => {
  it('intercepts SupplierModal save on duplicate name and confirms merge', async () => {
    const existingTarget: Supplier = {
      id: 'supplier-target',
      name: 'Existing Supplier Ltd',
      phone: '+380501234567',
      phones: ['+380501234567'],
      supplierOrder: '',
      note: 'Existing target note',
      isActive: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };
    const currentSource: Supplier = {
      id: 'supplier-source',
      name: 'Typo Supplier',
      phone: '+380509876543',
      phones: ['+380509876543'],
      supplierOrder: '',
      note: 'Source note',
      isActive: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };

    const onSave = vi.fn(async () => undefined);
    const onMerge = vi.fn(async () => true);
    const onClose = vi.fn();

    render(
      <SupplierModal
        supplier={currentSource}
        suppliers={[existingTarget, currentSource]}
        onClose={onClose}
        onSave={onSave}
        onCreate={vi.fn(async () => true)}
        onMerge={onMerge}
      />,
    );

    // Edit supplier name to match existingTarget case-insensitively with whitespace
    fireEvent.change(screen.getByDisplayValue('Typo Supplier'), {
      target: { value: '  existing   supplier   ltd  ' },
    });

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // onSave should NOT have been called; confirmation modal should open
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Existing Supplier Ltd'),
    ).toBeInTheDocument();

    // Confirm merge
    fireEvent.click(
      screen.getByRole('button', { name: /confirm merge/i }),
    );

    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledWith(
        'supplier-target',
        'supplier-source',
        'Source note',
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps SupplierModal open with draft state when merge confirmation is cancelled', () => {
    const existingTarget: Supplier = {
      ...supplier,
      id: 'supplier-target',
      name: 'Target Supplier',
    };
    const currentSource: Supplier = {
      ...supplier,
      id: 'supplier-source',
      name: 'Source Supplier',
    };

    render(
      <SupplierModal
        supplier={currentSource}
        suppliers={[existingTarget, currentSource]}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        onCreate={vi.fn(async () => true)}
        onMerge={vi.fn(async () => true)}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Source Supplier'), {
      target: { value: 'Target Supplier' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).toBeInTheDocument();

    // Click Cancel on confirmation modal
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Confirmation modal closes, but editor modal remains with edited draft value
    expect(
      screen.queryByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Target Supplier'),
    ).toBeInTheDocument();
  });

  it('intercepts ClientDeviceModal save on collision with same-client device', async () => {
    const targetDevice = {
      id: 'device-target',
      clientId: 'client-123',
      clientName: 'Ivan',
      clientPhone: '+380501111111',
      name: 'iPhone 13',
      serialNumber: '',
      note: 'Target device note',
      source: 'clientCard' as const,
      isActive: true,
      canRemove: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };
    const sourceDevice = {
      ...targetDevice,
      id: 'device-source',
      name: 'iPhone 13 Pro',
      note: 'Draft typo note',
    };

    const onSave = vi.fn(async () => undefined);
    const onMerge = vi.fn(async () => true);
    const onClose = vi.fn();

    render(
      <ClientDeviceModal
        device={sourceDevice}
        clientDevices={[targetDevice, sourceDevice]}
        onClose={onClose}
        onSave={onSave}
        onRemove={vi.fn(async () => undefined)}
        onMerge={onMerge}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('iPhone 13 Pro'), {
      target: { value: 'iphone 13' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /confirm merge/i }),
    );

    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledWith(
        'device-target',
        'device-source',
        'Draft typo note',
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not intercept ClientDeviceModal if collision name belongs to another client', async () => {
    const anotherClientDevice = {
      id: 'device-other',
      clientId: 'client-999',
      clientName: 'Other Client',
      clientPhone: '+380502222222',
      name: 'iPhone 13',
      serialNumber: '',
      note: '',
      source: 'clientCard' as const,
      isActive: true,
      canRemove: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };
    const sourceDevice = {
      id: 'device-source',
      clientId: 'client-123',
      clientName: 'Ivan',
      clientPhone: '+380501111111',
      name: 'iPhone 13 Pro',
      serialNumber: '',
      note: '',
      source: 'clientCard' as const,
      isActive: true,
      canRemove: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };

    const onSave = vi.fn(async () => undefined);
    const onMerge = vi.fn(async () => true);

    render(
      <ClientDeviceModal
        device={sourceDevice}
        clientDevices={[anotherClientDevice, sourceDevice]}
        onClose={vi.fn()}
        onSave={onSave}
        onRemove={vi.fn(async () => undefined)}
        onMerge={onMerge}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('iPhone 13 Pro'), {
      target: { value: 'iPhone 13' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Normal update flow since it belongs to a different client
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onMerge).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('intercepts CatalogSuggestionProductModal save on duplicate product name', async () => {
    const targetProduct = {
      id: 'prod-target',
      name: 'Glass Screen Protector',
      note: 'Target note',
      isActive: true,
      sourceTags: [],
      lastSeenAt: '2026-07-18T00:00:00.000Z',
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };
    const sourceProduct = {
      ...targetProduct,
      id: 'prod-source',
      name: 'Glass Screen Proctector Typo',
      note: 'Source note',
    };

    const onSave = vi.fn(async () => undefined);
    const onMerge = vi.fn(async () => true);
    const onClose = vi.fn();

    render(
      <CatalogSuggestionProductModal
        product={sourceProduct}
        catalogProducts={[targetProduct, sourceProduct]}
        onClose={onClose}
        onSave={onSave}
        onRemove={vi.fn(async () => undefined)}
        onMerge={onMerge}
      />,
    );

    fireEvent.change(
      screen.getByDisplayValue('Glass Screen Proctector Typo'),
      {
        target: { value: '  glass   screen   protector ' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /confirm merge/i }),
    );

    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledWith(
        'prod-target',
        'prod-source',
        'Source note',
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('intercepts CatalogServiceModal save on duplicate service name', async () => {
    const targetService = {
      id: 'serv-target',
      name: 'Screen Replacement',
      price: 1200,
      salePriceOptions: [],
      note: 'Target service note',
      isActive: true,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };
    const sourceService = {
      ...targetService,
      id: 'serv-source',
      name: 'Screen Replacemnt Typo',
      note: 'Source service note',
    };

    const form = {
      name: 'Screen Replacement',
      price: '1200',
      salePriceOptions: '',
      note: 'Updated source note',
    };

    const onSubmit = vi.fn(async () => undefined);
    const onMerge = vi.fn(async () => true);
    const onClose = vi.fn();

    render(
      <CatalogServiceModal
        service={sourceService}
        services={[targetService, sourceService]}
        catalogNumber={1}
        form={form}
        isSaving={false}
        isEditing={true}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onClose={onClose}
        onArchive={vi.fn()}
        onActivate={vi.fn()}
        onMerge={onMerge}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', {
        name: /confirm catalog record merge/i,
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /confirm merge/i }),
    );

    await waitFor(() => {
      expect(onMerge).toHaveBeenCalledWith(
        'serv-target',
        'serv-source',
        'Updated source note',
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
