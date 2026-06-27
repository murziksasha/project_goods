import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Employee,
  EmployeeFormValues,
  EmployeePermission,
} from '../../../entities/employee/model/types';
import {
  defaultEmployeePermissionsByRole,
  employeeRoleOptions,
} from '../../../entities/employee/model/types';

const permissionGroups: Array<{
  titleKey: string;
  permissions: EmployeePermission[];
}> = [
  {
    titleKey: 'employees.permissionGroups.orders',
    permissions: [
      'orders.view',
      'orders.manage',
      'orders.chat',
      'repairs.execute',
      'sales.manage',
    ],
  },
  {
    titleKey: 'employees.permissionGroups.supplierOrders',
    permissions: ['supplierOrders.view', 'supplierOrders.manage'],
  },
  {
    titleKey: 'employees.permissionGroups.clients',
    permissions: ['clients.manage'],
  },
  {
    titleKey: 'employees.permissionGroups.inventory',
    permissions: ['inventory.manage'],
  },
  {
    titleKey: 'employees.permissionGroups.finance',
    permissions: [
      'finance.view',
      'finance.cashboxes.view',
      'finance.cashboxes.manage',
      'finance.transactions.deposit',
      'finance.transactions.withdraw',
      'finance.transactions.transfer',
      'finance.supplierOrders.pay',
      'finance.supplierOrders.issueWithoutPayment',
    ],
  },
  {
    titleKey: 'employees.permissionGroups.employees',
    permissions: ['employees.manage'],
  },
  {
    titleKey: 'employees.permissionGroups.system',
    permissions: ['printForms.manage', 'system.backups.manage'],
  },
];

