import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { hasEmployeePermission } from '../../../../entities/employee/model/permissions';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import { formatCurrency } from '../../../../shared/lib/format';
import { getSaleTotal } from '../../model/sales-analytics';
import { getSaleClientDisplayName } from '../../model/sale-client-display';
import { getSaleClientPhones } from '../../../../entities/client/lib/phone-match';
import {
  buildOrderNumber,
  formatPhoneNumber,
  getPrimaryDeviceName,
  kanbanVisibleRepairStatuses,
  normalizeOrderStatus,
  type OrderStatus,
  type RepairStatus,
} from '../orders/workspace/orders-workspace-shared';
import {
  columnDropId,
  groupRepairSalesByKanbanStatus,
  kanbanCollisionDetection,
  resolveKanbanDropStatus,
  shouldKeepKanbanPendingMove,
  type KanbanPendingMove,
} from './repair-kanban';

type RepairKanbanBoardProps = {
  sales: Sale[];
  employees: Employee[];
  canUpdateStatus: boolean;
  canUpdateMaster: boolean;
  onStatusChange: (sale: Sale, status: OrderStatus) => void | Promise<void>;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
  onOpenSale: (sale: Sale) => void;
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
  const clientPhone = sale.client ? getSaleClientPhones(sale)[0] ?? '' : '';
  const formattedClientPhone = clientPhone
    ? formatPhoneNumber(clientPhone)
    : '';
  const masterId = sale.master?.id ?? '';
  const hasLineItems = Array.isArray(sale.lineItems) && sale.lineItems.length > 0;
  const orderTotal = hasLineItems ? getSaleTotal(sale) : 0;

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
      <span className="repair-kanban-card-header">
        <span className="repair-kanban-card-number">#{orderNumber}</span>
        {formattedClientPhone ? (
          <strong className="repair-kanban-card-phone">
            {formattedClientPhone}
          </strong>
        ) : null}
      </span>
      <span className="repair-kanban-card-client">{clientName}</span>
      <span className="repair-kanban-card-device">{deviceName || '—'}</span>
      {hasLineItems ? (
        <span className="repair-kanban-card-total">
          {formatCurrency(orderTotal)}
        </span>
      ) : null}
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

const DraggableKanbanCard = ({
  sale,
  canUpdateStatus,
  masterOptions,
  canUpdateMaster,
  onOpen,
  onMasterChange,
}: {
  sale: Sale;
  canUpdateStatus: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: sale.id,
    data: { sale },
    disabled: !canUpdateStatus,
  });

  return (
    <div
      ref={setNodeRef}
      className={
        isDragging
          ? 'repair-kanban-card-shell repair-kanban-card-shell-dragging'
          : 'repair-kanban-card-shell'
      }
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
  showPlaceholder,
  isOver,
  canUpdateStatus,
  masterOptions,
  canUpdateMaster,
  onOpenSale,
  onMasterChange,
}: {
  status: RepairStatus;
  sales: Sale[];
  showPlaceholder: boolean;
  isOver: boolean;
  canUpdateStatus: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  onOpenSale: (sale: Sale) => void;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
}) => {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: columnDropId(status),
    data: { status },
  });

  return (
    <section
      ref={setNodeRef}
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
      <div className="repair-kanban-column-body">
        {showPlaceholder ? (
          <div className="repair-kanban-drop-placeholder" />
        ) : null}
        {sales.map((sale) => (
          <DraggableKanbanCard
            key={sale.id}
            sale={sale}
            canUpdateStatus={canUpdateStatus}
            masterOptions={masterOptions}
            canUpdateMaster={canUpdateMaster}
            onOpen={onOpenSale}
            onMasterChange={onMasterChange}
          />
        ))}
        {sales.length === 0 && !showPlaceholder ? (
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
  const [overStatus, setOverStatus] = useState<RepairStatus | null>(null);
  const [pendingMove, setPendingMove] = useState<KanbanPendingMove | null>(
    null,
  );
  const salesRef = useRef(sales);
  const moveGeneration = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint:
        typeof window !== 'undefined' &&
        window.matchMedia?.('(pointer: coarse)').matches
          ? { delay: 180, tolerance: 8 }
          : { distance: 6 },
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

  useEffect(() => {
    salesRef.current = sales;
    setPendingMove((current) =>
      shouldKeepKanbanPendingMove(sales, current) ? current : null,
    );
  }, [sales]);

  const columns = useMemo(
    () => groupRepairSalesByKanbanStatus(sales, pendingMove),
    [pendingMove, sales],
  );

  const saleById = useMemo(() => {
    const map = new Map<string, Sale>();
    sales.forEach((sale) => map.set(sale.id, sale));
    return map;
  }, [sales]);

  const activeSourceStatus = activeSale
    ? pendingMove?.saleId === activeSale.id
      ? pendingMove.status
      : (normalizeOrderStatus(activeSale.status) as RepairStatus)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    const sale = saleById.get(String(event.active.id));
    setActiveSale(sale ?? null);
    if (sale) {
      setOverStatus(
        pendingMove?.saleId === sale.id
          ? pendingMove.status
          : (normalizeOrderStatus(sale.status) as RepairStatus),
      );
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const nextStatus = resolveKanbanDropStatus(
      event.over?.id ? String(event.over.id) : null,
      saleById,
      pendingMove,
    );
    setOverStatus(nextStatus);
  };

  const waitForSaleStatus = async (
    saleId: string,
    status: RepairStatus,
    timeoutMs = 400,
  ) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const current = salesRef.current.find((item) => item.id === saleId);
      if (current && normalizeOrderStatus(current.status) === status) {
        return true;
      }
      await new Promise((resolve) => {
        window.setTimeout(resolve, 16);
      });
    }
    return false;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const sale = saleById.get(String(event.active.id));
    const nextStatus = resolveKanbanDropStatus(
      event.over?.id ? String(event.over.id) : null,
      saleById,
      pendingMove,
    );
    setActiveSale(null);
    setOverStatus(null);

    if (!sale || !canUpdateStatus || !nextStatus) return;

    const currentStatus =
      pendingMove?.saleId === sale.id
        ? pendingMove.status
        : (normalizeOrderStatus(sale.status) as RepairStatus);
    if (currentStatus === nextStatus) return;

    const move: KanbanPendingMove = { saleId: sale.id, status: nextStatus };
    setPendingMove(move);
    moveGeneration.current += 1;
    const generation = moveGeneration.current;

    void (async () => {
      try {
        await onStatusChange(sale, nextStatus);
        const matched = await waitForSaleStatus(sale.id, nextStatus);
        if (generation !== moveGeneration.current) return;
        if (!matched) {
          setPendingMove((current) =>
            current?.saleId === sale.id && current.status === nextStatus
              ? null
              : current,
          );
        }
      } catch {
        if (generation !== moveGeneration.current) return;
        setPendingMove((current) =>
          current?.saleId === sale.id ? null : current,
        );
      }
    })();
  };

  const clearDragState = () => {
    setActiveSale(null);
    setOverStatus(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <div className="repair-kanban-board" data-testid="repair-kanban-board">
        {kanbanVisibleRepairStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            sales={columns.get(status) ?? []}
            showPlaceholder={Boolean(
              activeSale &&
                overStatus === status &&
                activeSourceStatus !== status,
            )}
            isOver={Boolean(activeSale && overStatus === status)}
            canUpdateStatus={canUpdateStatus}
            masterOptions={masterOptions}
            canUpdateMaster={canUpdateMaster}
            onOpenSale={onOpenSale}
            onMasterChange={onMasterChange}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeSale ? (
          <div className="repair-kanban-drag-overlay">
            <KanbanCard
              sale={activeSale}
              isDragging
              masterOptions={masterOptions}
              canUpdateMaster={false}
              onOpen={() => undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
