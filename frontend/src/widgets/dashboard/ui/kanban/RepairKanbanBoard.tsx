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
import { RepairKanbanMoveSheet } from './RepairKanbanMoveSheet';
import { RepairKanbanNavigator } from './RepairKanbanNavigator';
import {
  columnDropId,
  groupRepairSalesByKanbanStatus,
  kanbanCollapsedStorageKey,
  kanbanCollisionDetection,
  parseCollapsedKanbanColumns,
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
  canUpdateStatus,
  onOpen,
  onMasterChange,
  onMove,
}: {
  sale: Sale;
  isDragging?: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  canUpdateStatus: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange?: (sale: Sale, masterId: string) => void;
  onMove?: (sale: Sale) => void;
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
  const masterName =
    masterOptions.find((employee) => employee.id === masterId)?.name ?? '';

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
      <span className="repair-kanban-card-client" title={clientName}>
        {clientName}
      </span>
      <span className="repair-kanban-card-device" title={deviceName || undefined}>
        {deviceName || '—'}
      </span>
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
          title={masterName}
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
      {canUpdateStatus && onMove ? (
        <button
          type="button"
          className="repair-kanban-card-move"
          onClick={(event) => {
            event.stopPropagation();
            onMove(sale);
          }}
          onPointerDown={stopCardInteraction}
          onMouseDown={stopCardInteraction}
        >
          {t('orders.kanban.move')}
        </button>
      ) : null}
    </div>
  );
};

