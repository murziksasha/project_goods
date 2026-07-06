import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Supplier } from '../../../../../entities/supplier/model/types';
import { filterActiveSuppliers } from '../../../model/supplier-order-utils';
import { CompactPaginationPanel } from '../../../../../shared/ui/PaginationPanel';

const DEFAULT_PAGE_SIZE = 10;

type SupplierChooseModalProps = {
  isOpen: boolean;
  suppliers: Supplier[];
  onClose: () => void;
  onSelect: (supplier: Supplier) => void;
};

export const SupplierChooseModal = ({
  isOpen,
  suppliers,
  onClose,
  onSelect,
}: SupplierChooseModalProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }, [isOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const filteredSuppliers = useMemo(
    () => filterActiveSuppliers(suppliers, debouncedSearch),
    [debouncedSearch, suppliers],
  );

  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredSuppliers.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredSuppliers, page]);

  if (!isOpen) return null;

  return (
    <div className='supplier-order-inline-backdrop' role='presentation'>
      <section
        className='catalog-edit-modal clients-modal supplier-choose-modal'
        role='dialog'
        aria-modal='true'
      >
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <h2>{t('orders.supplier.modal.chooseSupplierTitle')}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </header>
        <div className='catalog-edit-body clients-modal-body supplier-choose-modal-body'>
          <label className='field field-wide supplier-choose-modal-search'>
            <span>{t('orders.supplier.toolbar.search')}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('orders.supplier.modal.chooseSupplierSearchPlaceholder')}
              autoFocus
            />
          </label>
          <div className='supplier-choose-modal-list' role='listbox'>
            {paginatedSuppliers.length > 0 ? (
              paginatedSuppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  type='button'
                  role='option'
                  className='create-suggestion-item supplier-choose-modal-item'
                  onClick={() => {
                    onSelect(supplier);
                    onClose();
                  }}
                >
                  <strong>{supplier.name}</strong>
                  <span>{supplier.phone}</span>
                </button>
              ))
            ) : (
              <p className='supplier-choose-modal-empty'>
                {t('orders.supplier.modal.chooseSupplierEmpty')}
              </p>
            )}
          </div>
          {filteredSuppliers.length > 0 ? (
            <div className='supplier-choose-modal-pagination'>
              <CompactPaginationPanel
                totalItems={filteredSuppliers.length}
                page={page}
                pageSize={DEFAULT_PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};