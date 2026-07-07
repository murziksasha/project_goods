import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Employee,
  EmployeeFormValues,
} from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import { EmployeeInformationPanel } from './EmployeeInformationPanel';
import { EmployeeManagementPanel } from './EmployeeManagementPanel';

export type EmployeesTab = 'employees' | 'information';

const employeesTabStorageKey = 'project-goods.employees-active-tab';

type EmployeesPanelProps = {
  employees: Employee[];
  sales: Sale[];
  form: EmployeeFormValues;
  isLoading: boolean;
  isSalesLoading: boolean;
  isSaving: boolean;
  isEditing: boolean;
  canManageEmployees: boolean;
  canManageOwnerAccounts: boolean;
  currentEmployeeId: string;
  onChange: <K extends keyof EmployeeFormValues>(
    field: K,
    value: EmployeeFormValues[K],
  ) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
};

const isEmployeesTab = (value: string | null | undefined): value is EmployeesTab =>
  value === 'employees' || value === 'information';

export const EmployeesPanel = ({
  employees,
  sales,
  form,
  isLoading,
  isSalesLoading,
  isSaving,
  isEditing,
  canManageEmployees,
  canManageOwnerAccounts,
  currentEmployeeId,
  onChange,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
}: EmployeesPanelProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EmployeesTab>(() => {
    try {
      const stored = window.localStorage.getItem(employeesTabStorageKey);
      return isEmployeesTab(stored) ? stored : 'employees';
    } catch {
      return 'employees';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(employeesTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  const tabs: Array<{ key: EmployeesTab; labelKey: string }> = [
    { key: 'employees', labelKey: 'employees.tabs.employees' },
    { key: 'information', labelKey: 'employees.tabs.information' },
  ];

  return (
    <section className="employees-panel">
      <div className="orders-tabs" role="tablist" aria-label={t('employees.tabs.ariaLabel')}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? 'orders-tab orders-tab-active' : 'orders-tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'employees' ? (
        <EmployeeManagementPanel
          employees={employees}
          form={form}
          isLoading={isLoading}
          isSaving={isSaving}
          isEditing={isEditing}
          canManageEmployees={canManageEmployees}
          canManageOwnerAccounts={canManageOwnerAccounts}
          currentEmployeeId={currentEmployeeId}
          onChange={onChange}
          onSubmit={onSubmit}
          onCancelEdit={onCancelEdit}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <EmployeeInformationPanel
          employees={employees}
          sales={sales}
          isLoading={isSalesLoading}
        />
      )}
    </section>
  );
};