const DraggableKanbanCard = ({
  sale,
  canUpdateStatus,
  masterOptions,
  canUpdateMaster,
  isCoarsePointer,
  onOpen,
  onMasterChange,
  onMove,
}: {
  sale: Sale;
  canUpdateStatus: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  isCoarsePointer: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
  onMove: (sale: Sale) => void;
}) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: sale.id,
    data: { sale },
    disabled: !canUpdateStatus,
  });
  const handleListeners = isCoarsePointer ? listeners : undefined;
  const shellListeners = isCoarsePointer ? undefined : listeners;

  return (
    <div
      ref={setNodeRef}
      className={[
        'repair-kanban-card-shell',
        isDragging ? 'repair-kanban-card-shell-dragging' : '',
        isCoarsePointer && canUpdateStatus
          ? 'repair-kanban-card-shell-handle'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...attributes}
      {...shellListeners}
    >
      {isCoarsePointer && canUpdateStatus ? (
        <button
          type="button"
          className="repair-kanban-card-handle"
          aria-label={t('orders.kanban.dragHandle')}
          {...handleListeners}
          onClick={stopCardInteraction}
        >
          <span aria-hidden>⋮⋮</span>
        </button>
      ) : null}
      <KanbanCard
        sale={sale}
        masterOptions={masterOptions}
        canUpdateMaster={canUpdateMaster}
        canUpdateStatus={canUpdateStatus}
        onMasterChange={onMasterChange}
        onMove={onMove}
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
  collapsed,
  canUpdateStatus,
  masterOptions,
  canUpdateMaster,
  isCoarsePointer,
  onOpenSale,
  onMasterChange,
  onMove,
  onToggleCollapsed,
}: {
  status: RepairStatus;
  sales: Sale[];
  showPlaceholder: boolean;
  isOver: boolean;
  collapsed: boolean;
  canUpdateStatus: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  isCoarsePointer: boolean;
  onOpenSale: (sale: Sale) => void;
  onMasterChange: (sale: Sale, masterId: string) => void | Promise<void>;
  onMove: (sale: Sale) => void;
  onToggleCollapsed: (status: RepairStatus) => void;
}) => {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: columnDropId(status),
    data: { status },
  });
  const canCollapse = sales.length === 0;

  return (
    <section
      ref={setNodeRef}
      className={[
        'repair-kanban-column',
        isOver ? 'repair-kanban-column-over' : '',
        collapsed ? 'repair-kanban-column-collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-status={status}
      aria-label={t(`orders.status.repair.${status}`)}
    >
      <header className="repair-kanban-column-header">
        <h3 className="repair-kanban-column-title">
          {t(`orders.status.repair.${status}`)}
        </h3>
        <span className="repair-kanban-column-count">{sales.length}</span>
        {canCollapse || collapsed ? (
          <button
            type="button"
            className="repair-kanban-column-toggle"
            aria-label={
              collapsed
                ? t('orders.kanban.expandColumn')
                : t('orders.kanban.collapseColumn')
            }
            onClick={() => onToggleCollapsed(status)}
          >
            {collapsed ? '+' : '–'}
          </button>
        ) : null}
      </header>
      {collapsed ? null : (
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
              isCoarsePointer={isCoarsePointer}
              onOpen={onOpenSale}
              onMasterChange={onMasterChange}
              onMove={onMove}
            />
          ))}
          {sales.length === 0 && !showPlaceholder ? (
            <p className="repair-kanban-column-empty">—</p>
          ) : null}
        </div>
      )}
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
  const [moveSale, setMoveSale] = useState<Sale | null>(null);
  const [activeColumn, setActiveColumn] = useState<RepairStatus>('new');
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<RepairStatus>>(() => {
    if (typeof window === 'undefined') return new Set();
    return new Set(
      parseCollapsedKanbanColumns(
        window.localStorage.getItem(kanbanCollapsedStorageKey),
      ),
    );
  });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const salesRef = useRef(sales);
  const moveGeneration = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isCoarsePointer
        ? { delay: 120, tolerance: 12 }
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
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setIsCoarsePointer(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

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

  useEffect(() => {
    setCollapsed((current) => {
      const next = new Set(current);
      let changed = false;
      for (const status of kanbanVisibleRepairStatuses) {
        if ((columns.get(status)?.length ?? 0) > 0 && next.has(status)) {
          next.delete(status);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [columns]);

  useEffect(() => {
    window.localStorage.setItem(
      kanbanCollapsedStorageKey,
      JSON.stringify([...collapsed]),
    );
  }, [collapsed]);

  useEffect(() => {
    const root = boardRef.current;
    if (!root || typeof IntersectionObserver !== 'function') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const status = visible?.target.getAttribute('data-status') as
          | RepairStatus
          | null;
        if (status) setActiveColumn(status);
      },
      { root, threshold: [0.45, 0.7] },
    );
    const nodes = root.querySelectorAll('[data-status]');
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [columns, collapsed]);

  const saleById = useMemo(() => {
    const map = new Map<string, Sale>();
    sales.forEach((sale) => map.set(sale.id, sale));
    return map;
  }, [sales]);

  const counts = useMemo(() => {
    const map = new Map<RepairStatus, number>();
    for (const status of kanbanVisibleRepairStatuses) {
      map.set(status, columns.get(status)?.length ?? 0);
    }
    return map;
  }, [columns]);

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

  const applyStatusChange = (
    sale: Sale,
    nextStatus: RepairStatus,
  ) => {
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
    applyStatusChange(sale, nextStatus);
  };

  const clearDragState = () => {
    setActiveSale(null);
    setOverStatus(null);
  };

  const scrollToColumn = (status: RepairStatus) => {
    const column = boardRef.current?.querySelector(
      `[data-status="${status}"]`,
    );
    column?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' });
    setActiveColumn(status);
  };

  const toggleCollapsed = (status: RepairStatus) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else if ((columns.get(status)?.length ?? 0) === 0) next.add(status);
      return next;
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      autoScroll={{
        threshold: { x: 0.12, y: 0.18 },
        acceleration: 18,
        canScroll: (element) => element === boardRef.current,
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <RepairKanbanNavigator
        counts={counts}
        activeStatus={activeColumn}
        overStatus={overStatus}
        isDragging={Boolean(activeSale)}
        onSelect={scrollToColumn}
      />
      <div
        ref={boardRef}
        className="repair-kanban-board"
        data-testid="repair-kanban-board"
        data-dragging={activeSale ? 'true' : undefined}
      >
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
            collapsed={collapsed.has(status)}
            canUpdateStatus={canUpdateStatus}
            masterOptions={masterOptions}
            canUpdateMaster={canUpdateMaster}
            isCoarsePointer={isCoarsePointer}
            onOpenSale={onOpenSale}
            onMasterChange={onMasterChange}
            onMove={setMoveSale}
            onToggleCollapsed={toggleCollapsed}
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
              canUpdateStatus={false}
              onOpen={() => undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
      {moveSale ? (
        <RepairKanbanMoveSheet
          sale={moveSale}
          onClose={() => setMoveSale(null)}
          onMove={(sale, status) => applyStatusChange(sale, status as RepairStatus)}
        />
      ) : null}
    </DndContext>
  );
};