type EmployeeManagementPanelProps = {
  employees: Employee[];
  form: EmployeeFormValues;
  isLoading: boolean;
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

export const EmployeeManagementPanel = ({
  employees,
  form,
  isLoading,
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
}: EmployeeManagementPanelProps) => {
  const { t } = useTranslation();
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const isOwnerRoleSelected = form.role === 'owner';

  const togglePermission = (permission: EmployeePermission) => {
    if (isOwnerRoleSelected && permission === 'employees.manage') {
      return;
    }
    if (
      (permission === 'employees.manage' ||
        permission === 'system.backups.manage') &&
      !canManageOwnerAccounts
    ) {
      return;
    }
    if (form.permissions.includes(permission)) {
      onChange(
        'permissions',
        form.permissions.filter((item) => item !== permission),
      );
      return;
    }
    onChange('permissions', [...form.permissions, permission]);
  };

  const handleRoleChange = (role: EmployeeFormValues['role']) => {
    onChange('role', role);
    onChange('permissions', defaultEmployeePermissionsByRole[role]);
  };

  const confirmDelete = () => {
    if (!employeeToDelete) {
      return;
    }

    onDelete(employeeToDelete);
    setEmployeeToDelete(null);
  };

  const handleEdit = (employee: Employee) => {
    if (employee.role === 'owner' && !canManageOwnerAccounts) {
      return;
    }
    onEdit(employee);
    window.requestAnimationFrame(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <section className="panel">
            <div className="panel-header" style={{ marginTop: 20 }}>
        <div>
          <p className="section-label">{t('employees.list.sectionLabel')}</p>
          <h2>{t('employees.list.title')}</h2>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state">{t('employees.list.loading')}</p>
      ) : employees.length === 0 ? (
        <p className="empty-state">{t('employees.list.empty')}</p>
      ) : (
        <div className="stack-list">
          {employees.map((employee) => {
            const isCurrentEmployee = employee.id === currentEmployeeId;
            const canWriteThisEmployee = employee.role !== 'owner' || canManageOwnerAccounts;

            return (
              <article key={employee.id} className="list-card">
                <div className="list-card-row">
                  <div>
                    <h3>{employee.name}</h3>
                    <p>
                      {employee.email || t('employees.list.noEmail')} |{' '}
                      {employee.phone || t('employees.list.noPhone')} | {employee.role}
                    </p>
                    <p>
                      {employee.username || t('employees.list.noLogin')}
                      {isCurrentEmployee ? ` | ${t('employees.list.currentUser')}` : ''}
                    </p>
                    <p>
                      {employee.isActive
                        ? t('employees.list.active')
                        : t('employees.list.inactive')}
                    </p>
                  </div>
                  <div className="card-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleEdit(employee)}
                      disabled={!canManageEmployees || !canWriteThisEmployee}
                    >
                      {t('employees.list.edit')}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => setEmployeeToDelete(employee)}
                      disabled={!canManageEmployees || isCurrentEmployee || !canWriteThisEmployee}
                      title={
                        isCurrentEmployee
                          ? t('employees.list.cannotDeleteSelf')
                          : t('employees.list.deleteEmployee')
                      }
                    >
                      {t('employees.list.delete')}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div ref={formTopRef} />
      {!canManageEmployees ? (
        <p className="empty-state">{t('employees.list.noPermission')}</p>
      ) : null}

      <div className="panel-header" style={{marginTop:80}}>
        <div>
          <p className="section-label">{t('employees.form.sectionLabel')}</p>
          <h2>
            {isEditing ? t('employees.form.editTitle') : t('employees.form.createTitle')}
          </h2>
        </div>
        {isEditing ? (
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            {t('common.cancel')}
          </button>
        ) : null}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>{t('employees.form.name')}</span>
          <input
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder={t('employees.form.fullNamePlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('employees.form.phone')}</span>
          <input
            value={form.phone}
            onChange={(event) => onChange('phone', event.target.value)}
            placeholder={t('employees.form.phonePlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('employees.form.email')}</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => onChange('email', event.target.value)}
            placeholder={t('employees.form.emailPlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('employees.form.login')}</span>
          <input
            value={form.username}
            onChange={(event) => onChange('username', event.target.value)}
            placeholder={t('employees.form.loginPlaceholder')}
          />
        </label>
        <label className="field">
          <span>
            {isEditing ? t('employees.form.newPassword') : t('employees.form.password')}
          </span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => onChange('password', event.target.value)}
            placeholder={
              isEditing
                ? t('employees.form.passwordKeepCurrent')
                : t('employees.form.passwordPlaceholder')
            }
          />
        </label>
        <label className="field">
          <span>{t('employees.form.role')}</span>
          <select
            value={form.role}
            onChange={(event) => handleRoleChange(event.target.value as EmployeeFormValues['role'])}
          >
            {employeeRoleOptions
              .filter((role) => canManageOwnerAccounts || role !== 'owner')
              .map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('employees.form.status')}</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) => onChange('isActive', event.target.value === 'active')}
          >
            <option value="active">{t('employees.form.active')}</option>
            <option value="inactive">{t('employees.form.inactive')}</option>
          </select>
        </label>
        <label className="field field-wide">
          <span>{t('employees.form.note')}</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) => onChange('note', event.target.value)}
          />
        </label>
      </div>

      <div className="employee-permissions">
        {permissionGroups.map((group) => (
          <section key={group.titleKey} className="employee-permission-group">
            <h3>{t(group.titleKey)}</h3>
            {group.permissions.map((permission) => (
              <label key={permission} className="create-inline-checkbox">
                <input
                  type="checkbox"
                  checked={
                    form.permissions.includes(permission) ||
                    (isOwnerRoleSelected && permission === 'employees.manage')
                  }
                  disabled={
                    (isOwnerRoleSelected && permission === 'employees.manage') ||
                    ((permission === 'employees.manage' ||
                      permission === 'system.backups.manage') &&
                    !canManageOwnerAccounts)
                  }
                  onChange={() => togglePermission(permission)}
                />
                <span>{permission}</span>
              </label>
            ))}
          </section>
        ))}
      </div>

      <button
        className="primary-button"
        type="button"
        onClick={onSubmit}
        disabled={
          !canManageEmployees ||
          isSaving ||
          !form.name.trim() ||
          !form.username.trim() ||
          form.permissions.length === 0 ||
          (!isEditing && form.password.trim().length < 3)
        }
      >
        {isSaving
          ? t('employees.form.saving')
          : isEditing
            ? t('employees.form.updateEmployee')
            : t('employees.form.saveEmployee')}
      </button>

      {employeeToDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal payment-modal-message" role="dialog" aria-modal="true">
            <div className="payment-modal-summary">
              <h3>{t('employees.deleteModal.title')}</h3>
              <p>
                {t('employees.deleteModal.message', { name: employeeToDelete.name })}
              </p>
            </div>
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setEmployeeToDelete(null)}>
                  {t('common.cancel')}
                </button>
                <button type="button" className="danger-button" onClick={confirmDelete}>
                  {t('common.delete')}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};