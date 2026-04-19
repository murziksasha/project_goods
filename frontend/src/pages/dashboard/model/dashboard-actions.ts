import { createClient, deleteClient, getClientHistory, updateClient } from '../../../entities/client/api/clientApi';
import { initialClientForm, toClientForm } from '../../../entities/client/model/forms';
import type { Client, ClientFormValues, ClientHistory, ClientStatus } from '../../../entities/client/model/types';
import { createProduct, deleteProduct, exportProducts, getProducts, updateProduct } from '../../../entities/product/api/productApi';
import { initialProductForm, toProductForm } from '../../../entities/product/model/forms';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { createSale, deleteSale, updateSale } from '../../../entities/sale/api/saleApi';
import { initialSaleForm, toSaleForm } from '../../../entities/sale/model/forms';
import type { Sale, SaleFormValues } from '../../../entities/sale/model/types';
import { seedDemoData } from '../../../features/demo-data/api/demoApi';
import { getRequestErrorMessage } from '../../../shared/lib/request';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type DashboardActionParams = {
  allProducts: Product[];
  productForm: ProductFormValues;
  clientForm: ClientFormValues;
  saleForm: SaleFormValues;
  editingProductId: string | null;
  editingClientId: string | null;
  editingSaleId: string | null;
  selectedClientId: string | null;
  setAllProducts: Setter<Product[]>;
  setAllClients: Setter<Client[]>;
  setSales: Setter<Sale[]>;
  setSelectedClientId: Setter<string | null>;
  setClientHistory: Setter<ClientHistory | null>;
  setProductForm: Setter<ProductFormValues>;
  setClientForm: Setter<ClientFormValues>;
  setSaleForm: Setter<SaleFormValues>;
  setEditingProductId: Setter<string | null>;
  setEditingClientId: Setter<string | null>;
  setEditingSaleId: Setter<string | null>;
  setProductSearchQuery: Setter<string>;
  setClientSearchQuery: Setter<string>;
  setClientStatusFilter: Setter<ClientStatus | 'all'>;
  setIsProductSaving: Setter<boolean>;
  setIsClientSaving: Setter<boolean>;
  setIsSaleSaving: Setter<boolean>;
  setIsExporting: Setter<boolean>;
  setIsSeeding: Setter<boolean>;
  setError: Setter<string>;
  setSuccessMessage: Setter<string>;
};

