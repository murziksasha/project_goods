import type { OrdersTab } from './types';

export const resolveDisplayedOrdersTabs = (
  permitted: readonly OrdersTab[],
  hidden: readonly string[] | undefined,
): OrdersTab[] => {
  const hiddenSet = new Set(hidden ?? []);
  const displayed = permitted.filter((tab) => !hiddenSet.has(tab));

  return displayed.length > 0 ? displayed : permitted.slice(0, 1);
};

export const canHideOrdersTab = (
  permitted: readonly OrdersTab[],
  hidden: readonly string[] | undefined,
  tab: OrdersTab,
) => {
  const displayed = resolveDisplayedOrdersTabs(permitted, hidden);
  return displayed.length > 1 && displayed.includes(tab);
};
