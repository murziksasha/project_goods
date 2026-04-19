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
  price: '',
  quantity: '',
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
  price: String(product.price),
  quantity: String(product.quantity),
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

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
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
  const [clientStatusFilter, setClientStatusFilter] =
    useState<ClientStatus | 'all'>('all');
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

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

    const fetchProducts = async () => {
      setIsProductsLoading(true);

      try {
        const data = await getProducts(deferredSearchQuery);
        if (!isActive) {
          return;
        }
        setProducts(data);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Failed to load products.',
        );
      } finally {
        if (isActive) {
          setIsProductsLoading(false);
        }
      }
    };

    void fetchProducts();

    return () => {
      isActive = false;
    };
  }, [deferredSearchQuery]);

  useEffect(() => {
    let isActive = true;

    const fetchClients = async () => {
      setIsClientsLoading(true);

      try {
        const data = await getClients('', clientStatusFilter);
        if (!isActive) {
          return;
        }
        setClients(data);
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
          setIsClientsLoading(false);
        }
      }
    };

    void fetchClients();

    return () => {
      isActive = false;
    };
  }, [clientStatusFilter]);

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
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === nextProduct.id ? nextProduct : product,
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
        const matchesSearch =
          deferredSearchQuery.length === 0 ||
          `${createdProduct.name} ${createdProduct.article} ${createdProduct.purchasePlace}`
            .toLowerCase()
            .includes(deferredSearchQuery.toLowerCase());

        setProducts((currentProducts) =>
          matchesSearch ? [createdProduct, ...currentProducts] : currentProducts,
        );
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
        setClients((currentClients) =>
          currentClients.map((client) =>
            client.id === updatedClient.id ? updatedClient : client,
          ),
        );
        if (selectedClientId === updatedClient.id) {
          setSelectedClientId(updatedClient.id);
        }
        setSuccessMessage('Client updated.');
      } else {
        const createdClient = await createClient(clientForm);
        if (
          clientStatusFilter === 'all' ||
          clientStatusFilter === createdClient.status
        ) {
          setClients((currentClients) => [createdClient, ...currentClients]);
        }
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
        replaceProduct(result.product);
        setSuccessMessage('Sale updated and stock recalculated.');
      } else {
        const result = await createSale(saleForm);
        setSales((currentSales) => [result.sale, ...currentSales]);
        replaceProduct(result.product);
        setSuccessMessage('Sale card created and stock updated.');
      }

      resetSaleEditor();
      if (selectedClientId) {
        setSelectedClientId(selectedClientId);
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
      setProducts((currentProducts) =>
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
      setClients((currentClients) =>
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
      const refreshedProducts = await getProducts(deferredSearchQuery);
      setProducts(refreshedProducts);
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
      setProducts(result.products);
      setClients(result.clients);
      setSales(result.sales);
      setSelectedClientId(null);
      setClientHistory(null);
      resetProductEditor();
      resetClientEditor();
      resetSaleEditor();
      setSearchQuery('');
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

  const totalFreeStock = products.reduce(
    (total, product) => total + product.freeQuantity,
    0,
  );

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Goods Accounting</p>
          <h1>Manage stock, client cards, edits, deletions, and purchase history.</h1>
          <p className="hero-text">
            The workspace now supports full CRUD for products, clients, and sales,
            plus client status filtering and a dedicated purchase history panel.
          </p>

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
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <span className="metric-label">Products</span>
            <strong>{products.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Clients</span>
            <strong>{clients.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Sales</span>
            <strong>{sales.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Free stock</span>
            <strong>{totalFreeStock}</strong>
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
            form={clientForm}
            isSaving={isClientSaving}
            isEditing={Boolean(editingClientId)}
            onChange={handleClientFormChange}
            onSubmit={handleSaveClient}
            onCancelEdit={resetClientEditor}
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
                <span>Search by article, name, or keyword</span>
                <input
                  value={searchQuery}
                  placeholder="WM-001, mouse, Rozetka"
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
            clients={clients}
            products={products}
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
              clients={clients}
              isLoading={isClientsLoading}
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
