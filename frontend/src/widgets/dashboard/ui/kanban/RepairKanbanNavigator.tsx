import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { RepairStatus } from '../orders/workspace/orders-workspace-shared';
import { kanbanVisibleRepairStatuses } from '../orders/workspace/orders-workspace-shared';
import { railDropId } from './repair-kanban';

type RepairKanbanNavigatorProps = {
  counts: Map<RepairStatus, number>;
  activeStatus: RepairStatus | null;
  overStatus: RepairStatus | null;
  isDragging: boolean;
  onSelect: (status: RepairStatus) => void;
};

const NavigatorChip = ({
  status,
  count,
  isActive,
  isOver,
  isDragging,
  onSelect,
}: {
  status: RepairStatus;
  count: number;
  isActive: boolean;
  isOver: boolean;
  isDragging: boolean;
  onSelect: (status: RepairStatus) => void;
}) => {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: railDropId(status),
    data: { status, rail: true },
    disabled: !isDragging,
  });
  const className = [
    'repair-kanban-nav-chip',
    isActive ? 'repair-kanban-nav-chip-active' : '',
    isOver ? 'repair-kanban-nav-chip-over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={className}
      data-status={status}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => onSelect(status)}
    >
      <span className="repair-kanban-nav-chip-swatch" aria-hidden />
      <span>{t(`orders.status.repair.${status}`)}</span>
      <strong>{count}</strong>
    </button>
  );
};

export const RepairKanbanNavigator = ({
  counts,
  activeStatus,
  overStatus,
  isDragging,
  onSelect,
}: RepairKanbanNavigatorProps) => {
  const { t } = useTranslation();

  return (
    <nav
      className={
        isDragging
          ? 'repair-kanban-navigator repair-kanban-navigator-dragging'
          : 'repair-kanban-navigator'
      }
      aria-label={t('orders.kanban.navigator')}
    >
      {kanbanVisibleRepairStatuses.map((status) => (
        <NavigatorChip
          key={status}
          status={status}
          count={counts.get(status) ?? 0}
          isActive={activeStatus === status}
          isOver={isDragging && overStatus === status}
          isDragging={isDragging}
          onSelect={onSelect}
        />
      ))}
    </nav>
  );
};
