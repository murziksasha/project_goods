import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../entities/sale/model/types';
import {
  buildOrderNumber,
  kanbanVisibleRepairStatuses,
  normalizeOrderStatus,
  type OrderStatus,
  type RepairStatus,
} from '../orders/workspace/orders-workspace-shared';

type RepairKanbanMoveSheetProps = {
  sale: Sale;
  onClose: () => void;
  onMove: (sale: Sale, status: OrderStatus) => void;
};

export const RepairKanbanMoveSheet = ({
  sale,
  onClose,
  onMove,
}: RepairKanbanMoveSheetProps) => {
  const { t } = useTranslation();
  const current = normalizeOrderStatus(sale.status) as RepairStatus;
  const number = buildOrderNumber(sale);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="repair-kanban-move-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="repair-kanban-move-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('orders.kanban.moveOrder', { number })}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="repair-kanban-move-sheet-header">
          <h3>{t('orders.kanban.moveTo')}</h3>
          <button
            type="button"
            className="ghost-button"
            onClick={onClose}
          >
            {t('orders.kanban.closeMove')}
          </button>
        </div>
        <p className="repair-kanban-move-sheet-sub">#{number}</p>
        <div className="repair-kanban-move-sheet-list">
          {kanbanVisibleRepairStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={
                status === current
                  ? 'repair-kanban-move-option repair-kanban-move-option-current'
                  : 'repair-kanban-move-option'
              }
              data-status={status}
              disabled={status === current}
              onClick={() => {
                onMove(sale, status);
                onClose();
              }}
            >
              <span className="repair-kanban-nav-chip-swatch" aria-hidden />
              {t(`orders.status.repair.${status}`)}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};
