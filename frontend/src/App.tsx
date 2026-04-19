import { useDeferredValue, useEffect, useState } from 'react';
import {
  createClient,
  createProduct,
  createSale,
  deleteClient,
  deleteProduct,
  deleteSale,
  exportProducts,
  getClientHistory,
  getClients,
  getProducts,
  getSales,
  seedDemoData,
  updateClient,
  updateProduct,
  updateSale,
} from './api';
import './App.css';
import { ClientForm } from './components/ClientForm';
import { ClientHistoryPanel } from './components/ClientHistoryPanel';
import { ClientList } from './components/ClientList';
import { ProductForm } from './components/ProductForm';
import { ProductList } from './components/ProductList';
import { SaleForm } from './components/SaleForm';
import { SalesList } from './components/SalesList';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientStatus,
  Product,
  ProductFormValues,
  Sale,
  SaleFormValues,
} from './types';

const initialProductForm: ProductFormValues = {
  name: '',
  article: '',
  serialNumber: '',
  price: '',
  salePriceOptions: '',
  quantity: '',
  note: '',
  purchasePlace: '',
  purchaseDate: '',
  warrantyPeriod: '',
};

const initialClientForm: ClientFormValues = {
  phone: '',
  name: '',
  note: '',
  status: 'new',
};

const initialSaleForm: SaleFormValues = {
  saleDate: new Date().toISOString().slice(0, 10),
  clientId: '',
  productId: '',
  quantity: '1',
  salePrice: '',
  note: '',
};

const clientStatusFilters: Array<ClientStatus | 'all'> = [
  'all',
  'new',
  'ok',
  'vip',
  'opt',
  'blacklist',
];

const toProductForm = (product: Product): ProductFormValues => ({
  name: product.name,
  article: product.article,
  serialNumber: product.serialNumber,
  price: String(product.price),
  salePriceOptions: product.salePriceOptions.join(', '),
  quantity: String(product.quantity),
  note: product.note,
  purchasePlace: product.purchasePlace,
  purchaseDate: product.purchaseDate ? product.purchaseDate.slice(0, 10) : '',
  warrantyPeriod: String(product.warrantyPeriod),
});

const toClientForm = (client: Client): ClientFormValues => ({
  phone: client.phone,
  name: client.name,
  note: client.note,
  status: client.status,
});

const toSaleForm = (sale: Sale): SaleFormValues => ({
  saleDate: sale.saleDate.slice(0, 10),
  clientId: sale.client.id,
  productId: sale.product.id,
  quantity: String(sale.quantity),
  salePrice: String(sale.salePrice),
  note: sale.note,
});

type StatsPeriod = 'today' | 'currentMonth' | 'lastMonth';

type SalesSnapshot = {
  year: number;
  label: string;
  detailLabel: string;
  revenue: number;
  salesCount: number;
  itemsSold: number;
  values: number[];
  color: string;
};

const statsPeriodOptions: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'currentMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

const comparisonColors = ['#0f172a', '#f97316', '#0ea5e9'] as const;

const metricFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const compactMetricFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  signDisplay: 'always',
});

const buildMonthlyValues = (
  allSales: Sale[],
  year: number,
  month: number,
): SalesSnapshot['values'] => {
  const dayCount = new Date(year, month + 1, 0).getDate();
  const values = Array.from({ length: dayCount }, () => 0);

  allSales.forEach((sale) => {
    const saleDate = new Date(sale.saleDate);
    if (
      saleDate.getFullYear() !== year ||
      saleDate.getMonth() !== month
    ) {
      return;
    }

    const dayIndex = saleDate.getDate() - 1;
    values[dayIndex] += sale.salePrice * sale.quantity;
  });

  return values;
};

