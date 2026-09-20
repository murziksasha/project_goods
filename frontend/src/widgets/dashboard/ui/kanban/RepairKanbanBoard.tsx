import {
  Fragment,
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
  computeColumnRankAfterDrop,
  computeColumnRankAfterMove,
  groupRepairSalesByKanbanStatus,
  kanbanCollapsedStorageKey,
  kanbanCollisionDetection,
  kanbanSortKey,
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
  onStatusChange: (
    sale: Sale,
    status: OrderStatus,
  ) => void | Promise<void>;
  onMasterChange: (
    sale: Sale,
    masterId: string,
  ) => void | Promise<void>;
  onOpenSale: (sale: Sale) => void;
  onRankChange?: (
    updates: Array<{ saleId: string; kanbanRank: number }>,
  ) => void | Promise<void>;
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
  isFirst,
  isLast,
  onOpen,
  onMasterChange,
  onMove,
  onRankUp,
  onRankDown,
}: {
  sale: Sale;
  isDragging?: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  canUpdateStatus: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange?: (sale: Sale, masterId: string) => void;
  onMove?: (sale: Sale) => void;
  onRankUp?: (sale: Sale) => void;
  onRankDown?: (sale: Sale) => void;
}) => {
  const { t } = useTranslation();
  const orderNumber = buildOrderNumber(sale);
  const clientName = getSaleClientDisplayName(sale, t);
  const deviceName = getPrimaryDeviceName(sale);
  const clientPhone = sale.client
    ? (getSaleClientPhones(sale)[0] ?? '')
    : '';
  const formattedClientPhone = clientPhone
    ? formatPhoneNumber(clientPhone)
    : '';
  const masterId = sale.master?.id ?? '';
  const hasLineItems =
    Array.isArray(sale.lineItems) && sale.lineItems.length > 0;
  const orderTotal = hasLineItems ? getSaleTotal(sale) : 0;
  const masterName =
    masterOptions.find((employee) => employee.id === masterId)
      ?.name ?? '';

  return (
    <div
      role='button'
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
      <span className='repair-kanban-card-header'>
        <span className='repair-kanban-card-number'>
          #{orderNumber}
        </span>
        {formattedClientPhone ? (
          <strong className='repair-kanban-card-phone'>
            {formattedClientPhone}
          </strong>
        ) : null}
      </span>
      <span className='repair-kanban-card-client' title={clientName}>
        {clientName}
      </span>
      <span
        className='repair-kanban-card-device'
        title={deviceName || undefined}
      >
        {deviceName || '—'}
      </span>
      {hasLineItems ? (
        <span className='repair-kanban-card-total'>
          {formatCurrency(orderTotal)}
        </span>
      ) : null}
      <label
        className='repair-kanban-card-master'
        onClick={stopCardInteraction}
        onPointerDown={stopCardInteraction}
        onMouseDown={stopCardInteraction}
      >
        <span className='repair-kanban-card-master-label'>
          {t('orders.columns.master')}
        </span>
        <select
          className='repair-kanban-card-master-select'
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
          <option value=''>{t('orders.detail.selectMaster')}</option>
          {masterOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      {canUpdateStatus ? (
        <span className='repair-kanban-card-actions'>
          {onRankUp && !isFirst ? (
            <button
              type='button'
              className='repair-kanban-card-rank-btn repair-kanban-card-up'
              aria-label={t('orders.kanban.moveUp')}
              onClick={(event) => {
                event.stopPropagation();
                onRankUp(sale);
              }}
              onPointerDown={stopCardInteraction}
              onMouseDown={stopCardInteraction}
            >
              ▲
            </button>
          ) : null}
          {onRankDown && !isLast ? (
            <button
              type='button'
              className='repair-kanban-card-rank-btn repair-kanban-card-down'
              aria-label={t('orders.kanban.moveDown')}
              onClick={(event) => {
                event.stopPropagation();
                onRankDown(sale);
              }}
              onPointerDown={stopCardInteraction}
              onMouseDown={stopCardInteraction}
            >
              ▼
            </button>
          ) : null}
          {onMove ? (
            <button
              type='button'
              className='repair-kanban-card-move'
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
        </span>
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
  isFirst,
  isLast,
  onOpen,
  onMasterChange,
  onMove,
  onRankUp,
  onRankDown,
}: {
  sale: Sale;
  canUpdateStatus: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  isCoarsePointer: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpen: (sale: Sale) => void;
  onMasterChange: (
    sale: Sale,
    masterId: string,
  ) => void | Promise<void>;
  onMove: (sale: Sale) => void;
  onRankUp?: (sale: Sale) => void;
  onRankDown?: (sale: Sale) => void;
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: sale.id,
    data: { sale },
    disabled: !canUpdateStatus,
  });
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: sale.id,
    data: { sale, isCardDroppable: true },
    disabled: !canUpdateStatus,
  });

  // Merge draggable + droppable refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

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
          type='button'
          className='repair-kanban-card-handle'
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
        isFirst={isFirst}
        isLast={isLast}
        onMasterChange={onMasterChange}
        onMove={onMove}
        onRankUp={onRankUp}
        onRankDown={onRankDown}
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
  isSameColumnOver,
  overSaleId,
  overPosition,
  activeSaleId,
  isOver,
  collapsed,
  canUpdateStatus,
  masterOptions,
  canUpdateMaster,
  isCoarsePointer,
  onOpenSale,
  onMasterChange,
  onMove,
  onRankUp,
  onRankDown,
  onToggleCollapsed,
}: {
  status: RepairStatus;
  sales: Sale[];
  showPlaceholder: boolean;
  isSameColumnOver?: boolean;
  overSaleId?: string | null;
  overPosition?: 'before' | 'after' | null;
  activeSaleId?: string | null;
  isOver: boolean;
  collapsed: boolean;
  canUpdateStatus: boolean;
  masterOptions: Employee[];
  canUpdateMaster: boolean;
  isCoarsePointer: boolean;
  onOpenSale: (sale: Sale) => void;
  onMasterChange: (
    sale: Sale,
    masterId: string,
  ) => void | Promise<void>;
  onMove: (sale: Sale) => void;
  onRankUp?: (sale: Sale) => void;
  onRankDown?: (sale: Sale) => void;
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
      <header className='repair-kanban-column-header'>
        <h3 className='repair-kanban-column-title'>
          {t(`orders.status.repair.${status}`)}
        </h3>
        <span className='repair-kanban-column-count'>
          {sales.length}
        </span>
        {canCollapse || collapsed ? (
          <button
            type='button'
            className='repair-kanban-column-toggle'
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
        <div className='repair-kanban-column-body'>
          {showPlaceholder ? (
            <div className='repair-kanban-drop-placeholder' />
          ) : null}
          {sales.map((sale, idx) => {
            const isTarget =
              Boolean(isSameColumnOver) &&
              overSaleId === sale.id &&
              sale.id !== activeSaleId;
            const showBefore = isTarget && overPosition === 'before';
            const showAfter = isTarget && overPosition === 'after';

            return (
              <Fragment key={sale.id}>
                {showBefore ? (
                  <div className='repair-kanban-drop-placeholder' />
                ) : null}
                <DraggableKanbanCard
                  sale={sale}
                  canUpdateStatus={canUpdateStatus}
                  masterOptions={masterOptions}
                  canUpdateMaster={canUpdateMaster}
                  isCoarsePointer={isCoarsePointer}
                  isFirst={idx === 0}
                  isLast={idx === sales.length - 1}
                  onOpen={onOpenSale}
                  onMasterChange={onMasterChange}
                  onMove={onMove}
                  onRankUp={onRankUp}
                  onRankDown={onRankDown}
                />
                {showAfter ? (
                  <div className='repair-kanban-drop-placeholder' />
                ) : null}
              </Fragment>
            );
          })}
          {isSameColumnOver &&
          overSaleId === null &&
          sales.length > 0 ? (
            <div className='repair-kanban-drop-placeholder' />
          ) : null}
          {sales.length === 0 && !showPlaceholder ? (
            <p className='repair-kanban-column-empty'>—</p>
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
  onRankChange,
}: RepairKanbanBoardProps) => {
  const [activeSale, setActiveSale] = useState<Sale | null>(null);
  const [overStatus, setOverStatus] = useState<RepairStatus | null>(
    null,
  );
  const [overSaleId, setOverSaleId] = useState<string | null>(null);
  const [overPosition, setOverPosition] = useState<
    'before' | 'after' | null
  >(null);
  const [optimisticRanks, setOptimisticRanks] = useState<
    Map<string, number>
  >(() => new Map());
  const [pendingMove, setPendingMove] =
    useState<KanbanPendingMove | null>(null);
  const [moveSale, setMoveSale] = useState<Sale | null>(null);
  const [activeColumn, setActiveColumn] =
    useState<RepairStatus>('new');
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<RepairStatus>>(
    () => {
      if (typeof window === 'undefined') return new Set();
      return new Set(
        parseCollapsedKanbanColumns(
          window.localStorage.getItem(kanbanCollapsedStorageKey),
        ),
      );
    },
  );
  const boardRef = useRef<HTMLDivElement | null>(null);
  const salesRef = useRef(sales);
  const moveGeneration = useRef(0);
  const overSaleIdRef = useRef<string | null>(null);
  const overPositionRef = useRef<'before' | 'after' | null>(null);

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
    setOptimisticRanks((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const next = new Map(current);
      for (const sale of sales) {
        const rank = next.get(sale.id);
        if (rank !== undefined && sale.kanbanRank === rank) {
          next.delete(sale.id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [sales]);

  const effectiveSales = useMemo(() => {
    if (optimisticRanks.size === 0) return sales;
    return sales.map((sale) => {
      const rank = optimisticRanks.get(sale.id);
      return rank !== undefined
        ? { ...sale, kanbanRank: rank }
        : sale;
    });
  }, [sales, optimisticRanks]);

  const columns = useMemo(
    () => groupRepairSalesByKanbanStatus(effectiveSales, pendingMove),
    [pendingMove, effectiveSales],
  );

  useEffect(() => {
    setCollapsed((current) => {
      const next = new Set(current);
      let changed = false;
      for (const status of kanbanVisibleRepairStatuses) {
        if (
          (columns.get(status)?.length ?? 0) > 0 &&
          next.has(status)
        ) {
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
          .sort(
            (left, right) =>
              right.intersectionRatio - left.intersectionRatio,
          )[0];
        const status = visible?.target.getAttribute(
          'data-status',
        ) as RepairStatus | null;
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
    effectiveSales.forEach((sale) => map.set(sale.id, sale));
    return map;
  }, [effectiveSales]);

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
    overSaleIdRef.current = null;
    overPositionRef.current = null;
    setOverSaleId(null);
    setOverPosition(null);
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

    // Track hovered card id and relative position for same-column drop targeting
    const overId = event.over?.id ? String(event.over.id) : null;
    const overData = event.over?.data?.current as
      | { isCardDroppable?: boolean }
      | undefined;
    const isCard = Boolean(overId && overData?.isCardDroppable);
    const targetSaleId = isCard ? overId : null;
    overSaleIdRef.current = targetSaleId;
    setOverSaleId(targetSaleId);

    if (
      isCard &&
      event.over?.rect &&
      event.active.rect.current.translated
    ) {
      const activeCenterY =
        (event.active.rect.current.translated.top ?? 0) +
        (event.active.rect.current.translated.height ?? 0) / 2;
      const overCenterY =
        event.over.rect.top + event.over.rect.height / 2;
      const pos: 'before' | 'after' =
        activeCenterY < overCenterY ? 'before' : 'after';
      setOverPosition(pos);
      overPositionRef.current = pos;
    } else {
      setOverPosition(null);
      overPositionRef.current = null;
    }
  };

  const waitForSaleStatus = async (
    saleId: string,
    status: RepairStatus,
    timeoutMs = 400,
  ) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const current = salesRef.current.find(
        (item) => item.id === saleId,
      );
      if (
        current &&
        normalizeOrderStatus(current.status) === status
      ) {
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

    const move: KanbanPendingMove = {
      saleId: sale.id,
      status: nextStatus,
    };
    setPendingMove(move);
    moveGeneration.current += 1;
    const generation = moveGeneration.current;

    // Cross-column move: position at top of destination column
    if (onRankChange) {
      const destSales = columns.get(nextStatus) ?? [];
      const remainingDestSales = destSales.filter(
        (s) => s.id !== sale.id,
      );
      const updates = new Map<string, number>();
      updates.set(sale.id, 1000);
      remainingDestSales.forEach((s, i) => {
        const nextRank = (i + 2) * 1000;
        if (s.kanbanRank !== nextRank) {
          updates.set(s.id, nextRank);
        }
      });
      if (updates.size > 0) {
        setOptimisticRanks((current) => {
          const next = new Map(current);
          for (const [sId, r] of updates) {
            next.set(sId, r);
          }
          return next;
        });
        void onRankChange(
          [...updates.entries()].map(([saleId, kanbanRank]) => ({
            saleId,
            kanbanRank,
          })),
        );
      }
    }

    void (async () => {
      try {
        await onStatusChange(sale, nextStatus);
        const matched = await waitForSaleStatus(sale.id, nextStatus);
        if (generation !== moveGeneration.current) return;
        if (!matched) {
          setPendingMove((current) =>
            current?.saleId === sale.id &&
            current.status === nextStatus
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const sale = saleById.get(String(event.active.id));
    const nextStatus = resolveKanbanDropStatus(
      event.over?.id ? String(event.over.id) : null,
      saleById,
      pendingMove,
    );
    const capturedOverSaleId = overSaleIdRef.current;
    const capturedOverPosition = overPositionRef.current ?? 'before';
    setActiveSale(null);
    setOverStatus(null);
    setOverSaleId(null);
    setOverPosition(null);
    overSaleIdRef.current = null;
    overPositionRef.current = null;

    if (!sale || !canUpdateStatus) return;

    const currentStatus =
      pendingMove?.saleId === sale.id
        ? pendingMove.status
        : (normalizeOrderStatus(sale.status) as RepairStatus);

    // Same-column drop → rank reorder (no status change)
    if (nextStatus === currentStatus && onRankChange) {
      const columnSales = columns.get(currentStatus) ?? [];
      const updates = computeColumnRankAfterDrop(
        columnSales,
        sale.id,
        capturedOverSaleId !== sale.id ? capturedOverSaleId : null,
        capturedOverPosition,
      );
      if (updates.size > 0) {
        const previousRanks = new Map(optimisticRanks);
        setOptimisticRanks((current) => {
          const next = new Map(current);
          for (const [sId, r] of updates) {
            next.set(sId, r);
          }
          return next;
        });
        try {
          await onRankChange(
            [...updates.entries()].map(([saleId, kanbanRank]) => ({
              saleId,
              kanbanRank,
            })),
          );
        } catch {
          setOptimisticRanks(previousRanks);
        }
      }
      return;
    }

    if (!nextStatus) return;
    applyStatusChange(sale, nextStatus);
  };

  const handleRankUp = async (sale: Sale) => {
    if (!onRankChange) return;
    const status =
      pendingMove?.saleId === sale.id
        ? pendingMove.status
        : (normalizeOrderStatus(sale.status) as RepairStatus);
    const columnSales = columns.get(status) ?? [];
    const sorted = [...columnSales].sort(
      (a, b) => kanbanSortKey(a) - kanbanSortKey(b),
    );
    const updates = computeColumnRankAfterMove(sorted, sale.id, 'up');
    if (updates.size > 0) {
      const previousRanks = new Map(optimisticRanks);
      setOptimisticRanks((current) => {
        const next = new Map(current);
        for (const [sId, r] of updates) {
          next.set(sId, r);
        }
        return next;
      });
      try {
        await onRankChange(
          [...updates.entries()].map(([saleId, kanbanRank]) => ({
            saleId,
            kanbanRank,
          })),
        );
      } catch {
        setOptimisticRanks(previousRanks);
      }
    }
  };

  const handleRankDown = async (sale: Sale) => {
    if (!onRankChange) return;
    const status =
      pendingMove?.saleId === sale.id
        ? pendingMove.status
        : (normalizeOrderStatus(sale.status) as RepairStatus);
    const columnSales = columns.get(status) ?? [];
    const sorted = [...columnSales].sort(
      (a, b) => kanbanSortKey(a) - kanbanSortKey(b),
    );
    const updates = computeColumnRankAfterMove(
      sorted,
      sale.id,
      'down',
    );
    if (updates.size > 0) {
      const previousRanks = new Map(optimisticRanks);
      setOptimisticRanks((current) => {
        const next = new Map(current);
        for (const [sId, r] of updates) {
          next.set(sId, r);
        }
        return next;
      });
      try {
        await onRankChange(
          [...updates.entries()].map(([saleId, kanbanRank]) => ({
            saleId,
            kanbanRank,
          })),
        );
      } catch {
        setOptimisticRanks(previousRanks);
      }
    }
  };

  const clearDragState = () => {
    setActiveSale(null);
    setOverStatus(null);
    setOverSaleId(null);
    setOverPosition(null);
    overSaleIdRef.current = null;
    overPositionRef.current = null;
  };

  const scrollToColumn = (status: RepairStatus) => {
    const column = boardRef.current?.querySelector(
      `[data-status="${status}"]`,
    );
    column?.scrollIntoView({
      inline: 'start',
      block: 'nearest',
      behavior: 'smooth',
    });
    setActiveColumn(status);
  };

  const toggleCollapsed = (status: RepairStatus) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else if ((columns.get(status)?.length ?? 0) === 0)
        next.add(status);
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
        className='repair-kanban-board'
        data-testid='repair-kanban-board'
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
            isSameColumnOver={Boolean(
              activeSale &&
              overStatus === status &&
              activeSourceStatus === status,
            )}
            overSaleId={overSaleId}
            overPosition={overPosition}
            activeSaleId={activeSale?.id}
            isOver={Boolean(activeSale && overStatus === status)}
            collapsed={collapsed.has(status)}
            canUpdateStatus={canUpdateStatus}
            masterOptions={masterOptions}
            canUpdateMaster={canUpdateMaster}
            isCoarsePointer={isCoarsePointer}
            onOpenSale={onOpenSale}
            onMasterChange={onMasterChange}
            onMove={setMoveSale}
            onRankUp={onRankChange ? handleRankUp : undefined}
            onRankDown={onRankChange ? handleRankDown : undefined}
            onToggleCollapsed={toggleCollapsed}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeSale ? (
          <div className='repair-kanban-drag-overlay'>
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
          onMove={(sale, status) =>
            applyStatusChange(sale, status as RepairStatus)
          }
        />
      ) : null}
    </DndContext>
  );
};
