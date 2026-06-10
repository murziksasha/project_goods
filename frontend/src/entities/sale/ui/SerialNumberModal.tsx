import { useState, useEffect } from 'react';
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
  const [selectedSerials, setSelectedSerials] = useState<string[]>(
    [],
  );
  const [availableSerials, setAvailableSerials] = useState<
    SerialNumber[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const productName = getSaleProductName(sale, 'Product');
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
          warehouse: 'Main Warehouse',
          isAvailable: true,
        });
      }
      // Use setTimeout to avoid cascading renders
      setTimeout(() => {
        setAvailableSerials(mockSerials);
        setSelectedSerials([]);
      }, 0);
    }
  }, [isOpen, productSerialNumber, sale]);

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
          setError(response.message || 'Failed to create shipment');
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred during shipment',
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
        aria-label='Select Serial Numbers'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='catalog-edit-header'>
          <h2>Select Serial Numbers</h2>
          <button
            type='button'
            className='catalog-edit-close'
            onClick={onClose}
            aria-label='Close modal'
          >
            &times;
          </button>
        </div>

        <div className='catalog-edit-body'>
          {isSuccess ? (
            <div className='success-message'>
              <div className='success-icon'>✓</div>
              <h3>Shipment Created Successfully!</h3>
              <p>
                The serial numbers have been assigned and shipment is
                ready.
              </p>
            </div>
          ) : (
            <>
              <div className='sale-info'>
                <h3>{productName}</h3>
                <p>Quantity: {sale.quantity}</p>
                <p>Article: {productArticle || '-'}</p>
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
                    Selected: {selectedSerials.length}/{sale.quantity}
                  </span>
                  <button
                    type='button'
                    className='select-all-button'
                    onClick={handleSelectAll}
                    disabled={isLoading}
                  >
                    {selectedSerials.length === sale.quantity
                      ? 'Deselect All'
                      : 'Select All'}
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
                        Item {index + 1}
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
                  <h4>Selected Serial Numbers:</h4>
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
              Cancel
            </button>
            <button
              type='button'
              className='primary-button'
              onClick={handleConfirm}
              disabled={selectedSerials.length !== sale.quantity}
            >
              Confirm Shipment
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

// Add CSS styles for the modal
const styles = `
  .sale-info {
    background: #f8fafc;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .sale-info h3 {
    margin: 0 0 8px 0;
    color: #2d3748;
    font-size: 1.1rem;
  }

  .sale-info p {
    margin: 4px 0;
    color: #4a5568;
    font-size: 0.9rem;
  }

  .serial-selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px;
    background: #f7f9fb;
    border-radius: 6px;
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .select-all-button {
    background: #e5edf8;
    color: #2d8ae3;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .select-all-button:hover {
    background: #dcecff;
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
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fff;
  }

  .serial-item:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
  }

  .serial-item.selected {
    border-color: #2d8ae3;
    background: #eef6ff;
  }

  .serial-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .serial-number {
    font-weight: 600;
    color: #2d3748;
  }

  .serial-warehouse {
    font-size: 0.85rem;
    color: #718096;
  }

  .checkmark {
    color: #2d8ae3;
    font-weight: bold;
    font-size: 1.1rem;
  }

  .catalog-edit-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: #a0aec0;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }

  .catalog-edit-close:hover {
    color: #4a5568;
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
    color: #2d3748;
    font-size: 0.9rem;
    min-width: 60px;
  }

  .selected-summary {
    margin-top: 24px;
    padding: 16px;
    background: #f0f7ff;
    border-radius: 8px;
    border: 1px solid #bfdbfe;
  }

  .selected-summary h4 {
    margin: 0 0 12px 0;
    color: #1e40af;
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
    background: #fff;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .selected-item-number {
    font-weight: 600;
    color: #2d3748;
    min-width: 20px;
  }

  .selected-serial {
    font-family: 'Courier New', monospace;
    color: #1f2937;
    font-size: 0.9rem;
  }

  .success-message {
    text-align: center;
    padding: 40px 20px;
    background: #f0fdf4;
    border-radius: 8px;
    border: 1px solid #bbf7d0;
  }

  .success-icon {
    font-size: 3rem;
    color: #16a34a;
    margin-bottom: 16px;
  }

  .success-message h3 {
    color: #15803d;
    margin: 0 0 12px 0;
    font-size: 1.3rem;
  }

  .success-message p {
    color: #166534;
    margin: 0;
    font-size: 1rem;
  }

  .error-message {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .error-icon {
    font-size: 1.5rem;
    color: #dc2626;
    flex-shrink: 0;
  }

  .error-message p {
    color: #991b1b;
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