const buildSalesSnapshot = (
  allSales: Sale[],
  period: StatsPeriod,
  baseDate: Date,
  yearsBack: number,
  color: string,
): SalesSnapshot => {
  const year = baseDate.getFullYear() - yearsBack;

  if (period === 'today') {
    const month = baseDate.getMonth();
    const day = baseDate.getDate();
    const matchedSales = allSales.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      return (
        saleDate.getFullYear() === year &&
        saleDate.getMonth() === month &&
        saleDate.getDate() === day
      );
    });

    const revenue = matchedSales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0,
    );
    const salesCount = matchedSales.length;
    const itemsSold = matchedSales.reduce((sum, sale) => sum + sale.quantity, 0);

    return {
      year,
      label: String(year),
      detailLabel: new Date(year, month, day).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      revenue,
      salesCount,
      itemsSold,
      values: [revenue],
      color,
    };
  }

  const monthDate =
    period === 'currentMonth'
      ? new Date(year, baseDate.getMonth(), 1)
      : new Date(year, baseDate.getMonth() - 1, 1);
  const month = monthDate.getMonth();
  const monthlyValues = buildMonthlyValues(allSales, monthDate.getFullYear(), month);
  const matchedSales = allSales.filter((sale) => {
    const saleDate = new Date(sale.saleDate);
    return (
      saleDate.getFullYear() === monthDate.getFullYear() &&
      saleDate.getMonth() === month
    );
  });

  return {
    year: monthDate.getFullYear(),
    label: String(monthDate.getFullYear()),
    detailLabel: monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    revenue: monthlyValues.reduce((sum, value) => sum + value, 0),
    salesCount: matchedSales.length,
    itemsSold: matchedSales.reduce((sum, sale) => sum + sale.quantity, 0),
    values: monthlyValues,
    color,
  };
};

