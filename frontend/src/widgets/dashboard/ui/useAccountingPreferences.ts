import { useEffect, useState } from 'react';
import type { Cashbox } from '../../../entities/finance/model/types';
import {
  accountingCashboxOrderStorageKey,
  accountingExpandedFinanceSettingsCardStorageKey,
  accountingFinanceSettingsTabStorageKey,
  accountingLastTargetCashboxByTypeStorageKey,
  accountingSettingsOpenStorageKey,
  accountingTabStorageKey,
  getAccountingTabFromUrl,
  getStoredAccountingSettingsOpen,
  getStoredAccountingTab,
  getStoredExpandedFinanceSettingsCard,
  type AccountingTab,
  type TransactionTargetMemory,
} from '../model/accounting';

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
    getStoredAccountingSettingsOpen,
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
  const [lastTargetCashboxByType, setLastTargetCashboxByType] =
    useState<TransactionTargetMemory>(() => {
      try {
        const raw = window.localStorage.getItem(
          accountingLastTargetCashboxByTypeStorageKey,
        );
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const next: TransactionTargetMemory = {};
        if (typeof parsed.deposit === 'string') {
          next.deposit = parsed.deposit;
        }
        if (typeof parsed.transfer === 'string') {
          next.transfer = parsed.transfer;
        }
        return next;
      } catch {
        return {};
      }
    });

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
        accountingLastTargetCashboxByTypeStorageKey,
        JSON.stringify(lastTargetCashboxByType),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [lastTargetCashboxByType]);

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
    try {
      window.localStorage.setItem(
        accountingSettingsOpenStorageKey,
        String(isFinanceSettingsOpen),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [isFinanceSettingsOpen]);

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

  return {
    activeTab,
    expandedFinanceSettingsCard,
    financeSettingsTab,
    isFinanceSettingsOpen,
    lastTargetCashboxByType,
    setActiveTab: changeActiveTab,
    setExpandedFinanceSettingsCard,
    setFinanceSettingsTab,
    setIsFinanceSettingsOpen,
    setLastTargetCashboxByType,
  };
};
