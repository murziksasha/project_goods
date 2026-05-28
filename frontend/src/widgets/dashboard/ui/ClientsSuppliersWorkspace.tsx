import { useMemo, useState } from 'react';
import { formatDateTime } from '../../../shared/lib/format';
import type { Sale } from '../../../entities/sale/model/types';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
} from '../../../entities/client/model/types';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../entities/supplier/model/types';
import { ClientsWorkspace } from './ClientsWorkspace';

type TabKey = 'clients' | 'suppliers';

type Props = {
  clients: Client[];
  sales: Sale[];
  suppliers: Supplier[];
  selectedClientId: string | null;
  history: ClientHistory | null;
  isClientsLoading: boolean;
  isHistoryLoading: boolean;
  isSaving: boolean;
  onSelectClient: (clientId: string | null) => void;
  onDeleteClient: (client: Client) => Promise<void>;
  onCreateClient: (payload: ClientFormValues) => Promise<boolean>;
  onMergeClients: (
    targetClientId: string,
    sourceClientId: string,
  ) => Promise<boolean>;
  onMergeSuppliers: (
    targetSupplierId: string,
    sourceSupplierId: string,
  ) => Promise<boolean>;
  onUpdateClient: (
    clientId: string,
    payload: ClientFormValues,
  ) => Promise<boolean>;
  onOpenSaleCard: (sale: Sale) => void;
  openClientCardRequestId?: string | null;
  onOpenClientCardHandled?: () => void;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (
    supplierId: string,
    payload: SupplierFormValues,
  ) => Promise<boolean>;
};

const getSearchText = (supplier: Supplier) =>
  [
    supplier.name,
    supplier.phone,
    supplier.note,
    supplier.supplierOrder,
  ]
    .join(' ')
    .toLowerCase();

