import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../model/types';
import { createWarehouseShipment } from '../api/shipmentApi';
import {
  getSaleProductArticle,
  getSaleProductName,
  getSaleProductSerialNumber,
} from '../lib/sale-product';

interface SerialNumber {
  id: string;
  serialNumber: string;
  warehouse: string;
  isAvailable: boolean;
}

interface SerialNumberModalProps {
  sale: Sale;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedSerials: string[]) => void;
}

export const SerialNumberModal = ({
  sale,
  isOpen,
  onClose,
  onConfirm,
}: SerialNumberModalProps) => {
  const { t } = useTranslation();
  const [selectedSerials, setSelectedSerials] = useState<string[]>(
    [],
  );
  const [availableSerials, setAvailableSerials] = useState<
    SerialNumber[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const productName = getSaleProductName(
    sale,
    t('warehouse.serialModal.productFallback'),
  );
  const productArticle = getSaleProductArticle(sale);
  const productSerialNumber = getSaleProductSerialNumber(sale) || sale.id;

  // Mock data - in real app, this would come from API
  useEffect(() => {
    if (isOpen) {
      // Generate mock available serial numbers based on product quantity
      const mockSerials: SerialNumber[] = [];
      for (let i = 0; i < sale.quantity; i++) {
        mockSerials.push({
          id: `serial-${sale.id}-${i}`,
          serialNumber: `${productSerialNumber}-${String(i + 1).padStart(3, '0')}`,
          warehouse: t('warehouse.serialModal.mainWarehouse'),
          isAvailable: true,
        });
      }
      // Use setTimeout to avoid cascading renders
      setTimeout(() => {
        setAvailableSerials(mockSerials);
        setSelectedSerials([]);
      }, 0);
    }
  }, [isOpen, productSerialNumber, sale, t]);

  const handleSerialToggle = (serialNumber: string) => {
    setSelectedSerials((prev) => {
      if (prev.includes(serialNumber)) {
        return prev.filter((s) => s !== serialNumber);
      } else {
        // Limit selection to the quantity of the sale
        if (prev.length < sale.quantity) {
          return [...prev, serialNumber];
        }
        return prev;
      }
    });
  };

  const handleConfirm = async () => {
    if (selectedSerials.length === sale.quantity) {
      setIsLoading(true);
      setError(null);

      try {
        // In a real app, you would pass the actual shipment data
        const response = await createWarehouseShipment();

        if (response.success) {
          setIsSuccess(true);
          // Call the parent component's onConfirm with selected serials
          onConfirm(selectedSerials);

          // Close modal after a short delay to show success message
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError(
            response.message ||
              t('warehouse.serialModal.errors.createShipmentFailed'),
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('warehouse.serialModal.errors.shipmentError'),
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedSerials.length === sale.quantity) {
      setSelectedSerials([]);
    } else {
      setSelectedSerials(availableSerials.map((s) => s.serialNumber));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='modal-backdrop'
      role='presentation'
      onClick={onClose}
    >
      <section
        className='catalog-edit-modal'
        role='dialog'
        aria-modal='true'
        aria-label={t('warehouse.serialModal.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='catalog-edit-header'>
          <h2>{t('warehouse.serialModal.title')}</h2>
          <button
            type='button'
            className='catalog-edit-close'
            onClick={onClose}
            aria-label={t('warehouse.serialModal.closeModal')}
          >
            &times;
          </button>
        </div>

        <div className='catalog-edit-body'>
          {isSuccess ? (
            <div className='success-message'>
              <div className='success-icon'>✓</div>
              <h3>{t('warehouse.serialModal.successTitle')}</h3>
              <p>{t('warehouse.serialModal.successDescription')}</p>
            </div>
          ) : (
            <>
              <div className='sale-info'>
                <h3>{productName}</h3>
                <p>
                  {t('warehouse.serialModal.quantity', {
                    count: sale.quantity,
                  })}
                </p>
                <p>
                  {t('warehouse.serialModal.article', {
                    value: productArticle || '-',
                  })}
                </p>
              </div>

              {error && (
                <div className='error-message'>
                  <div className='error-icon'>⚠</div>
                  <p>{error}</p>
                </div>
              )}

              <div className='serial-selection-header'>
                <div className='selection-info'>
                  <span>
                    {t('warehouse.serialModal.selectedCount', {
                      selected: selectedSerials.length,
                      total: sale.quantity,
                    })}
                  </span>
                  <button
                    type='button'
                    className='select-all-button'
                    onClick={handleSelectAll}
                    disabled={isLoading}
                  >
                    {selectedSerials.length === sale.quantity
                      ? t('warehouse.serialModal.deselectAll')
                      : t('warehouse.serialModal.selectAll')}
                  </button>
                </div>
              </div>

              <div className='serial-list'>
                {availableSerials.map((serial, index) => (
                  <div
                    key={serial.id}
                    className={`serial-item ${selectedSerials.includes(serial.serialNumber) ? 'selected' : ''}`}
                    onClick={() =>
                      handleSerialToggle(serial.serialNumber)
                    }
                  >
                    <div className='serial-item-header'>
                      <span className='serial-item-number'>
                        {t('warehouse.serialModal.itemNumber', {
                          number: index + 1,
                        })}
                      </span>
                      <input
                        type='checkbox'
                        checked={selectedSerials.includes(
                          serial.serialNumber,
                        )}
                        onChange={() =>
                          handleSerialToggle(serial.serialNumber)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className='serial-info'>
                      <span className='serial-number'>
                        {serial.serialNumber}
                      </span>
                      <span className='serial-warehouse'>
                        {serial.warehouse}
                      </span>
                    </div>
                    {selectedSerials.includes(
                      serial.serialNumber,
                    ) && <span className='checkmark'>✓</span>}
                  </div>
                ))}
              </div>

              {selectedSerials.length > 0 && (
                <div className='selected-summary'>
                  <h4>{t('warehouse.serialModal.selectedSerialNumbers')}</h4>
                  <div className='selected-list'>
                    {selectedSerials.map((serial, index) => (
                      <div key={index} className='selected-item'>
                        <span className='selected-item-number'>
                          {index + 1}.
                        </span>
                        <span className='selected-serial'>
                          {serial}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className='catalog-edit-footer'>
          <div className='catalog-edit-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
            >
              {t('warehouse.serialModal.cancel')}
            </button>
            <button
              type='button'
              className='primary-button'
              onClick={handleConfirm}
              disabled={selectedSerials.length !== sale.quantity}
            >
              {t('warehouse.serialModal.confirmShipment')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

// Theme-aware styles via design tokens (light + dark)
const styles = `
  .sale-info {
    background: var(--bg-surface-subtle);
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .sale-info h3 {
    margin: 0 0 8px 0;
    color: var(--color-text-heading);
    font-size: 1.1rem;
  }

  .sale-info p {
    margin: 4px 0;
    color: var(--color-text-body);
    font-size: 0.9rem;
  }

  .serial-selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--bg-panel-elevated);
    border-radius: 6px;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .select-all-button {
    background: var(--bg-button-secondary);
    color: var(--color-primary);
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .select-all-button:hover {
    background: var(--bg-button-secondary-hover);
  }

  .serial-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 400px;
    overflow-y: auto;
  }

  .serial-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1px solid var(--color-line-strong);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--bg-card);
  }

  .serial-item:hover {
    border-color: var(--color-line-input);
    background: var(--bg-surface-subtle);
  }

  .serial-item.selected {
    border-color: var(--color-primary);
    background: var(--bg-soft-primary);
  }

  .serial-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .serial-number {
    font-weight: 600;
    color: var(--color-text-heading);
  }

  .serial-warehouse {
    font-size: 0.85rem;
    color: var(--text-soft);
  }

  .checkmark {
    color: var(--color-primary);
    font-weight: bold;
    font-size: 1.1rem;
  }

  .catalog-edit-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: var(--text-soft);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  .catalog-edit-close:hover {
    color: var(--color-text-body);
  }

  .serial-item-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-bottom: 8px;
  }

  .serial-item-number {
    font-weight: 600;
    color: var(--color-text-heading);
    font-size: 0.9rem;
    min-width: 60px;
  }

  .selected-summary {
    margin-top: 24px;
    padding: 16px;
    background: var(--bg-soft-primary);
    border-radius: 8px;
    border: 1px solid var(--color-line-panel);
  }

  .selected-summary h4 {
    margin: 0 0 12px 0;
    color: var(--color-primary-strong);
    font-size: 1rem;
    font-weight: 600;
  }

  .selected-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .selected-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-card);
    border-radius: 6px;
    border: 1px solid var(--color-line-strong);
  }

  .selected-item-number {
    font-weight: 600;
    color: var(--color-text-heading);
    min-width: 20px;
  }

  .selected-serial {
    font-family: 'Courier New', monospace;
    color: var(--color-text-heading);
    font-size: 0.9rem;
  }

  .success-message {
    text-align: center;
    padding: 40px 20px;
    background: var(--bg-soft-success);
    border-radius: 8px;
    border: 1px solid var(--color-line-panel);
  }

  .success-icon {
    font-size: 3rem;
    color: var(--color-success-strong);
    margin-bottom: 16px;
  }

  .success-message h3 {
    color: var(--color-success-strong);
    margin: 0 0 12px 0;
    font-size: 1.3rem;
  }

  .success-message p {
    color: var(--color-success-strong);
    margin: 0;
    font-size: 1rem;
  }

  .error-message {
    background: var(--bg-soft-danger);
    border: 1px solid var(--color-line-panel);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .error-icon {
    font-size: 1.5rem;
    color: var(--color-danger);
    flex-shrink: 0;
  }

  .error-message p {
    color: var(--color-danger-soft);
    margin: 0;
    font-size: 0.95rem;
  }
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}
