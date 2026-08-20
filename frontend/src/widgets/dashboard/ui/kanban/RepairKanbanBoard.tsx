import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { hasEmployeePermission } from '../../../../entities/employee/model/permissions';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import { getSaleClientDisplayName } from '../../model/sale-client-display';
import {
  buildOrderNumber,
  getPrimaryDeviceName,
  kanbanVisibleRepairStatuses,
  normalizeOrderStatus,
  type OrderStatus,
  type RepairStatus,
} from '../orders/workspace/orders-workspace-shared';

type RepairKanbanBoardProps = {
  sales: Sale[];
  employees: Employee[];
  canUpdateStatus: boolean;
  canUpdateMaster: boolean;
  onStatusChange: (sale: Sale, status: OrderStatus) => void | Promise<void>;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
  onOpenSale: (sale: Sale) => void;
};

const columnDropId = (status: RepairStatus) => `column:${status}`;

const parseColumnDropId = (id: string): RepairStatus | null => {
  if (!id.startsWith('column:')) return null;
  return id.slice('column:'.length) as RepairStatus;
};

const stopCardInteraction = (
  event: ReactMouseEvent | ReactPointerEvent,
) => {
  event.stopPropagation();
};

const KanbanCard = ({
  sale,
  isDragging = false,
  masterOptions,
  canUpdateMaster,
  onOpen,
  onMasterChange,
}: {
  sale: Sale;
  isDragging?: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange?: (sale: Sale, masterId: string) => void;
}) => {
  const { t } = useTranslation();
  const orderNumber = buildOrderNumber(sale);
  const clientName = getSaleClientDisplayName(sale, t);
  const deviceName = getPrimaryDeviceName(sale);
  const masterId = sale.master?.id ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      className={
        isDragging
          ? 'repair-kanban-card repair-kanban-card-dragging'
          : 'repair-kanban-card'
      }
      onClick={() => onOpen(sale)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(sale);
        }
      }}
    >
      <span className="repair-kanban-card-number">#{orderNumber}</span>
      <span className="repair-kanban-card-client">{clientName}</span>
      <span className="repair-kanban-card-device">{deviceName || '—'}</span>
      <label
        className="repair-kanban-card-master"
        onClick={stopCardInteraction}
        onPointerDown={stopCardInteraction}
        onMouseDown={stopCardInteraction}
      >
        <span className="repair-kanban-card-master-label">
          {t('orders.columns.master')}
        </span>
        <select
          className="repair-kanban-card-master-select"
          value={masterId}
          disabled={!canUpdateMaster || !onMasterChange}
          aria-label={t('orders.detail.master')}
          onClick={stopCardInteraction}
          onPointerDown={stopCardInteraction}
          onMouseDown={stopCardInteraction}
          onChange={(event) => {
            event.stopPropagation();
            const nextMasterId = event.target.value;
            if (nextMasterId === masterId || !onMasterChange) return;
            void onMasterChange(sale, nextMasterId);
          }}
        >
          <option value="">{t('orders.detail.selectMaster')}</option>
          {masterOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};

const SortableKanbanCard = ({
  sale,
  masterOptions,
  canUpdateMaster,
  onOpen,
  onMasterChange,
}: {
  sale: Sale;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sale.id, data: { sale } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="repair-kanban-card-shell"
      {...attributes}
      {...listeners}
    >
      <KanbanCard
        sale={sale}
        masterOptions={masterOptions}
        canUpdateMaster={canUpdateMaster}
        onMasterChange={onMasterChange}
        onOpen={(nextSale) => {
          if (isDragging) return;
          onOpen(nextSale);
        }}
      />
    </div>
  );
};

const KanbanColumn = ({
  status,
  sales,
  masterOptions,
  canUpdateMaster,
  onOpenSale,
  onMasterChange,
}: {
  status: RepairStatus;
  sales: Sale[];
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  onOpenSale: (sale: Sale) => void;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
}) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: columnDropId(status),
    data: { status },
  });

  return (
    <section
      className={
        isOver
          ? 'repair-kanban-column repair-kanban-column-over'
          : 'repair-kanban-column'
      }
      aria-label={t(`orders.status.repair.${status}`)}
    >
      <header className="repair-kanban-column-header">
        <h3 className="repair-kanban-column-title">
          {t(`orders.status.repair.${status}`)}
        </h3>
        <span className="repair-kanban-column-count">{sales.length}</span>
      </header>
      <div ref={setNodeRef} className="repair-kanban-column-body">
        <SortableContext
          items={sales.map((sale) => sale.id)}
          strategy={verticalListSortingStrategy}
        >
          {sales.map((sale) => (
            <SortableKanbanCard
              key={sale.id}
              sale={sale}
              masterOptions={masterOptions}
              canUpdateMaster={canUpdateMaster}
              onOpen={onOpenSale}
              onMasterChange={onMasterChange}
            />
          ))}
        </SortableContext>
        {sales.length === 0 ? (
          <p className="repair-kanban-column-empty">—</p>
        ) : null}
      </div>
    </section>
  );
};

export const RepairKanbanBoard = ({
  sales,
  employees,
  canUpdateStatus,
  canUpdateMaster,
  onStatusChange,
  onMasterChange,
  onOpenSale,
}: RepairKanbanBoardProps) => {
  const [activeSale, setActiveSale] = useState<Sale | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const masterOptions = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.isActive &&
          (employee.role === 'master' ||
            hasEmployeePermission(employee, 'repairs.execute')),
      ),
    [employees],
  );

  const columns = useMemo(() => {
    const byStatus = new Map<RepairStatus, Sale[]>();
    for (const status of kanbanVisibleRepairStatuses) {
      byStatus.set(status, []);
    }

    for (const sale of sales) {
      const status = normalizeOrderStatus(sale.status) as RepairStatus;
      const bucket = byStatus.get(status);
      if (bucket) {
        bucket.push(sale);
      }
    }

    return byStatus;
  }, [sales]);

  const saleById = useMemo(() => {
    const map = new Map<string, Sale>();
    sales.forEach((sale) => map.set(sale.id, sale));
    return map;
  }, [sales]);

  const handleDragStart = (event: DragStartEvent) => {
    const sale = saleById.get(String(event.active.id));
    setActiveSale(sale ?? null);
  };

  const resolveTargetStatus = (event: DragEndEvent): RepairStatus | null => {
    const overId = event.over?.id ? String(event.over.id) : '';
    if (!overId) return null;

    const direct = parseColumnDropId(overId);
    if (direct) return direct;

    const overSale = saleById.get(overId);
    if (overSale) {
      return normalizeOrderStatus(overSale.status) as RepairStatus;
    }

    return null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const sale = saleById.get(String(event.active.id));
    setActiveSale(null);
    if (!sale || !canUpdateStatus) return;

    const nextStatus = resolveTargetStatus(event);
    if (!nextStatus) return;

    const current = normalizeOrderStatus(sale.status);
    if (current === nextStatus) return;

    void onStatusChange(sale, nextStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveSale(null)}
    >
      <div className="repair-kanban-board" data-testid="repair-kanban-board">
        {kanbanVisibleRepairStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            sales={columns.get(status) ?? []}
            masterOptions={masterOptions}
            canUpdateMaster={canUpdateMaster}
            onOpenSale={onOpenSale}
            onMasterChange={onMasterChange}
          />
        ))}
      </div>
      <DragOverlay>
        {activeSale ? (
          <KanbanCard
            sale={activeSale}
            isDragging
            masterOptions={masterOptions}
            canUpdateMaster={false}
            onOpen={() => undefined}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