export const ClientsSuppliersWorkspace = ({
  clients,
  sales,
  suppliers,
  selectedClientId,
  history,
  isClientsLoading,
  isHistoryLoading,
  isSaving,
  onSelectClient,
  onDeleteClient,
  onCreateClient,
  onMergeClients,
  onUpdateClient,
  onOpenSaleCard,
  openClientCardRequestId,
  onOpenClientCardHandled,
  onCreateSupplier,
  onMergeSuppliers,
  onUpdateSupplier,
}: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>('clients');
  const [query, setQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(
    null,
  );
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetQuery, setMergeTargetQuery] = useState('');
  const [mergeSourceQuery, setMergeSourceQuery] = useState('');
  const [showMergeTargetSuggestions, setShowMergeTargetSuggestions] =
    useState(false);
  const [showMergeSourceSuggestions, setShowMergeSourceSuggestions] =
    useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '+380',
    supplierOrder: '',
    note: '',
    isActive: true,
  });

  const filteredSuppliers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = [...suppliers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (!normalized) return base;
    return base.filter((supplier) =>
      getSearchText(supplier).includes(normalized),
    );
  }, [query, suppliers]);

  const duplicateSupplier = useMemo(() => {
    const name = form.name.trim().toLowerCase();
    const phoneDigits = form.phone.replace(/\D/g, '');
    return suppliers.find((supplier) => {
      if (editingSupplierId && supplier.id === editingSupplierId) {
        return false;
      }
      const sameName =
        name.length > 0 && supplier.name.trim().toLowerCase() === name;
      const samePhone =
        phoneDigits.length > 0 &&
        supplier.phone.replace(/\D/g, '') === phoneDigits;
      return sameName || samePhone;
    });
  }, [editingSupplierId, form.name, form.phone, suppliers]);

  const mergeTargetOptions = useMemo(() => {
    const normalized = mergeTargetQuery.trim().toLowerCase();
    if (!normalized) return [];
    return suppliers
      .filter((supplier) =>
        `${supplier.name} ${supplier.phone}`.toLowerCase().includes(normalized),
      )
      .slice(0, 6);
  }, [mergeTargetQuery, suppliers]);

  const mergeSourceOptions = useMemo(() => {
    const normalized = mergeSourceQuery.trim().toLowerCase();
    if (!normalized) return [];
    return suppliers
      .filter((supplier) =>
        `${supplier.name} ${supplier.phone}`.toLowerCase().includes(normalized),
      )
      .slice(0, 6);
  }, [mergeSourceQuery, suppliers]);

  const openCreateModal = () => {
    setEditingSupplierId(null);
    setForm({
      name: '',
      phone: '+380',
      supplierOrder: '',
      note: '',
      isActive: true,
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone,
      supplierOrder: supplier.supplierOrder ?? '',
      note: supplier.note ?? '',
      isActive: supplier.isActive,
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    const payload: SupplierFormValues = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      supplierOrder: form.supplierOrder.trim(),
      note: form.note.trim(),
      isActive: form.isActive,
    };

    if (!payload.name || !payload.phone) return;

    const isSuccess = editingSupplierId
      ? await onUpdateSupplier(editingSupplierId, payload)
      : await onCreateSupplier(payload);

    if (!isSuccess) return;
    setIsCreateModalOpen(false);
  };

  const handleMergeSuppliers = async () => {
    if (
      !mergeTargetId ||
      !mergeSourceId ||
      mergeTargetId === mergeSourceId
    ) {
      return;
    }

    const isSuccess = await onMergeSuppliers(mergeTargetId, mergeSourceId);
    if (!isSuccess) return;

    setIsMergeModalOpen(false);
    setMergeTargetQuery('');
    setMergeSourceQuery('');
    setMergeTargetId('');
    setMergeSourceId('');
  };

  return (
    <section className='panel clients-workspace'>
      <div className='orders-tabs' role='tablist' aria-label='Clients and suppliers'>
        <button
          type='button'
          className={
            activeTab === 'clients'
              ? 'orders-tab orders-tab-active'
              : 'orders-tab'
          }
          onClick={() => setActiveTab('clients')}
        >
          Clients
        </button>
        <button
          type='button'
          className={
            activeTab === 'suppliers'
              ? 'orders-tab orders-tab-active'
              : 'orders-tab'
          }
          onClick={() => setActiveTab('suppliers')}
        >
          Suppliers
        </button>
      </div>

      {activeTab === 'clients' ? (
        <ClientsWorkspace
          clients={clients}
          sales={sales}
          selectedClientId={selectedClientId}
          history={history}
          isClientsLoading={isClientsLoading}
          isHistoryLoading={isHistoryLoading}
          isSaving={isSaving}
          onSelectClient={onSelectClient}
          onDeleteClient={onDeleteClient}
          onCreateClient={onCreateClient}
          onMergeClients={onMergeClients}
          onUpdateClient={onUpdateClient}
          onOpenSaleCard={onOpenSaleCard}
          openClientCardRequestId={openClientCardRequestId}
          onOpenClientCardHandled={onOpenClientCardHandled}
        />
      ) : (
        <>
          <div className='orders-toolbar clients-toolbar'>
            <div className='orders-toolbar-left'>
              <div className='orders-search-group orders-search-group-clearable clients-search-group'>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder='Search by name, phone or supplier order'
                />
                {query ? (
                  <span
                    role='button'
                    tabIndex={0}
                    className='orders-search-clear'
                    aria-label='Clear search text'
                    onClick={() => setQuery('')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setQuery('');
                      }
                    }}
                  >
                    x
                  </span>
                ) : null}
              </div>
            </div>
            <div className='orders-toolbar-actions clients-toolbar-actions'>
              <button
                type='button'
                className='secondary-button'
                onClick={() => setIsMergeModalOpen(true)}
              >
                Merge
              </button>
              <button
                type='button'
                className='primary-button'
                onClick={openCreateModal}
              >
                Create supplier
              </button>
            </div>
          </div>

          <div className='orders-table-wrap'>
            <table className='orders-table clients-table'>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Supplier order</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className='clients-table-row'
                    onClick={() => openEditModal(supplier)}
                  >
                    <td>{supplier.id.slice(-6)}</td>
                    <td>{supplier.name}</td>
                    <td>{supplier.phone}</td>
                    <td>{supplier.supplierOrder || '-'}</td>
                    <td>{supplier.isActive ? 'active' : 'inactive'}</td>
                    <td>{formatDateTime(supplier.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSuppliers.length === 0 ? (
              <p className='empty-state'>No suppliers found.</p>
            ) : null}
          </div>
        </>
      )}

      {isCreateModalOpen ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onClick={() => setIsCreateModalOpen(false)}
        >
          <article
            className='catalog-edit-modal clients-modal'
            role='dialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}
          >
            <header className='catalog-edit-header'>
              <h2>{editingSupplierId ? 'Edit supplier' : 'Create supplier'}</h2>
              <button
                type='button'
                className='ghost-button'
                onClick={() => setIsCreateModalOpen(false)}
              >
                x
              </button>
            </header>
            <div className='catalog-edit-body clients-modal-body'>
              <label className='field field-wide'>
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field field-wide'>
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field field-wide'>
                <span>Supplier order</span>
                <input
                  value={form.supplierOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplierOrder: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field field-wide'>
                <span>Note</span>
                <textarea
                  rows={4}
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field field-wide'>
                <span>Status</span>
                <select
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.value === 'active',
                    }))
                  }
                >
                  <option value='active'>active</option>
                  <option value='inactive'>inactive</option>
                </select>
              </label>
              {duplicateSupplier ? (
                <p className='error-message'>
                  Supplier with same phone or name already exists: {duplicateSupplier.name}
                </p>
              ) : null}
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={
                  isSaving ||
                  Boolean(duplicateSupplier) ||
                  !form.name.trim() ||
                  !form.phone.trim()
                }
                onClick={() => {
                  void handleSaveSupplier();
                }}
              >
                {isSaving ? 'Saving...' : editingSupplierId ? 'Save' : 'Create'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}

      {isMergeModalOpen ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onClick={() => setIsMergeModalOpen(false)}
        >
          <article
            className='catalog-edit-modal clients-modal'
            role='dialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}
          >
            <header className='catalog-edit-header'>
              <h2>Merge suppliers</h2>
              <button
                type='button'
                className='ghost-button'
                onClick={() => setIsMergeModalOpen(false)}
              >
                x
              </button>
            </header>
            <div className='catalog-edit-body clients-modal-body'>
              <p className='muted-copy'>
                Select Supplier 1 and Supplier 2. Data from Supplier 2 will be merged into Supplier 1, then Supplier 2 will be removed.
              </p>
              <label className='field field-wide modal-suggestions-anchor'>
                <span>Supplier 1</span>
                <input
                  value={mergeTargetQuery}
                  placeholder='Enter name or phone'
                  onChange={(event) => {
                    setMergeTargetQuery(event.target.value);
                    setMergeTargetId('');
                    setShowMergeTargetSuggestions(true);
                  }}
                />
              </label>
              {showMergeTargetSuggestions &&
              mergeTargetOptions.length > 0 ? (
                <div className='suggestions-panel'>
                  {mergeTargetOptions.map((supplier) => (
                    <button
                      key={supplier.id}
                      type='button'
                      className='suggestion-item'
                      onClick={() => {
                        setMergeTargetId(supplier.id);
                        setMergeTargetQuery(
                          `${supplier.name} (${supplier.phone})`,
                        );
                        setShowMergeTargetSuggestions(false);
                      }}
                    >
                      <strong>{supplier.name}</strong>
                      <span>{supplier.phone}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <label className='field field-wide modal-suggestions-anchor'>
                <span>Supplier 2</span>
                <input
                  value={mergeSourceQuery}
                  placeholder='Enter name or phone'
                  onChange={(event) => {
                    setMergeSourceQuery(event.target.value);
                    setMergeSourceId('');
                    setShowMergeSourceSuggestions(true);
                  }}
                />
              </label>
              {showMergeSourceSuggestions &&
              mergeSourceOptions.length > 0 ? (
                <div className='suggestions-panel'>
                  {mergeSourceOptions.map((supplier) => (
                    <button
                      key={supplier.id}
                      type='button'
                      className='suggestion-item'
                      onClick={() => {
                        setMergeSourceId(supplier.id);
                        setMergeSourceQuery(
                          `${supplier.name} (${supplier.phone})`,
                        );
                        setShowMergeSourceSuggestions(false);
                      }}
                    >
                      <strong>{supplier.name}</strong>
                      <span>{supplier.phone}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={
                  isSaving ||
                  !mergeTargetId ||
                  !mergeSourceId ||
                  mergeTargetId === mergeSourceId
                }
                onClick={() => {
                  void handleMergeSuppliers();
                }}
              >
                {isSaving ? 'Merging...' : 'Merge suppliers'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </section>
  );
};

