import type { Sale } from '../../../../entities/sale/model/types';
import { isProductSale, isRepairOrder } from '../../../../entities/sale/lib/sale-kind';
import type { PageKey } from '../../../../pages/dashboard/model/types';
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
