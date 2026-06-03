import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
type SupplierFormState = Required<SupplierFormValues>;
type SupplierSuggestionField = 'target' | 'source';

const clientsSuppliersTabStorageKey = 'project-goods.clients-suppliers-tab';
const defaultSupplierForm: SupplierFormState = {
  name: '',
  phone: '+380',
  supplierOrder: '',
  note: '',
  isActive: true,
};
const clientsSuppliersTabs: Array<{ key: TabKey; label: string }> = [
  { key: 'clients', label: 'Clients' },
  { key: 'suppliers', label: 'Suppliers' },
];

const getStoredClientsSuppliersTab = (): TabKey => {
  try {
    const storedTab = window.localStorage.getItem(clientsSuppliersTabStorageKey);
    return storedTab === 'clients' || storedTab === 'suppliers'
      ? storedTab
      : 'clients';
  } catch {
    return 'clients';
  }
};

const toSupplierForm = (supplier?: Supplier): SupplierFormState => ({
  name: supplier?.name ?? defaultSupplierForm.name,
  phone: supplier?.phone ?? defaultSupplierForm.phone,
  supplierOrder: supplier?.supplierOrder ?? defaultSupplierForm.supplierOrder,
  note: supplier?.note ?? defaultSupplierForm.note,
  isActive: supplier?.isActive ?? defaultSupplierForm.isActive,
});

const toSupplierPayload = (form: SupplierFormState): SupplierFormValues => ({
  name: form.name.trim(),
  phone: form.phone.trim(),
  supplierOrder: form.supplierOrder.trim(),
  note: form.note.trim(),
  isActive: form.isActive,
});

const getSearchText = (supplier: Supplier) =>
  [
    supplier.name,
    supplier.phone,
    supplier.note,
    supplier.supplierOrder,
  ]
    .join(' ')
    .toLowerCase();

const getSupplierLabel = (supplier: Supplier) =>
  `${supplier.name} (${supplier.phone})`;

const getSupplierMergeOptions = (
  suppliers: Supplier[],
  query: string,
) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return suppliers
    .filter((supplier) =>
      `${supplier.name} ${supplier.phone}`.toLowerCase().includes(normalized),
    )
    .slice(0, 6);
};

const findDuplicateSupplier = (
  suppliers: Supplier[],
  form: SupplierFormState,
  editingSupplierId: string | null,
) => {
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
};

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
  const [activeTab, setActiveTab] = useState<TabKey>(
    getStoredClientsSuppliersTab,
  );
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
  const [form, setForm] = useState<SupplierFormState>(defaultSupplierForm);

  const filteredSuppliers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sortedSuppliers = [...suppliers].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    if (!normalized) return sortedSuppliers;

    return sortedSuppliers.filter((supplier) =>
      getSearchText(supplier).includes(normalized),
    );
  }, [query, suppliers]);

  const duplicateSupplier = useMemo(
    () => findDuplicateSupplier(suppliers, form, editingSupplierId),
    [editingSupplierId, form, suppliers],
  );

  const mergeTargetOptions = useMemo(
    () => getSupplierMergeOptions(suppliers, mergeTargetQuery),
    [mergeTargetQuery, suppliers],
  );
  const mergeSourceOptions = useMemo(
    () => getSupplierMergeOptions(suppliers, mergeSourceQuery),
    [mergeSourceQuery, suppliers],
  );

  const openCreateModal = () => {
    setEditingSupplierId(null);
    setForm(defaultSupplierForm);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setForm(toSupplierForm(supplier));
    setIsCreateModalOpen(true);
  };

  const resetMergeModal = () => {
    setIsMergeModalOpen(false);
    setMergeTargetQuery('');
    setMergeSourceQuery('');
    setMergeTargetId('');
    setMergeSourceId('');
    setShowMergeTargetSuggestions(false);
    setShowMergeSourceSuggestions(false);
  };

  const handleSaveSupplier = async () => {
    const payload = toSupplierPayload(form);

    if (!payload.name || !payload.phone) return;

    const isSuccess = editingSupplierId
      ? await onUpdateSupplier(editingSupplierId, payload)
      : await onCreateSupplier(payload);

    if (!isSuccess) return;
    setIsCreateModalOpen(false);
  };

  const handleMergeSuppliers = async () => {
    if (!mergeTargetId || !mergeSourceId || mergeTargetId === mergeSourceId) {
      return;
    }

    const isSuccess = await onMergeSuppliers(mergeTargetId, mergeSourceId);
    if (!isSuccess) return;

    resetMergeModal();
  };

  const handleMergeQueryChange = (
    field: SupplierSuggestionField,
    value: string,
  ) => {
    if (field === 'target') {
      setMergeTargetQuery(value);
      setMergeTargetId('');
      setShowMergeTargetSuggestions(true);
      return;
    }

    setMergeSourceQuery(value);
    setMergeSourceId('');
    setShowMergeSourceSuggestions(true);
  };

  const handleMergeSupplierSelect = (
    field: SupplierSuggestionField,
    supplier: Supplier,
  ) => {
    if (field === 'target') {
      setMergeTargetId(supplier.id);
      setMergeTargetQuery(getSupplierLabel(supplier));
      setShowMergeTargetSuggestions(false);
      return;
    }

    setMergeSourceId(supplier.id);
    setMergeSourceQuery(getSupplierLabel(supplier));
    setShowMergeSourceSuggestions(false);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(clientsSuppliersTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  return (
    <section className='panel clients-workspace'>
      <ClientsSuppliersTabs activeTab={activeTab} onChange={setActiveTab} />

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
        <SuppliersWorkspace
          query={query}
          suppliers={filteredSuppliers}
          onQueryChange={setQuery}
          onOpenCreateModal={openCreateModal}
          onOpenEditModal={openEditModal}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
        />
      )}

      {isCreateModalOpen ? (
        <SupplierEditorModal
          duplicateSupplier={duplicateSupplier}
          editingSupplierId={editingSupplierId}
          form={form}
          isSaving={isSaving}
          onChange={setForm}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={() => void handleSaveSupplier()}
        />
      ) : null}

      {isMergeModalOpen ? (
        <SupplierMergeModal
          isSaving={isSaving}
          sourceId={mergeSourceId}
          sourceOptions={mergeSourceOptions}
          sourceQuery={mergeSourceQuery}
          targetId={mergeTargetId}
          targetOptions={mergeTargetOptions}
          targetQuery={mergeTargetQuery}
          showSourceSuggestions={showMergeSourceSuggestions}
          showTargetSuggestions={showMergeTargetSuggestions}
          onClose={resetMergeModal}
          onQueryChange={handleMergeQueryChange}
          onSelectSupplier={handleMergeSupplierSelect}
          onMerge={() => void handleMergeSuppliers()}
        />
      ) : null}
    </section>
  );
};

