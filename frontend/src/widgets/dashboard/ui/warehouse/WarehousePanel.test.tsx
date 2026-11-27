import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../entities/product';
import type { Sale, StockOrderLinksResponse } from '../../../../entities/sale';
import * as http from '../../../../shared/api/http';
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from '../../../../entities/saved-filter';
import { defaultPrintForms } from '../../../../entities/settings';
import { getWarehouseFiltersStorageKey } from '../../model/warehouse-panel';
import type { WarehousePanelProps } from '../../model/warehouse-panel';
import { printSerialNumbers } from '../orders/workspace/orders-workspace-shared';
import { WarehousePanel } from './WarehousePanel';

const postMock = vi.fn();

const stableEmptySupplierOrders: never[] = [];
const stableWarehouseSettingsData = {
  serviceCenters: [],
  warehouses: [
    {
      id: 'wh-1',
      name: 'Main',
      isActive: true,
      serviceCenterId: '',
      receiptAddress: '',
      receiptPhone: '',
      locations: [{ id: 'loc-1', name: 'Shelf A' }],
    },
    {
      id: 'wh-2',
      name: 'Reserve',
      isActive: true,
      serviceCenterId: '',
      receiptAddress: '',
      receiptPhone: '',
      locations: [{ id: 'loc-2', name: 'Shelf B' }],
    },
  ],
  administrators: [],
};

vi.mock('../../../../entities/supplier-order', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../entities/supplier-order')>();
  return {
    ...actual,
    useSupplierOrdersQuery: vi.fn(() => ({
      data: stableEmptySupplierOrders,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })),
  };
});

vi.mock('../../../../entities/warehouse-settings', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../entities/warehouse-settings')>();
  return {
    ...actual,
    useWarehouseSettingsQuery: vi.fn(() => ({
      data: stableWarehouseSettingsData,
      isLoading: false,
      error: null,
    })),
  };
});

vi.mock('../../../../entities/saved-filter', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../entities/saved-filter')>();
  return {
    ...actual,
    listSavedFilters: vi.fn(async () => []),
    createSavedFilter: vi.fn(),
    deleteSavedFilter: vi.fn(),
  };
});

vi.mock('../orders/workspace/orders-workspace-shared', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../orders/workspace/orders-workspace-shared')
    >();
  return {
    ...actual,
    printSerialNumbers: vi.fn(),
  };
});

const listSavedFiltersMock = vi.mocked(listSavedFilters);
const createSavedFilterMock = vi.mocked(createSavedFilter);
const printSerialNumbersMock = vi.mocked(printSerialNumbers);

const mockStockLinksResolved = (payload: StockOrderLinksResponse) => {
  postMock.mockResolvedValue({ data: payload });
};

const mockStockLinksResolvedOnce = (payload: StockOrderLinksResponse) => {
  postMock.mockResolvedValueOnce({ data: payload });
};

const mockStockLinksPendingOnce = (promise: Promise<StockOrderLinksResponse>) => {
  postMock.mockImplementationOnce(async () => ({ data: await promise }));
};

