import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../entities/sale/model/types';
import { isProductSale, isRepairOrder } from '../../../../entities/sale/lib/sale-kind';
import type { PageKey } from '../../../../pages/dashboard/model/types';
import { useModalBackgroundScrollLock } from '../../../../shared/lib/useModalBackgroundScrollLock';
import { buildOrderNumber } from '../orders/workspace/orders-workspace-shared';

export type CommandPaletteAction =
  | { type: 'page'; page: PageKey }
  | { type: 'createRepair' }
  | { type: 'createSale' }
  | { type: 'openSale'; saleId: string; kind: 'repair' | 'sale' };

export type CommandPaletteItem = {
  id: string;
  label: string;
  hint?: string;
  group: 'navigation' | 'actions' | 'orders';
  keywords: string[];
  action: CommandPaletteAction;
};

type CommandPaletteProps = {
  isOpen: boolean;
  canAccessPage: (page: PageKey) => boolean;
  canCreateOrders: boolean;
  canViewOrders: boolean;
  sales: Sale[];
  onClose: () => void;
  onAction: (action: CommandPaletteAction) => void;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const buildCommandPaletteItems = ({
  canAccessPage,
  canCreateOrders,
  canViewOrders,
  sales,
  labels,
}: {
  canAccessPage: (page: PageKey) => boolean;
  canCreateOrders: boolean;
  canViewOrders: boolean;
  sales: Sale[];
  labels: {
    page: Record<PageKey, string>;
    createRepair: string;
    createSale: string;
    openOrder: string;
    openSale: string;
  };
}): CommandPaletteItem[] => {
  const pages: PageKey[] = [
    'home',
    'orders',
    'accounting',
    'warehouse',
    'catalog',
    'clients',
    'employees',
    'settings',
  ];

  const items: CommandPaletteItem[] = pages
    .filter((page) => canAccessPage(page))
    .map((page) => ({
      id: `page-${page}`,
      label: labels.page[page],
      group: 'navigation',
      keywords: [page, labels.page[page]],
      action: { type: 'page', page },
    }));

  if (canCreateOrders) {
    items.push(
      {
        id: 'create-repair',
        label: labels.createRepair,
        group: 'actions',
        keywords: ['repair', 'create', 'new', labels.createRepair],
        action: { type: 'createRepair' },
      },
      {
        id: 'create-sale',
        label: labels.createSale,
        group: 'actions',
        keywords: ['sale', 'create', 'new', 'pos', labels.createSale],
        action: { type: 'createSale' },
      },
    );
  }

  if (canViewOrders) {
    const recentSales = [...sales]
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.saleDate || 0).getTime() -
          new Date(a.createdAt || a.saleDate || 0).getTime(),
      )
      .slice(0, 40);

    for (const sale of recentSales) {
      const orderNumber = buildOrderNumber(sale);
      const kind = isProductSale(sale)
        ? 'sale'
        : isRepairOrder(sale)
          ? 'repair'
          : 'sale';
      const clientName = sale.client?.name || '';
      items.push({
        id: `sale-${sale.id}`,
        label: `${kind === 'repair' ? labels.openOrder : labels.openSale} ${orderNumber}`,
        hint: clientName || undefined,
        group: 'orders',
        keywords: [orderNumber, clientName, sale.recordNumber || '', sale.id],
        action: { type: 'openSale', saleId: sale.id, kind },
      });
    }
  }

  return items;
};

export const filterCommandPaletteItems = (
  items: CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] => {
  const normalized = normalize(query);
  if (!normalized) {
    return items.filter((item) => item.group !== 'orders').slice(0, 12);
  }

  return items
    .filter((item) => {
      const haystack = [item.label, item.hint || '', ...item.keywords]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, 20);
};

export const CommandPalette = ({
  isOpen,
  canAccessPage,
  canCreateOrders,
  canViewOrders,
  sales,
  onClose,
  onAction,
}: CommandPaletteProps) => {
  const { t } = useTranslation();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useModalBackgroundScrollLock(isOpen, {
    allowedSelectors: ['.command-palette'],
  });

  const items = useMemo(
    () =>
      buildCommandPaletteItems({
        canAccessPage,
        canCreateOrders,
        canViewOrders,
        sales,
        labels: {
          page: {
            home: t('nav.home'),
            orders: t('nav.orders'),
            accounting: t('nav.accounting'),
            warehouse: t('nav.warehouse'),
            catalog: t('nav.catalog'),
            clients: t('nav.clients'),
            employees: t('nav.employees'),
            settings: t('nav.settings'),
          },
          createRepair: t('orders.toolbar.createRepair'),
          createSale: t('orders.toolbar.createSale'),
          openOrder: t('commandPalette.openOrder'),
          openSale: t('commandPalette.openSale'),
        },
      }),
    [canAccessPage, canCreateOrders, canViewOrders, sales, t],
  );

  const visibleItems = useMemo(
    () => filterCommandPaletteItems(items, query),
    [items, query],
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (activeIndex >= visibleItems.length) {
      setActiveIndex(Math.max(0, visibleItems.length - 1));
    }
  }, [activeIndex, visibleItems.length]);

  if (!isOpen) return null;

  const runItem = (item: CommandPaletteItem) => {
    onAction(item.action);
    onClose();
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        visibleItems.length === 0
          ? 0
          : (current + 1) % visibleItems.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        visibleItems.length === 0
          ? 0
          : (current - 1 + visibleItems.length) % visibleItems.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const item = visibleItems[activeIndex];
      if (item) runItem(item);
    }
  };

  return (
    <div
      className="modal-backdrop command-palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="command-palette-header">
          <h2 id={titleId} className="visually-hidden">
            {t('commandPalette.title')}
          </h2>
          <input
            ref={inputRef}
            className="command-palette-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t('commandPalette.placeholder')}
            aria-label={t('commandPalette.title')}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="command-palette-hint">{t('commandPalette.hint')}</p>
        </header>

        <ul className="command-palette-list" role="listbox">
          {visibleItems.length === 0 ? (
            <li className="command-palette-empty">{t('commandPalette.empty')}</li>
          ) : (
            visibleItems.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex
                      ? 'command-palette-item command-palette-item-active'
                      : 'command-palette-item'
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                >
                  <span className="command-palette-item-label">{item.label}</span>
                  {item.hint ? (
                    <span className="command-palette-item-hint">{item.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};
