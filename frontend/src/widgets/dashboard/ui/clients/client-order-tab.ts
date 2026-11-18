import { getOrderLink } from '../../../../pages/dashboard/model/dashboard-navigation';

const tabs = new Map<string, Window>();

export const clearClientOrderTabs = () => {
  tabs.clear();
};

export const openClientOrderTab = (
  saleId: string,
  kind: 'repair' | 'sale',
) => {
  const existing = tabs.get(saleId);
  if (existing && existing.closed !== true) {
    existing.focus();
    return;
  }

  const opened = window.open(getOrderLink(saleId, kind), '_blank');
  if (!opened) {
    tabs.delete(saleId);
    return;
  }

  try {
    opened.opener = null;
  } catch {
    // The browser may already have sealed opener.
  }

  tabs.set(saleId, opened);
};