const makeProduct = (patch: Partial<Product>): Product => ({
  id: 'prod-1',
  name: 'Terra Inverter 3000',
  article: 'TR-3000',
  serialNumber: 'S000101',
  price: 1000,
  salePriceOptions: [],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  purchaseDate: '2026-01-01',
  warrantyPeriod: 0,
  isActive: true,
  warehouseId: 'wh-1',
  locationId: 'loc-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const makeSale = (patch: Partial<Sale>): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000100',
  saleDate: '2026-01-02T00:00:00.000Z',
  quantity: 1,
  salePrice: 1500,
  kind: 'sale',
  status: 'issued',
  paidAmount: 1500,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'new',
  },
  product: {
    id: '',
    article: '',
    name: '',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...patch,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const stableEmptyCatalog: never[] = [];
const stableEmptyEmployees: never[] = [];
const stableEmptySuppliers: never[] = [];
const stableEmptySales: Sale[] = [];
const stableNoop = vi.fn();
const stableAsyncTrue = vi.fn(async () => true);

const renderPanel = ({
  products,
  sales = stableEmptySales,
  isLoading = false,
  employeeId = 'emp-1',
  queryClient = createClient(),
  onProductsTransfer = vi.fn<NonNullable<WarehousePanelProps['onProductsTransfer']>>(
    async () => ({ moved: [], failed: [] }),
  ),
}: {
  products: Product[];
  sales?: Sale[];
  isLoading?: boolean;
  employeeId?: string;
  queryClient?: QueryClient;
  onProductsTransfer?: WarehousePanelProps['onProductsTransfer'];
}) => {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <WarehousePanel
        printForms={defaultPrintForms}
        products={products}
        sales={sales}
        catalogProducts={stableEmptyCatalog}
        employees={stableEmptyEmployees}
        canViewSupplierOrders={false}
        canManageSupplierOrders={false}
        isLoading={isLoading}
        productForm={{
          name: '',
          article: '',
          serialNumber: '',
          price: '',
          salePriceOptions: '',
          note: '',
          quantity: '1',
          purchasePlace: '',
          purchaseDate: '',
          warrantyPeriod: '0',
          isActive: true,
        }}
        isProductSaving={false}
        isProductEditing={false}
        onProductChange={stableNoop}
        onProductSubmit={stableNoop}
        onProductCancelEdit={stableNoop}
        onProductEdit={stableNoop}
        onProductDelete={stableNoop}
        onProductTransfer={stableAsyncTrue}
        onProductsTransfer={onProductsTransfer}
        suppliers={stableEmptySuppliers}
        onCreateSupplier={stableAsyncTrue}
        onUpdateSupplier={stableAsyncTrue}
        onUpdateCatalogProduct={stableAsyncTrue}
        onUpdateProductModel={stableAsyncTrue}
        currentEmployeeId={employeeId}
        currentEmployeeName='Owner'
        onSuccess={stableNoop}
        onError={stableNoop}
      />
    </QueryClientProvider>,
  );

  return { ...view, queryClient, onProductsTransfer };
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  postMock.mockReset();
  vi.spyOn(http.apiClient, 'post').mockImplementation(postMock);
  mockStockLinksResolved({ links: [] });
  listSavedFiltersMock.mockResolvedValue([]);
  vi.mocked(deleteSavedFilter).mockResolvedValue({
    id: 'f-1',
    deleted: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('WarehousePanel stock search cold hold and status chips', () => {
  it('withholds rows and totals during cold hold, keeps search editable, and avoids flashing sold units', async () => {
    const soldTerra = makeProduct({
      id: 'p-sold',
      name: 'Terra Old Sold',
      serialNumber: 'S000010',
    });
    const freeTerra = makeProduct({
      id: 'p-free',
      name: 'Terra In Stock',
      serialNumber: 'S000020',
    });

    window.localStorage.setItem(
      getWarehouseFiltersStorageKey('emp-1'),
      JSON.stringify({
        activeTab: 'stock',
        query: 'terra',
        searchMode: 'name',
        stockView: 'units',
      }),
    );

    const pendingLinks = deferred<StockOrderLinksResponse>();
    mockStockLinksPendingOnce(pendingLinks.promise);

    renderPanel({ products: [soldTerra, freeTerra] });

    // Search field has restored text and is editable immediately during cold hold
    const searchInput = screen.getByPlaceholderText('Search by product name');
    expect(searchInput).toHaveValue('terra');
    expect(searchInput).toBeEnabled();

    // Summary shows short checking line, no units/models/value totals and no rows
    expect(screen.getByText('Checking stock...')).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s+units/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Terra Old Sold')).not.toBeInTheDocument();
    expect(screen.queryByText('Terra In Stock')).not.toBeInTheDocument();

    // User can type immediately during the cold hold
    fireEvent.change(searchInput, { target: { value: 'terra in' } });
    expect(searchInput).toHaveValue('terra in');

    // Settle stock-links: sold unit stays hidden, free unit paints cleanly
    await act(async () => {
      pendingLinks.resolve({
        links: [
          {
            productId: 'p-sold',
            serialNumber: 'S000010',
            saleId: 'sale-old',
            recordNumber: 'r000055',
            kind: 'sale',
            status: 'issued',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Terra In Stock')).toBeInTheDocument();
    });
    expect(screen.queryByText('Terra Old Sold')).not.toBeInTheDocument();
    expect(screen.getByText(/1 units · 1 models/)).toBeInTheDocument();
  });

  it('falls back to loaded sales list when stock-links fails on first paint', async () => {
    const soldInLoadedSales = makeProduct({
      id: 'p-sold-loaded',
      name: 'Terra Loaded Sold',
      serialNumber: 'S000111',
    });
    const freeUnit = makeProduct({
      id: 'p-free',
      name: 'Terra Free',
      serialNumber: 'S000222',
    });

    postMock.mockRejectedValue(new Error('Network error'));

    renderPanel({
      products: [soldInLoadedSales, freeUnit],
      sales: [
        makeSale({
          id: 'sale-loaded',
          kind: 'sale',
          status: 'issued',
          product: {
            id: soldInLoadedSales.id,
            article: '',
            name: '',
            serialNumber: '',
          },
        }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Terra Free')).toBeInTheDocument();
    });
    expect(screen.queryByText('Terra Loaded Sold')).not.toBeInTheDocument();
  });

  it('keeps the last proven frame on refetch and holds unverified units until settled', async () => {
    const p1 = makeProduct({
      id: 'p-1',
      name: 'Alpha Unit',
      serialNumber: 'S000001',
    });
    const p2SoldNew = makeProduct({
      id: 'p-2',
      name: 'Beta Sold Unit',
      serialNumber: 'S000002',
    });

    window.localStorage.setItem(
      getWarehouseFiltersStorageKey('emp-1'),
      JSON.stringify({ activeTab: 'stock', stockView: 'units' }),
    );

    mockStockLinksResolvedOnce({ links: [] });
    const queryClient = createClient();
    const view = renderPanel({
      products: [p1],
      queryClient,
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
    });

    const refetchLinks = deferred<StockOrderLinksResponse>();
    mockStockLinksPendingOnce(refetchLinks.promise);

    // Rerender with a new unit p2 while stock-links for [p1, p2] is pending
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WarehousePanel
          printForms={defaultPrintForms}
          products={[p1, p2SoldNew]}
          sales={[]}
          catalogProducts={[]}
          employees={[]}
          canViewSupplierOrders={false}
          canManageSupplierOrders={false}
          isLoading={false}
          productForm={{
            name: '',
            article: '',
            serialNumber: '',
            price: '',
            salePriceOptions: '',
            note: '',
            quantity: '1',
            purchasePlace: '',
            purchaseDate: '',
            warrantyPeriod: '0',
            isActive: true,
          }}
          isProductSaving={false}
          isProductEditing={false}
          onProductChange={vi.fn()}
          onProductSubmit={vi.fn()}
          onProductCancelEdit={vi.fn()}
          onProductEdit={vi.fn()}
          onProductDelete={vi.fn()}
          onProductTransfer={vi.fn(async () => true)}
          onProductsTransfer={vi.fn(async () => ({ moved: [], failed: [] }))}
          suppliers={[]}
          onCreateSupplier={vi.fn(async () => true)}
          onUpdateSupplier={vi.fn(async () => true)}
          onUpdateCatalogProduct={vi.fn(async () => true)}
          onUpdateProductModel={vi.fn(async () => true)}
          currentEmployeeId='emp-1'
          currentEmployeeName='Owner'
          onSuccess={vi.fn()}
          onError={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Proven frame (Alpha Unit) stays, unverified p2 stays out
    expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
    expect(screen.queryByText('Beta Sold Unit')).not.toBeInTheDocument();

    // Typing does not trigger extra stock-links requests
    const callsBeforeTyping = postMock.mock.calls.length;
    fireEvent.change(screen.getByPlaceholderText('Search by serial number'), {
      target: { value: 'S000' },
    });
    expect(postMock).toHaveBeenCalledTimes(callsBeforeTyping);

    await act(async () => {
      refetchLinks.resolve({
        links: [
          {
            productId: p2SoldNew.id,
            serialNumber: p2SoldNew.serialNumber,
            saleId: 'sale-old-2',
            recordNumber: 'r000222',
            kind: 'sale',
            status: 'issued',
          },
        ],
      });
    });

    expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
    expect(screen.queryByText('Beta Sold Unit')).not.toBeInTheDocument();
  });

  it('keeps the last proven frame and holds unverified units when a refetch fails', async () => {
    const p1 = makeProduct({
      id: 'p-1',
      name: 'Alpha Unit',
      serialNumber: 'S000001',
    });
    const p2SoldNew = makeProduct({
      id: 'p-2',
      name: 'Beta Sold Unit',
      serialNumber: 'S000002',
    });

    window.localStorage.setItem(
      getWarehouseFiltersStorageKey('emp-1'),
      JSON.stringify({ activeTab: 'stock', stockView: 'units' }),
    );

    mockStockLinksResolvedOnce({ links: [] });
    const queryClient = createClient();
    const view = renderPanel({
      products: [p1],
      queryClient,
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
    });

    postMock.mockRejectedValueOnce(new Error('Refetch failed'));

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WarehousePanel
          printForms={defaultPrintForms}
          products={[p1, p2SoldNew]}
          sales={stableEmptySales}
          catalogProducts={stableEmptyCatalog}
          employees={stableEmptyEmployees}
          canViewSupplierOrders={false}
          canManageSupplierOrders={false}
          isLoading={false}
          productForm={{
            name: '',
            article: '',
            serialNumber: '',
            price: '',
            salePriceOptions: '',
            note: '',
            quantity: '1',
            purchasePlace: '',
            purchaseDate: '',
            warrantyPeriod: '0',
            isActive: true,
          }}
          isProductSaving={false}
          isProductEditing={false}
          onProductChange={stableNoop}
          onProductSubmit={stableNoop}
          onProductCancelEdit={stableNoop}
          onProductEdit={stableNoop}
          onProductDelete={stableNoop}
          onProductTransfer={stableAsyncTrue}
          onProductsTransfer={vi.fn(async () => ({ moved: [], failed: [] }))}
          suppliers={stableEmptySuppliers}
          onCreateSupplier={stableAsyncTrue}
          onUpdateSupplier={stableAsyncTrue}
          onUpdateCatalogProduct={stableAsyncTrue}
          onUpdateProductModel={stableAsyncTrue}
          currentEmployeeId='emp-1'
          currentEmployeeName='Owner'
          onSuccess={stableNoop}
          onError={stableNoop}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
    expect(screen.queryByText('Beta Sold Unit')).not.toBeInTheDocument();
  });

  it('toggles chips, filter panel checkboxes, Clear, and persists per employee and presets', async () => {
    const pFree = makeProduct({
      id: 'p-free',
      name: 'Free Terra',
      serialNumber: 'S000001',
    });
    const pSold = makeProduct({
      id: 'p-sold',
      name: 'Sold Terra',
      serialNumber: 'S000002',
    });
    const pRejected = makeProduct({
      id: 'p-rej',
      name: 'Rejected Terra',
      serialNumber: 'S000003',
    });

    window.localStorage.setItem(
      getWarehouseFiltersStorageKey('emp-1'),
      JSON.stringify({ activeTab: 'stock', stockView: 'units' }),
    );

    mockStockLinksResolved({
      links: [
        {
          productId: pSold.id,
          serialNumber: pSold.serialNumber,
          saleId: 'sale-sold',
          recordNumber: 'r000300',
          kind: 'sale',
          status: 'issued',
        },
        {
          productId: pRejected.id,
          serialNumber: pRejected.serialNumber,
          saleId: 'repair-rej',
          recordNumber: 'r000301',
          kind: 'repair',
          status: 'clientRejected',
        },
      ],
    });
    listSavedFiltersMock.mockResolvedValue([
      {
        id: 'legacy-preset',
        employeeId: 'emp-1',
        scope: 'warehouse',
        tab: 'stock',
        name: 'Legacy Preset',
        icon: '*',
        filters: {
          name: '',
          serial: '',
          article: '',
          warehouse: '',
          supplier: '',
          buyer: '',
          location: '',
          statuses: [],
          favoritesOnly: false,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    renderPanel({ products: [pFree, pSold, pRejected] });

    await waitFor(() => {
      expect(screen.getByText('Free Terra')).toBeInTheDocument();
    });
    expect(screen.queryByText('Sold Terra')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejected Terra')).not.toBeInTheDocument();

    const chipsBar = () =>
      document.querySelector('.warehouse-status-chips') as HTMLElement;

    // Filter badge is quiet for Free + In order
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();

    // Turn on Sold chip -> immediately shows Sold Terra and counts in Filter badge
    fireEvent.click(within(chipsBar()).getByRole('button', { name: 'Sold' }));
    expect(screen.getByText('Sold Terra')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Filter (1)' }),
    ).toBeInTheDocument();

    // Opening Purchase by serial from Stock balances with Sold active shows Sold Terra serial
    fireEvent.click(screen.getByText('Sold Terra'));
    expect(screen.getByText('Purchase by serial')).toBeInTheDocument();
    expect(screen.getAllByText('S000002').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Reload persistence: stored per employee
    const stored = JSON.parse(
      window.localStorage.getItem(getWarehouseFiltersStorageKey('emp-1')) ??
        '{}',
    );
    expect(stored.stockStatuses).toEqual(['free', 'in_order', 'sold']);

    // Click All once -> shows Rejected Terra too; second click -> empty table
    fireEvent.click(within(chipsBar()).getByRole('button', { name: 'All' }));
    expect(screen.getByText('Rejected Terra')).toBeInTheDocument();

    fireEvent.click(within(chipsBar()).getByRole('button', { name: 'All' }));
    expect(screen.queryByText('Free Terra')).not.toBeInTheDocument();
    expect(screen.queryByText('Sold Terra')).not.toBeInTheDocument();
    expect(screen.getByText('No stock rows found.')).toBeInTheDocument();

    // Open Filter panel -> chips hide; status checkboxes apply immediately
    fireEvent.click(screen.getByRole('button', { name: 'Filter (1)' }));
    expect(document.querySelector('.warehouse-status-chips')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    const menu = document.querySelector('.orders-filter-status-menu')!;
    fireEvent.click(within(menu as HTMLElement).getByLabelText('Sold'));
    expect(screen.getByText('Sold Terra')).toBeInTheDocument();

    // Clear returns Free and In order and quiets Filter badge
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Free Terra')).toBeInTheDocument();
    expect(screen.queryByText('Sold Terra')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();

    // Turn Sold back on, then apply legacy preset (without stockStatuses) -> resets live set to Free + In order
    fireEvent.click(within(menu as HTMLElement).getByLabelText('Sold'));
    expect(screen.getByText('Sold Terra')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '* Legacy Preset' }));
    expect(screen.queryByText('Sold Terra')).not.toBeInTheDocument();
    expect(screen.getByText('Free Terra')).toBeInTheDocument();

    // Save preset stores stockStatuses
    createSavedFilterMock.mockResolvedValue({
      id: 'new-preset',
      employeeId: 'emp-1',
      scope: 'warehouse',
      tab: 'stock',
      name: 'With Sold',
      icon: '*',
      filters: { stockStatuses: ['free', 'in_order', 'sold'] },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    fireEvent.click(within(chipsBar()).getByRole('button', { name: 'Sold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    fireEvent.change(screen.getByPlaceholderText('My filter'), {
      target: { value: 'With Sold' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(createSavedFilterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'warehouse',
          filters: expect.objectContaining({
            stockStatuses: ['free', 'in_order', 'sold'],
          }),
        }),
      );
    });
  });

  it('keeps Transfers on the on-hand set, withholds Transfers on cold hold, and keeps sold checks printable only', async () => {
    const pFree = makeProduct({
      id: 'p-free',
      name: 'Terra Shared',
      serialNumber: 'S000001',
    });
    const pSold = makeProduct({
      id: 'p-sold',
      name: 'Terra Shared',
      serialNumber: 'S000002',
    });

    window.localStorage.setItem(
      getWarehouseFiltersStorageKey('emp-1'),
      JSON.stringify({
        activeTab: 'transfers',
        stockStatuses: ['sold'],
      }),
    );

    const pendingLinks = deferred<StockOrderLinksResponse>();
    mockStockLinksPendingOnce(pendingLinks.promise);

    renderPanel({ products: [pFree, pSold] });

    // Cold hold on Transfers withholds rows and movable summary
    expect(screen.getByText('Checking stock...')).toBeInTheDocument();
    expect(screen.queryByText(/movable rows/i)).not.toBeInTheDocument();
    expect(screen.queryByText('S000001')).not.toBeInTheDocument();

    await act(async () => {
      pendingLinks.resolve({
        links: [
          {
            productId: pSold.id,
            serialNumber: pSold.serialNumber,
            saleId: 'sale-sold',
            recordNumber: 'r000400',
            kind: 'sale',
            status: 'issued',
          },
        ],
      });
    });

    // Transfers shows only on-hand set (ignores stored Sold chip)
    await waitFor(() => {
      expect(screen.getByText('1 movable rows')).toBeInTheDocument();
    });
    expect(screen.getByText('S000001')).toBeInTheDocument();
    expect(screen.queryByText('S000002')).not.toBeInTheDocument();

    // Switch to Stock balances, check sold row, print serial, switch chips -> check survives, sold row never enters transfer
    fireEvent.click(screen.getByRole('button', { name: 'Stock balances' }));
    await waitFor(() => {
      expect(screen.getByText('S000002')).toBeInTheDocument();
    });

    // Check S000002 (sold) and S000001 (free)
    fireEvent.click(screen.getByLabelText('Select Terra Shared'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Print selected serial numbers' }),
    );
    expect(printSerialNumbersMock).toHaveBeenCalledWith(
      [
        {
          name: 'Terra Shared',
          article: 'TR-3000',
          serialNumber: 'S000002',
        },
      ],
      defaultPrintForms,
      expect.any(String),
    );

    // Chip toggle preserves checks: turn Free on while Sold stays on -> 2-unit group
    fireEvent.click(screen.getByRole('button', { name: 'Free' }));
    expect(screen.getByRole('button', { name: '1 selected' })).toBeInTheDocument();

    // Expand group and check both units
    fireEvent.click(
      screen.getByRole('button', { name: 'Show serials for Terra Shared' }),
    );
    fireEvent.click(screen.getByLabelText('Select all units of Terra Shared'));
    expect(
      document.querySelector('.warehouse-selection-clear-button'),
    ).toHaveTextContent('2 selected');

    // Group Transfer only enters the movable free unit (S000001), never S000002
    const kebabs = screen.getAllByRole('button', { name: 'More actions' });
    fireEvent.click(kebabs[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }));

    await waitFor(() => {
      expect(screen.getByText('Batch stock to move')).toBeInTheDocument();
    });
    expect(screen.getByText('S000001')).toBeInTheDocument();
    expect(screen.queryByText('S000002')).not.toBeInTheDocument();
  });
});
