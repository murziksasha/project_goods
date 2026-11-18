import type React from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale, SaleLineItem } from '../../../../entities/sale';
import { formatCurrency } from '../../../../shared/lib/format';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';

export interface RequestLineItemsContentsProps {
  sale: Sale;
  onOpenSerial?: (item: SaleLineItem, serialNumber: string) => void;
}

export interface RequestContentsToggleProps {
  expanded: boolean;
  controlsId: string;
  label: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

export const RequestContentsToggle: React.FC<RequestContentsToggleProps> = ({
  expanded,
  controlsId,
  label,
  onClick,
}) => (
  <button
    type='button'
    className='create-side-request-toggle'
    onClick={onClick}
    aria-expanded={expanded}
    aria-controls={controlsId}
    aria-label={label}
  >
    <span className='create-side-request-chevron' aria-hidden='true'>
      {expanded ? '\u2303' : '\u2304'}
    </span>
  </button>
);

const serialsForItem = (item: SaleLineItem) =>
  (item.serialNumbers ?? [])
    .map((serial) => serial.trim())
    .filter(Boolean);

export const RequestLineItemsContents: React.FC<
  RequestLineItemsContentsProps
> = ({ sale, onOpenSerial }) => {
  const { t } = useTranslation();
  if (!sale.lineItems?.length) {
    return <p>{t('orders.create.sidePanel.noItems')}</p>;
  }

  return (['product', 'service'] as const).map((kind) => {
    const items = sale.lineItems.filter((item) => item.kind === kind);
    if (!items.length) return null;

    return (
      <section key={kind} className='create-side-request-group'>
        <h5>
          {t(
            kind === 'product'
              ? 'orders.detail.products'
              : 'orders.detail.services',
          )}
        </h5>
        <ul className='create-side-request-items'>
          {items.map((item) => (
            <li key={item.id} className='create-side-request-item'>
              <strong>{item.name}</strong>
              <dl className='create-side-request-amounts'>
                <div>
                  <dt>{t('orders.create.sidePanel.quantity')}</dt>
                  <dd>{item.quantity}</dd>
                </div>
                <div>
                  <dt>{t('orders.create.sidePanel.unitPrice')}</dt>
                  <dd>{formatCurrency(item.price)}</dd>
                </div>
                <div>
                  <dt>{t('orders.create.sidePanel.lineTotal')}</dt>
                  <dd>{formatCurrency(item.price * item.quantity)}</dd>
                </div>
              </dl>
              {kind === 'product' ? (
                <div className='create-side-request-serials'>
                  {serialsForItem(item).map((serial, index) => (
                    <CopyableValue
                      key={`${serial}-${index}`}
                      value={serial}
                      className='create-side-request-serial-copy'
                    >
                      <button
                        type='button'
                        className='create-side-request-serial'
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenSerial?.(item, serial);
                        }}
                      >
                        {serial}
                      </button>
                    </CopyableValue>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  });
};
