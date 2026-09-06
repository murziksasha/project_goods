import { useEffect, useState } from 'react';
import type { Cashbox } from '../../../../entities/finance/model/types';
import {
  accountingCashboxOrderStorageKey,
  accountingExpandedFinanceSettingsCardStorageKey,
  accountingFinanceSettingsTabStorageKey,
  accountingLastOperationByCashboxStorageKey,
  accountingLastTargetCashboxByTypeStorageKey,
  accountingTabStorageKey,
  getAccountingSettingsOpenFromUrl,
  getAccountingTabFromUrl,
  getStoredAccountingTab,
  writeAccountingSettingsOpenToUrl,
  getStoredExpandedFinanceSettingsCard,
  migrateLastTargetCashboxToOperationMemory,
  parseStoredLastOperationByCashbox,
  type AccountingTab,
  type LastOperationByCashbox,
  type TransactionTargetMemory,
} from '../../model/accounting';

export type FinanceSettingsTab = 'cashboxes' | 'currencies';

type UseAccountingPreferencesOptions = {
  cashboxes: Cashbox[];
  isCashboxesOrderHydrated: boolean;
  onNavigateAccountingTab?: (tab: AccountingTab) => void;
  registerPopstateSync?: (
    sync: ((tab: AccountingTab | null) => void) | null,
  ) => void;
  syncedAccountingTab?: AccountingTab | null;
};

const readStoredLastOperationByCashbox = (cashboxes: Cashbox[]): LastOperationByCashbox => {
  try {
    const raw = window.localStorage.getItem(accountingLastOperationByCashboxStorageKey);
    const parsed = parseStoredLastOperationByCashbox(raw);
    if (Object.keys(parsed).length > 0) {
      return parsed;
    }

    const legacyRaw = window.localStorage.getItem(
      accountingLastTargetCashboxByTypeStorageKey,
    );
    if (!legacyRaw) return {};
    const legacy = JSON.parse(legacyRaw) as TransactionTargetMemory;
    return migrateLastTargetCashboxToOperationMemory(legacy, cashboxes);
  } catch {
    return {};
  }
};

export const useAccountingPreferences = ({
  cashboxes,
  isCashboxesOrderHydrated,
  onNavigateAccountingTab,
  registerPopstateSync,
  syncedAccountingTab = null,
}: UseAccountingPreferencesOptions) => {
  const [activeTab, setActiveTab] = useState<AccountingTab>(
    () => getAccountingTabFromUrl() ?? getStoredAccountingTab(),
  );
  const [isFinanceSettingsOpen, setIsFinanceSettingsOpen] = useState(
    getAccountingSettingsOpenFromUrl,
  );
  const [financeSettingsTab, setFinanceSettingsTab] =
    useState<FinanceSettingsTab>(() => {
      try {
        const storedTab = window.localStorage.getItem(
          accountingFinanceSettingsTabStorageKey,
        );
        return storedTab === 'cashboxes' || storedTab === 'currencies'
          ? storedTab
          : 'cashboxes';
      } catch {
        return 'cashboxes';
      }
    });
  const [expandedFinanceSettingsCard, setExpandedFinanceSettingsCard] =
    useState<string | null>(getStoredExpandedFinanceSettingsCard);
  const [lastOperationByCashbox, setLastOperationByCashbox] =
    useState<LastOperationByCashbox>(() => readStoredLastOperationByCashbox(cashboxes));

  useEffect(() => {
    if (cashboxes.length === 0) return;
    setLastOperationByCashbox((current) =>
      Object.keys(current).length > 0
        ? current
        : readStoredLastOperationByCashbox(cashboxes),
    );
  }, [cashboxes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(accountingTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  useEffect(() => {
    if (!registerPopstateSync) {
      return;
    }

    registerPopstateSync((tab) => {
      if (tab) {
        setActiveTab(tab);
      }
    });

    return () => {
      registerPopstateSync(null);
    };
  }, [registerPopstateSync]);

  useEffect(() => {
    if (syncedAccountingTab) {
      setActiveTab(syncedAccountingTab);
    }
  }, [syncedAccountingTab]);

  useEffect(() => {
    if (!isCashboxesOrderHydrated || cashboxes.length === 0) return;
    try {
      const order = cashboxes.map((cashbox) => cashbox.id);
      window.localStorage.setItem(
        accountingCashboxOrderStorageKey,
        JSON.stringify(order),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [cashboxes, isCashboxesOrderHydrated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingLastOperationByCashboxStorageKey,
        JSON.stringify(lastOperationByCashbox),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [lastOperationByCashbox]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingFinanceSettingsTabStorageKey,
        financeSettingsTab,
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [financeSettingsTab]);

  useEffect(() => {
    const syncSettingsFromUrl = () => {
      setIsFinanceSettingsOpen(getAccountingSettingsOpenFromUrl());
    };
    window.addEventListener('popstate', syncSettingsFromUrl);
    return () => {
      window.removeEventListener('popstate', syncSettingsFromUrl);
    };
  }, []);

  useEffect(() => {
    try {
      if (expandedFinanceSettingsCard) {
        window.localStorage.setItem(
          accountingExpandedFinanceSettingsCardStorageKey,
          expandedFinanceSettingsCard,
        );
      } else {
        window.localStorage.removeItem(
          accountingExpandedFinanceSettingsCardStorageKey,
        );
      }
    } catch {
      // Ignore localStorage write errors.
    }
  }, [expandedFinanceSettingsCard]);

  const changeActiveTab = (tab: AccountingTab) => {
    setActiveTab(tab);
    onNavigateAccountingTab?.(tab);
  };

  const changeFinanceSettingsOpen = (
    value: boolean | ((current: boolean) => boolean),
  ) => {
    setIsFinanceSettingsOpen((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      writeAccountingSettingsOpenToUrl(next);
      return next;
    });
  };

  return {
    activeTab,
    expandedFinanceSettingsCard,
    financeSettingsTab,
    isFinanceSettingsOpen,
    lastOperationByCashbox,
    setActiveTab: changeActiveTab,
    setExpandedFinanceSettingsCard,
    setFinanceSettingsTab,
    setIsFinanceSettingsOpen: changeFinanceSettingsOpen,
    setLastOperationByCashbox,
  };
};