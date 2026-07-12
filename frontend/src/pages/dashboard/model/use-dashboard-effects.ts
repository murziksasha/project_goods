import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getClientHistory } from '../../../entities/client/api/clientApi';
import type { ClientHistory } from '../../../entities/client/model/types';
import { useEmployeesQuery } from '../../../entities/employee/api/employeeApi';
import type { Employee } from '../../../entities/employee/model/types';
import { useSuppliersQuery } from '../../../entities/supplier/api/supplierApi';
import type { Supplier } from '../../../entities/supplier/model/types';
import { getClientDevices } from '../../../entities/client-device/api/clientDeviceApi';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import { useSettingsQuery } from '../../../entities/settings/api/settingsApi';
import type { AppSettings, AppSettingsFormValues } from '../../../entities/settings/model/types';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { applyPrintFormLocalOverrides } from '../../../widgets/dashboard/model/print-form-local-overrides';
import { normalizeDashboardPreferences } from '../../../entities/settings/model/dashboardPreferences';
import { getRequestErrorMessage } from '../../../shared/lib/request';
import { queryKeys } from '../../../shared/api/queryClient';
import i18n from '../../../shared/i18n/config';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type DashboardEffectsParams = {
  enabled: boolean;
  employeeId: string | null;
  selectedClientId: string | null;
  setClientDevices: Setter<ClientDevice[]>;
  setSuppliers: Setter<Supplier[]>;
  setAllEmployees: Setter<Employee[]>;
  setSettings: Setter<AppSettings | null>;
  setSettingsForm: Setter<AppSettingsFormValues>;
  setClientHistory: Setter<ClientHistory | null>;
  setIsSuppliersLoading: Setter<boolean>;
  setIsEmployeesLoading: Setter<boolean>;
  setIsClientHistoryLoading: Setter<boolean>;
  setError: Setter<string>;
  setLastSyncAt: Setter<string | null>;
};

export const useDashboardEffects = ({
  enabled,
  employeeId,
  selectedClientId,
  setClientDevices,
  setSuppliers,
  setAllEmployees,
  setSettings,
  setSettingsForm,
  setClientHistory,
  setIsSuppliersLoading,
  setIsEmployeesLoading,
  setIsClientHistoryLoading,
  setError,
  setLastSyncAt,
}: DashboardEffectsParams) => {
  const suppliersQuery = useSuppliersQuery(enabled);
  const employeesQuery = useEmployeesQuery(enabled);
  const settingsQuery = useSettingsQuery(enabled);

  const clientDevicesQuery = useQuery({
    queryKey: queryKeys.clientDevices,
    queryFn: () => getClientDevices(),
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });

  useEffect(() => {
    if (!enabled) return;
    setIsSuppliersLoading(suppliersQuery.isLoading);
    if (suppliersQuery.data) {
      setSuppliers(suppliersQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (suppliersQuery.error) {
      setError(
        getRequestErrorMessage(
          suppliersQuery.error,
          i18n.t('errors.failedLoadSuppliers'),
        ),
      );
    }
  }, [
    enabled,
    setError,
    setIsSuppliersLoading,
    setLastSyncAt,
    setSuppliers,
    suppliersQuery.data,
    suppliersQuery.error,
    suppliersQuery.isLoading,
  ]);

  useEffect(() => {
    if (!enabled) return;
    setIsEmployeesLoading(employeesQuery.isLoading);
    if (employeesQuery.data) {
      setAllEmployees(employeesQuery.data);
      setLastSyncAt(new Date().toISOString());
    } else if (employeesQuery.error) {
      setAllEmployees([]);
      setError(
        getRequestErrorMessage(
          employeesQuery.error,
          i18n.t('errors.failedLoadEmployees'),
        ),
      );
    }
  }, [
    enabled,
    employeesQuery.data,
    employeesQuery.error,
    employeesQuery.isLoading,
    setAllEmployees,
    setError,
    setIsEmployeesLoading,
    setLastSyncAt,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
      setSettingsForm({
        serviceName: settingsQuery.data.serviceName,
        company: settingsQuery.data.company,
        companyAddress: settingsQuery.data.companyAddress,
        companyId: settingsQuery.data.companyId,
        companyIban: settingsQuery.data.companyIban,
        companyEmail: settingsQuery.data.companyEmail,
        companySite: settingsQuery.data.companySite,
        printForms: applyPrintFormLocalOverrides(
          settingsQuery.data.printForms,
          employeeId,
        ),
        orderDefaults: settingsQuery.data.orderDefaults,
        numbering: settingsQuery.data.numbering,
        financeDefaults: settingsQuery.data.financeDefaults,
        notificationSettings: settingsQuery.data.notificationSettings,
        dashboardPreferences: normalizeDashboardPreferences(
          settingsQuery.data.dashboardPreferences,
        ),
      });
      setLastSyncAt(new Date().toISOString());
    } else if (settingsQuery.error) {
      setSettings(null);
      setSettingsForm(createDefaultSettingsForm());
      setError(
        getRequestErrorMessage(
          settingsQuery.error,
          i18n.t('errors.failedLoadSettings'),
        ),
      );
    }
  }, [
    employeeId,
    enabled,
    setError,
    setLastSyncAt,
    setSettings,
    setSettingsForm,
    settingsQuery.data,
    settingsQuery.error,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (clientDevicesQuery.data) {
      setClientDevices(clientDevicesQuery.data);
      setLastSyncAt(new Date().toISOString());
    }
    if (clientDevicesQuery.error) {
      setError(
        getRequestErrorMessage(
          clientDevicesQuery.error,
          i18n.t('errors.failedLoadClientDevices'),
        ),
      );
    }
  }, [
    enabled,
    clientDevicesQuery.data,
    clientDevicesQuery.error,
    setClientDevices,
    setError,
    setLastSyncAt,
  ]);

  useEffect(() => {
    if (!enabled || !selectedClientId) return;

    let isActive = true;

    const fetchHistory = async () => {
      setIsClientHistoryLoading(true);
      try {
        const history = await getClientHistory(selectedClientId);
        if (isActive) setClientHistory(history);
      } catch (requestError) {
        if (isActive) {
          setError(
            getRequestErrorMessage(
              requestError,
              i18n.t('errors.failedLoadClientHistory'),
            ),
          );
        }
      } finally {
        if (isActive) setIsClientHistoryLoading(false);
      }
    };

    void fetchHistory();
    return () => {
      isActive = false;
    };
  }, [enabled, selectedClientId, setClientHistory, setError, setIsClientHistoryLoading]);
};