export const createDashboardActions = ({
  allProducts,
  productForm,
  clientForm,
  saleForm,
  editingProductId,
  editingClientId,
  editingSaleId,
  selectedClientId,
  setAllProducts,
  setAllClients,
  setSales,
  setSelectedClientId,
  setClientHistory,
  setProductForm,
  setClientForm,
  setSaleForm,
  setEditingProductId,
  setEditingClientId,
  setEditingSaleId,
  setProductSearchQuery,
  setClientSearchQuery,
  setClientStatusFilter,
  setIsProductSaving,
  setIsClientSaving,
  setIsSaleSaving,
  setIsExporting,
  setIsSeeding,
  setError,
  setSuccessMessage,
}: DashboardActionParams) => {
  const clearNotifications = () => {
    setError('');
    setSuccessMessage('');
  };

  const resetProductEditor = () => { setEditingProductId(null); setProductForm(initialProductForm); };
  const resetClientEditor = () => { setEditingClientId(null); setClientForm(initialClientForm); };
  const resetSaleEditor = () => { setEditingSaleId(null); setSaleForm(initialSaleForm); };

  const refreshClientHistory = async (clientId: string) => {
    setClientHistory(await getClientHistory(clientId));
  };

  return {
    setProductSearchQuery,
    setClientSearchQuery,
    setClientStatusFilter,
    setSelectedClientId: (clientId: string | null) => {
      clearNotifications();
      setSelectedClientId(clientId);
      if (!clientId) {
        setClientHistory(null);
      }
    },
    onProductChange: <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) =>
      setProductForm((currentForm) => ({ ...currentForm, [field]: value })),
    onClientChange: <K extends keyof ClientFormValues>(field: K, value: ClientFormValues[K]) =>
      setClientForm((currentForm) => ({ ...currentForm, [field]: value })),
    onSaleChange: <K extends keyof SaleFormValues>(field: K, value: SaleFormValues[K]) =>
      setSaleForm((currentForm) => ({ ...currentForm, [field]: value })),
    editProduct: (product: Product) => {
      clearNotifications();
      setEditingProductId(product.id);
      setProductForm(toProductForm(product));
    },
    editClient: (client: Client) => {
      clearNotifications();
      setEditingClientId(client.id);
      setClientForm(toClientForm(client));
    },
    editSale: (sale: Sale) => {
      clearNotifications();
      setEditingSaleId(sale.id);
      setSaleForm(toSaleForm(sale));
    },
    pickExistingClient: (client: Client) => {
      clearNotifications();
      setEditingClientId(client.id);
      setClientForm(toClientForm(client));
    },
    resetProductEditor,
    resetClientEditor,
    resetSaleEditor,
    saveProduct: async () => {
      setIsProductSaving(true);
      clearNotifications();

      try {
        if (editingProductId) {
          const updatedProduct = await updateProduct(editingProductId, productForm);
          setAllProducts((current) =>
            current.map((item) => (item.id === updatedProduct.id ? updatedProduct : item)),
          );
          setSuccessMessage('Product updated.');
        } else {
          const createdProduct = await createProduct(productForm);
          setAllProducts((current) => [createdProduct, ...current]);
          setSuccessMessage('Product saved to MongoDB.');
        }

        resetProductEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save product.'));
      } finally {
        setIsProductSaving(false);
      }
    },
    saveClient: async () => {
      setIsClientSaving(true);
      clearNotifications();

      try {
        if (editingClientId) {
          const updatedClient = await updateClient(editingClientId, clientForm);
          setAllClients((current) =>
            current.map((item) => (item.id === updatedClient.id ? updatedClient : item)),
          );
          if (selectedClientId === updatedClient.id) {
            setSelectedClientId(updatedClient.id);
          }
          setSuccessMessage('Client updated.');
        } else {
          const createdClient = await createClient(clientForm);
          setAllClients((current) => [createdClient, ...current]);
          setSuccessMessage('Client card created.');
        }

        resetClientEditor();
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save client.'));
      } finally {
        setIsClientSaving(false);
      }
    },
    saveSale: async () => {
      setIsSaleSaving(true);
      clearNotifications();

      try {
        if (editingSaleId) {
          const result = await updateSale(editingSaleId, saleForm);
          setSales((current) => current.map((sale) => (sale.id === result.sale.id ? result.sale : sale)));
          setAllProducts(await getProducts());
          setSuccessMessage('Sale updated and stock recalculated.');
        } else {
          const result = await createSale(saleForm);
          setSales((current) => [result.sale, ...current]);
          setAllProducts(
            allProducts.map((item) => (item.id === result.product.id ? result.product : item)),
          );
          setSuccessMessage('Sale card created and stock updated.');
        }

        resetSaleEditor();
        if (selectedClientId) {
          await refreshClientHistory(selectedClientId);
        }
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to save sale.'));
      } finally {
        setIsSaleSaving(false);
      }
    },
    deleteProduct: async (product: Product) => {
      clearNotifications();
      if (!window.confirm(`Delete product "${product.name}"?`)) return;

      try {
        await deleteProduct(product.id);
        setAllProducts((current) => current.filter((item) => item.id !== product.id));
        if (editingProductId === product.id) resetProductEditor();
        setSuccessMessage('Product deleted.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete product.'));
      }
    },
    deleteClient: async (client: Client) => {
      clearNotifications();
      if (!window.confirm(`Delete client "${client.name}"?`)) return;

      try {
        await deleteClient(client.id);
        setAllClients((current) => current.filter((item) => item.id !== client.id));
        if (selectedClientId === client.id) {
          setSelectedClientId(null);
          setClientHistory(null);
        }
        if (editingClientId === client.id) resetClientEditor();
        setSuccessMessage('Client deleted.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete client.'));
      }
    },
    deleteSale: async (sale: Sale) => {
      clearNotifications();
      if (!window.confirm(`Delete sale for "${sale.product.name}"?`)) return;

      try {
        await deleteSale(sale.id);
        setSales((current) => current.filter((item) => item.id !== sale.id));
        setAllProducts(await getProducts());
        if (editingSaleId === sale.id) resetSaleEditor();
        if (selectedClientId === sale.client.id) await refreshClientHistory(sale.client.id);
        setSuccessMessage('Sale deleted and stock restored.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to delete sale.'));
      }
    },
    exportProducts: async () => {
      setIsExporting(true);
      clearNotifications();
      try {
        await exportProducts();
        setSuccessMessage('Product export prepared.');
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to export products.'));
      } finally {
        setIsExporting(false);
      }
    },
    seedDemoData: async () => {
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
        setProductSearchQuery('');
        setClientSearchQuery('');
        setClientStatusFilter('all');
        setSuccessMessage(result.message);
      } catch (requestError) {
        setError(getRequestErrorMessage(requestError, 'Failed to seed demo data.'));
      } finally {
        setIsSeeding(false);
      }
    },
  };
};