const buildLinePath = (
  values: number[],
  maxValue: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
) => {
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  return values
    .map((value, index) => {
      const x =
        padding.left +
        (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
      const y =
        padding.top + innerHeight - (value / Math.max(maxValue, 1)) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

const formatMetric = (value: number) => metricFormatter.format(Math.round(value));

const formatCompactMetric = (value: number) =>
  compactMetricFormatter.format(value);

function App() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistory | null>(null);

  const [productForm, setProductForm] =
    useState<ProductFormValues>(initialProductForm);
  const [clientForm, setClientForm] =
    useState<ClientFormValues>(initialClientForm);
  const [saleForm, setSaleForm] = useState<SaleFormValues>(initialSaleForm);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientStatusFilter, setClientStatusFilter] =
    useState<ClientStatus | 'all'>('all');
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const deferredClientSearchQuery = useDeferredValue(clientSearchQuery.trim());

  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true);
  const [isClientHistoryLoading, setIsClientHistoryLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [isClientSaving, setIsClientSaving] = useState(false);
  const [isSaleSaving, setIsSaleSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    const fetchWorkspaceData = async () => {
      setIsProductsLoading(true);
      setIsClientsLoading(true);

      try {
        const [productsData, clientsData] = await Promise.all([
          getProducts(),
          getClients(),
        ]);

        if (!isActive) {
          return;
        }

        setAllProducts(productsData);
        setAllClients(clientsData);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load clients.',
        );
      } finally {
        if (isActive) {
          setIsProductsLoading(false);
          setIsClientsLoading(false);
        }
      }
    };

    void fetchWorkspaceData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchSales = async () => {
      setIsSalesLoading(true);

      try {
        const data = await getSales();
        if (!isActive) {
          return;
        }
        setSales(data);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load sales.',
        );
      } finally {
        if (isActive) {
          setIsSalesLoading(false);
        }
      }
    };

    void fetchSales();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      return;
    }

    let isActive = true;

    const fetchClientHistory = async () => {
      setIsClientHistoryLoading(true);

      try {
        const history = await getClientHistory(selectedClientId);
        if (!isActive) {
          return;
        }
        setClientHistory(history);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load client history.',
        );
      } finally {
        if (isActive) {
          setIsClientHistoryLoading(false);
        }
      }
    };

    void fetchClientHistory();

    return () => {
      isActive = false;
    };
  }, [selectedClientId]);

  const clearNotifications = () => {
    setError('');
    setSuccessMessage('');
  };

  const replaceProduct = (nextProduct: Product) => {
    setAllProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === nextProduct.id ? nextProduct : product,
      ),
    );
  };

  const replaceClient = (nextClient: Client) => {
    setAllClients((currentClients) =>
      currentClients.map((client) =>
        client.id === nextClient.id ? nextClient : client,
      ),
    );
  };

  const handleProductFormChange = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => {
    setProductForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleClientFormChange = <K extends keyof ClientFormValues>(
    field: K,
    value: ClientFormValues[K],
  ) => {
    setClientForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSaleFormChange = <K extends keyof SaleFormValues>(
    field: K,
    value: SaleFormValues[K],
  ) => {
    setSaleForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const resetProductEditor = () => {
    setEditingProductId(null);
    setProductForm(initialProductForm);
  };

  const resetClientEditor = () => {
    setEditingClientId(null);
    setClientForm(initialClientForm);
  };

  const resetSaleEditor = () => {
    setEditingSaleId(null);
    setSaleForm(initialSaleForm);
  };

  const products = allProducts.filter((product) => {
    if (!deferredSearchQuery) {
      return true;
    }

    return [
      product.name,
      product.article,
      product.serialNumber,
      product.note,
      product.purchasePlace,
    ]
      .join(' ')
      .toLowerCase()
      .includes(deferredSearchQuery.toLowerCase());
  });

  const clients = allClients.filter((client) =>
    clientStatusFilter === 'all' ? true : client.status === clientStatusFilter,
  );

  const filteredClients = clients.filter((client) => {
    if (!deferredClientSearchQuery) {
      return true;
    }

    const normalizedDigits = deferredClientSearchQuery.replace(/\D/g, '');
    const clientDigits = client.phone.replace(/\D/g, '');

    return (
      client.name.toLowerCase().includes(deferredClientSearchQuery.toLowerCase()) ||
      client.phone.toLowerCase().includes(deferredClientSearchQuery.toLowerCase()) ||
      (normalizedDigits.length > 0 && clientDigits.includes(normalizedDigits))
    );
  });

  const handleSaveProduct = async () => {
    setIsProductSaving(true);
    clearNotifications();

    try {
      if (editingProductId) {
        const updatedProduct = await updateProduct(editingProductId, productForm);
        replaceProduct(updatedProduct);
        setSuccessMessage('Product updated.');
      } else {
        const createdProduct = await createProduct(productForm);
        setAllProducts((currentProducts) => [createdProduct, ...currentProducts]);
        setSuccessMessage('Product saved to MongoDB.');
      }

      resetProductEditor();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save product.',
      );
    } finally {
      setIsProductSaving(false);
    }
  };

  const handleSaveClient = async () => {
    setIsClientSaving(true);
    clearNotifications();

    try {
      if (editingClientId) {
        const updatedClient = await updateClient(editingClientId, clientForm);
        replaceClient(updatedClient);
        if (selectedClientId === updatedClient.id) {
          setSelectedClientId(updatedClient.id);
        }
        setSuccessMessage('Client updated.');
      } else {
        const createdClient = await createClient(clientForm);
        setAllClients((currentClients) => [createdClient, ...currentClients]);
        setSuccessMessage('Client card created.');
      }

      resetClientEditor();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save client.',
      );
    } finally {
      setIsClientSaving(false);
    }
  };

  const handleSaveSale = async () => {
    setIsSaleSaving(true);
    clearNotifications();

    try {
      if (editingSaleId) {
        const result = await updateSale(editingSaleId, saleForm);
        setSales((currentSales) =>
          currentSales.map((sale) =>
            sale.id === result.sale.id ? result.sale : sale,
          ),
        );
        const refreshedProducts = await getProducts();
        setAllProducts(refreshedProducts);
        setSuccessMessage('Sale updated and stock recalculated.');
      } else {
        const result = await createSale(saleForm);
        setSales((currentSales) => [result.sale, ...currentSales]);
        replaceProduct(result.product);
        setSuccessMessage('Sale card created and stock updated.');
      }

      resetSaleEditor();
      if (selectedClientId) {
        const history = await getClientHistory(selectedClientId);
        setClientHistory(history);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save sale.',
      );
    } finally {
      setIsSaleSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    clearNotifications();

    if (!window.confirm(`Delete product "${product.name}"?`)) {
      return;
    }

    try {
      await deleteProduct(product.id);
      setAllProducts((currentProducts) =>
        currentProducts.filter((item) => item.id !== product.id),
      );
      if (editingProductId === product.id) {
        resetProductEditor();
      }
      setSuccessMessage('Product deleted.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to delete product.',
      );
    }
  };

  const handleDeleteClient = async (client: Client) => {
    clearNotifications();

    if (!window.confirm(`Delete client "${client.name}"?`)) {
      return;
    }

    try {
      await deleteClient(client.id);
      setAllClients((currentClients) =>
        currentClients.filter((item) => item.id !== client.id),
      );
      if (selectedClientId === client.id) {
        setSelectedClientId(null);
        setClientHistory(null);
      }
      if (editingClientId === client.id) {
        resetClientEditor();
      }
      setSuccessMessage('Client deleted.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to delete client.',
      );
    }
  };

  const handleDeleteSale = async (sale: Sale) => {
    clearNotifications();

    if (!window.confirm(`Delete sale for "${sale.product.name}"?`)) {
      return;
    }

    try {
      await deleteSale(sale.id);
      setSales((currentSales) => currentSales.filter((item) => item.id !== sale.id));
      const refreshedProducts = await getProducts();
      setAllProducts(refreshedProducts);
      if (editingSaleId === sale.id) {
        resetSaleEditor();
      }
      if (selectedClientId === sale.client.id) {
        const history = await getClientHistory(sale.client.id);
        setClientHistory(history);
      }
      setSuccessMessage('Sale deleted and stock restored.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to delete sale.',
      );
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    clearNotifications();

    try {
      await exportProducts();
      setSuccessMessage('Product export prepared.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to export products.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    clearNotifications();

    try {
      const result = await seedDemoData();
      setAllProducts(result.products);
      setAllClients(result.clients);
      setSales(result.sales);
      setSelectedClientId(null);
      setClientHistory(null);
      resetProductEditor();
      resetClientEditor();
      resetSaleEditor();
      setSearchQuery('');
      setClientSearchQuery('');
      setClientStatusFilter('all');
      setSuccessMessage(result.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to seed demo data.',
      );
    } finally {
      setIsSeeding(false);
    }
  };

  const totalFreeStock = allProducts.reduce(
    (total, product) => total + product.freeQuantity,
    0,
  );
  const currentDate = new Date();
  const salesSnapshots = comparisonColors.map((color, index) =>
    buildSalesSnapshot(sales, statsPeriod, currentDate, index, color),
  );
  const [currentSnapshot, lastYearSnapshot, twoYearsAgoSnapshot] = salesSnapshots;
  const periodLabels =
    statsPeriod === 'today'
      ? [currentSnapshot.detailLabel]
      : Array.from(
          {
            length: Math.max(
              currentSnapshot.values.length,
              lastYearSnapshot.values.length,
              twoYearsAgoSnapshot.values.length,
            ),
          },
          (_, index) => String(index + 1),
        );
  const hasPeriodSales = salesSnapshots.some((snapshot) => snapshot.salesCount > 0);
  const chartMaxValue = Math.max(
    1,
    ...salesSnapshots.flatMap((snapshot) => snapshot.values),
  );
  const averageTicket =
    currentSnapshot.salesCount > 0
      ? currentSnapshot.revenue / currentSnapshot.salesCount
      : 0;
  const revenueDelta =
    lastYearSnapshot.revenue === 0
      ? currentSnapshot.revenue > 0
        ? 100
        : 0
      : ((currentSnapshot.revenue - lastYearSnapshot.revenue) /
          lastYearSnapshot.revenue) *
        100;
  const chartWidth = 520;
  const chartHeight = 260;
  const chartPadding = { top: 18, right: 18, bottom: 34, left: 18 };
  const heroStatCards = [
    {
      label: 'Revenue',
      value: formatCompactMetric(currentSnapshot.revenue),
      hint: `${percentFormatter.format(revenueDelta)} vs ${lastYearSnapshot.label}`,
    },
    {
      label: 'Sales',
      value: formatMetric(currentSnapshot.salesCount),
      hint: `${formatMetric(lastYearSnapshot.salesCount)} last year`,
    },
    {
      label: 'Items sold',
      value: formatMetric(currentSnapshot.itemsSold),
      hint: `${formatMetric(twoYearsAgoSnapshot.itemsSold)} in ${twoYearsAgoSnapshot.label}`,
    },
    {
      label: 'Avg. ticket',
      value: formatCompactMetric(averageTicket),
      hint: currentSnapshot.detailLabel,
    },
  ];

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Sales analytics</p>
          <h1>Track sales by period and compare them with previous years.</h1>
          <p className="hero-text">
            Choose today, this month, or last month to see live totals and compare
            the same window against the previous two years.
          </p>

          <div className="period-toggle" role="tablist" aria-label="Statistics period">
            {statsPeriodOptions.map((option) => (
              <button
                key={option.value}
                className={
                  option.value === statsPeriod
                    ? 'period-button period-button-active'
                    : 'period-button'
                }
                type="button"
                onClick={() => setStatsPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="hero-stat-grid">
            {heroStatCards.map((card) => (
              <article key={card.label} className="metric-card metric-card-hero">
                <span className="metric-label">{card.label}</span>
                <strong>{card.value}</strong>
                <p className="metric-hint">{card.hint}</p>
              </article>
            ))}
          </div>

          <div className="hero-actions">
            <button
              className="primary-button"
              type="button"
              onClick={handleSeed}
              disabled={isSeeding}
            >
              {isSeeding ? 'Seeding...' : 'Create demo data'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleExport}
              disabled={isExporting || products.length === 0}
            >
              {isExporting ? 'Exporting...' : 'Export products'}
            </button>
          </div>

          <div className="hero-inline-metrics">
            <div className="hero-inline-metric">
              <span className="metric-label">Products</span>
              <strong>{formatMetric(allProducts.length)}</strong>
            </div>
            <div className="hero-inline-metric">
              <span className="metric-label">Clients</span>
              <strong>{formatMetric(allClients.length)}</strong>
            </div>
            <div className="hero-inline-metric">
              <span className="metric-label">Free stock</span>
              <strong>{formatMetric(totalFreeStock)}</strong>
            </div>
          </div>
        </div>

        <div className="hero-chart-panel">
          <div className="hero-chart-card">
            <div className="hero-chart-header">
              <div>
                <p className="section-label">Comparison chart</p>
                <h2>{currentSnapshot.detailLabel}</h2>
              </div>
              <p className="hero-chart-note">
                Same {statsPeriod === 'today' ? 'day' : 'period'} in {currentSnapshot.label},{' '}
                {lastYearSnapshot.label}, and {twoYearsAgoSnapshot.label}.
              </p>
            </div>

            <div className="chart-legend">
              {salesSnapshots.map((snapshot) => (
                <div key={snapshot.label} className="chart-legend-item">
                  <span
                    className="chart-legend-swatch"
                    style={{ backgroundColor: snapshot.color }}
                  />
                  <div>
                    <strong>{snapshot.label}</strong>
                    <p>{formatCompactMetric(snapshot.revenue)} revenue</p>
                  </div>
                </div>
              ))}
            </div>

            {isSalesLoading ? (
              <p className="empty-state">Loading sales statistics...</p>
            ) : !hasPeriodSales ? (
              <p className="empty-state">
                No sales found for the selected period in the current or previous years.
              </p>
            ) : statsPeriod === 'today' ? (
              <div className="bar-chart" aria-label="Sales comparison by year">
                {salesSnapshots.map((snapshot) => {
                  const barHeight = `${(snapshot.revenue / chartMaxValue) * 100}%`;

                  return (
                    <div key={snapshot.label} className="bar-chart-item">
                      <div className="bar-chart-track">
                        <div
                          className="bar-chart-bar"
                          style={{
                            height: barHeight,
                            backgroundColor: snapshot.color,
                          }}
                        />
                      </div>
                      <strong>{snapshot.label}</strong>
                      <span>{formatCompactMetric(snapshot.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <svg
                  className="hero-chart"
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  role="img"
                  aria-label="Sales comparison chart"
                >
                  {[0.25, 0.5, 0.75, 1].map((step) => {
                    const y =
                      chartPadding.top +
                      (chartHeight - chartPadding.top - chartPadding.bottom) * (1 - step);

                    return (
                      <line
                        key={step}
                        x1={chartPadding.left}
                        x2={chartWidth - chartPadding.right}
                        y1={y}
                        y2={y}
                        className="hero-chart-gridline"
                      />
                    );
                  })}

                  {salesSnapshots.map((snapshot) => (
                    <path
                      key={snapshot.label}
                      d={buildLinePath(
                        snapshot.values,
                        chartMaxValue,
                        chartWidth,
                        chartHeight,
                        chartPadding,
                      )}
                      fill="none"
                      stroke={snapshot.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}

                  {salesSnapshots.map((snapshot) =>
                    snapshot.values.map((value, index) => {
                      const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
                      const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
                      const x =
                        chartPadding.left +
                        (snapshot.values.length === 1
                          ? innerWidth / 2
                          : (index / (snapshot.values.length - 1)) * innerWidth);
                      const y =
                        chartPadding.top +
                        innerHeight -
                        (value / Math.max(chartMaxValue, 1)) * innerHeight;

                      return (
                        <circle
                          key={`${snapshot.label}-${index}`}
                          cx={x}
                          cy={y}
                          r="3.5"
                          fill={snapshot.color}
                        />
                      );
                    }),
                  )}
                </svg>

                <div className="chart-axis-labels">
                  {periodLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {error ? <p className="banner banner-error">{error}</p> : null}
      {successMessage ? <p className="banner banner-success">{successMessage}</p> : null}

      <section className="workspace-grid">
        <div className="column-stack">
          <ProductForm
            form={productForm}
            isSaving={isProductSaving}
            isEditing={Boolean(editingProductId)}
            onChange={handleProductFormChange}
            onSubmit={handleSaveProduct}
            onCancelEdit={resetProductEditor}
          />

          <ClientForm
            clients={allClients}
            form={clientForm}
            isSaving={isClientSaving}
            isEditing={Boolean(editingClientId)}
            onChange={handleClientFormChange}
            onSubmit={handleSaveClient}
            onCancelEdit={resetClientEditor}
            onPickExisting={(client) => {
              clearNotifications();
              setEditingClientId(client.id);
              setClientForm(toClientForm(client));
            }}
          />
        </div>

        <div className="column-stack">
          <section className="panel">
            <div className="panel-header panel-header-stacked">
              <div className="panel-header-row">
                <div>
                  <p className="section-label">Catalog</p>
                  <h2>Product list</h2>
                </div>
              </div>

              <label className="search-field">
                <span>Search by article, serial, name, or keyword</span>
                <input
                  value={searchQuery}
                  placeholder="WM-001, LOG-M185-0001, mouse"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
            </div>

            <ProductList
              products={products}
              isLoading={isProductsLoading}
              searchQuery={deferredSearchQuery}
              onEdit={(product) => {
                clearNotifications();
                setEditingProductId(product.id);
                setProductForm(toProductForm(product));
              }}
              onDelete={handleDeleteProduct}
            />
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Sales</p>
                <h2>Sales history</h2>
              </div>
            </div>
            <SalesList
              sales={sales}
              isLoading={isSalesLoading}
              onEdit={(sale) => {
                clearNotifications();
                setEditingSaleId(sale.id);
                setSaleForm(toSaleForm(sale));
              }}
              onDelete={handleDeleteSale}
            />
          </section>
        </div>

        <div className="column-stack">
          <SaleForm
            clients={allClients}
            products={allProducts}
            form={saleForm}
            isSaving={isSaleSaving}
            isEditing={Boolean(editingSaleId)}
            onChange={handleSaleFormChange}
            onSubmit={handleSaveSale}
            onCancelEdit={resetSaleEditor}
          />

          <section className="panel">
            <div className="panel-header panel-header-stacked">
              <div className="panel-header-row">
                <div>
                  <p className="section-label">Clients</p>
                  <h2>Client list</h2>
                </div>
              </div>

              <label className="search-field">
                <span>Search by name or phone</span>
                <input
                  value={clientSearchQuery}
                  placeholder="Ivan, +38067..."
                  onChange={(event) => setClientSearchQuery(event.target.value)}
                />
              </label>

              <label className="search-field">
                <span>Filter by status</span>
                <select
                  value={clientStatusFilter}
                  onChange={(event) =>
                    setClientStatusFilter(
                      event.target.value as ClientStatus | 'all',
                    )
                  }
                >
                  {clientStatusFilters.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ClientList
              clients={filteredClients}
              isLoading={isClientsLoading}
              searchQuery={deferredClientSearchQuery}
              selectedClientId={selectedClientId}
              onSelect={(client) => {
                clearNotifications();
                setSelectedClientId(client.id);
              }}
              onEdit={(client) => {
                clearNotifications();
                setEditingClientId(client.id);
                setClientForm(toClientForm(client));
              }}
              onDelete={handleDeleteClient}
            />
          </section>

          <ClientHistoryPanel
            history={clientHistory}
            isLoading={isClientHistoryLoading}
          />
        </div>
      </section>
    </main>
  );
}

export default App;