const ClientsSuppliersTabs = ({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) => (
  <div className='orders-tabs' role='tablist' aria-label='Clients and suppliers'>
    {clientsSuppliersTabs.map((tab) => (
      <button
        key={tab.key}
        type='button'
        className={
          activeTab === tab.key
            ? 'orders-tab orders-tab-active'
            : 'orders-tab'
        }
        onClick={() => onChange(tab.key)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

const SuppliersWorkspace = ({
  query,
  suppliers,
  onQueryChange,
  onOpenCreateModal,
  onOpenEditModal,
  onOpenMergeModal,
}: {
  query: string;
  suppliers: Supplier[];
  onQueryChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (supplier: Supplier) => void;
  onOpenMergeModal: () => void;
}) => (
  <>
    <SuppliersToolbar
      query={query}
      onQueryChange={onQueryChange}
      onOpenCreateModal={onOpenCreateModal}
      onOpenMergeModal={onOpenMergeModal}
    />
    <SuppliersTable suppliers={suppliers} onOpenEditModal={onOpenEditModal} />
  </>
);

const SuppliersToolbar = ({
  query,
  onQueryChange,
  onOpenCreateModal,
  onOpenMergeModal,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenMergeModal: () => void;
}) => (
  <div className='orders-toolbar clients-toolbar'>
    <div className='orders-toolbar-left'>
      <div className='orders-search-group orders-search-group-clearable clients-search-group'>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder='Search by name, phone or supplier order'
        />
        {query ? (
          <span
            role='button'
            tabIndex={0}
            className='orders-search-clear'
            aria-label='Clear search text'
            onClick={() => onQueryChange('')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onQueryChange('');
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
        onClick={onOpenMergeModal}
      >
        Merge
      </button>
      <button
        type='button'
        className='primary-button'
        onClick={onOpenCreateModal}
      >
        Create supplier
      </button>
    </div>
  </div>
);

const SuppliersTable = ({
  suppliers,
  onOpenEditModal,
}: {
  suppliers: Supplier[];
  onOpenEditModal: (supplier: Supplier) => void;
}) => (
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
        {suppliers.map((supplier) => (
          <tr
            key={supplier.id}
            className='clients-table-row'
            onClick={() => onOpenEditModal(supplier)}
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
    {suppliers.length === 0 ? (
      <p className='empty-state'>No suppliers found.</p>
    ) : null}
  </div>
);

const SupplierEditorModal = ({
  duplicateSupplier,
  editingSupplierId,
  form,
  isSaving,
  onChange,
  onClose,
  onSave,
}: {
  duplicateSupplier?: Supplier;
  editingSupplierId: string | null;
  form: SupplierFormState;
  isSaving: boolean;
  onChange: (form: SupplierFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) => {
  const isEditing = Boolean(editingSupplierId);
  const canSave =
    !isSaving &&
    !duplicateSupplier &&
    Boolean(form.name.trim()) &&
    Boolean(form.phone.trim());
  const updateForm = <K extends keyof SupplierFormState>(
    field: K,
    value: SupplierFormState[K],
  ) => onChange({ ...form, [field]: value });

  return (
    <ModalShell
      title={isEditing ? 'Edit supplier' : 'Create supplier'}
      onClose={onClose}
    >
      <div className='catalog-edit-body clients-modal-body'>
        <label className='field field-wide'>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => updateForm('name', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => updateForm('phone', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>Supplier order</span>
          <input
            value={form.supplierOrder}
            onChange={(event) =>
              updateForm('supplierOrder', event.target.value)
            }
          />
        </label>
        <label className='field field-wide'>
          <span>Note</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => updateForm('note', event.target.value)}
          />
        </label>
        <label className='field field-wide'>
          <span>Status</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) =>
              updateForm('isActive', event.target.value === 'active')
            }
          >
            <option value='active'>active</option>
            <option value='inactive'>inactive</option>
          </select>
        </label>
        {duplicateSupplier ? (
          <p className='error-message'>
            Supplier with same phone or name already exists:{' '}
            {duplicateSupplier.name}
          </p>
        ) : null}
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={!canSave}
          onClick={onSave}
        >
          {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Create'}
        </button>
      </footer>
    </ModalShell>
  );
};

const SupplierMergeModal = ({
  isSaving,
  sourceId,
  sourceOptions,
  sourceQuery,
  targetId,
  targetOptions,
  targetQuery,
  showSourceSuggestions,
  showTargetSuggestions,
  onClose,
  onQueryChange,
  onSelectSupplier,
  onMerge,
}: {
  isSaving: boolean;
  sourceId: string;
  sourceOptions: Supplier[];
  sourceQuery: string;
  targetId: string;
  targetOptions: Supplier[];
  targetQuery: string;
  showSourceSuggestions: boolean;
  showTargetSuggestions: boolean;
  onClose: () => void;
  onQueryChange: (field: SupplierSuggestionField, value: string) => void;
  onSelectSupplier: (
    field: SupplierSuggestionField,
    supplier: Supplier,
  ) => void;
  onMerge: () => void;
}) => {
  const canMerge =
    !isSaving && Boolean(targetId) && Boolean(sourceId) && targetId !== sourceId;

  return (
    <ModalShell title='Merge suppliers' onClose={onClose}>
      <div className='catalog-edit-body clients-modal-body'>
        <p className='muted-copy'>
          Select Supplier 1 and Supplier 2. Data from Supplier 2 will be merged
          into Supplier 1, then Supplier 2 will be removed.
        </p>
        <SupplierMergeField
          label='Supplier 1'
          options={targetOptions}
          query={targetQuery}
          showSuggestions={showTargetSuggestions}
          onQueryChange={(value) => onQueryChange('target', value)}
          onSelectSupplier={(supplier) => onSelectSupplier('target', supplier)}
        />
        <SupplierMergeField
          label='Supplier 2'
          options={sourceOptions}
          query={sourceQuery}
          showSuggestions={showSourceSuggestions}
          onQueryChange={(value) => onQueryChange('source', value)}
          onSelectSupplier={(supplier) => onSelectSupplier('source', supplier)}
        />
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={!canMerge}
          onClick={onMerge}
        >
          {isSaving ? 'Merging...' : 'Merge suppliers'}
        </button>
      </footer>
    </ModalShell>
  );
};

const SupplierMergeField = ({
  label,
  options,
  query,
  showSuggestions,
  onQueryChange,
  onSelectSupplier,
}: {
  label: string;
  options: Supplier[];
  query: string;
  showSuggestions: boolean;
  onQueryChange: (value: string) => void;
  onSelectSupplier: (supplier: Supplier) => void;
}) => (
  <>
    <label className='field field-wide modal-suggestions-anchor'>
      <span>{label}</span>
      <input
        value={query}
        placeholder='Enter name or phone'
        onChange={(event) => onQueryChange(event.target.value)}
      />
    </label>
    {showSuggestions && options.length > 0 ? (
      <SupplierSuggestions
        options={options}
        onSelectSupplier={onSelectSupplier}
      />
    ) : null}
  </>
);

const SupplierSuggestions = ({
  options,
  onSelectSupplier,
}: {
  options: Supplier[];
  onSelectSupplier: (supplier: Supplier) => void;
}) => (
  <div className='suggestions-panel'>
    {options.map((supplier) => (
      <button
        key={supplier.id}
        type='button'
        className='suggestion-item'
        onClick={() => onSelectSupplier(supplier)}
      >
        <strong>{supplier.name}</strong>
        <span>{supplier.phone}</span>
      </button>
    ))}
  </div>
);

const ModalShell = ({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) => (
  <div className='modal-backdrop' role='presentation' onClick={onClose}>
    <article
      className='catalog-edit-modal clients-modal'
      role='dialog'
      aria-modal='true'
      onClick={(event) => event.stopPropagation()}
    >
      <header className='catalog-edit-header'>
        <h2>{title}</h2>
        <button type='button' className='ghost-button' onClick={onClose}>
          x
        </button>
      </header>
      {children}
    </article>
  </div>
);
