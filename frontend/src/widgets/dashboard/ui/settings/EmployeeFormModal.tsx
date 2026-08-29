import { useTranslation } from 'react-i18next';
import type {
  EmployeeFormValues,
  EmployeePermission,
} from '../../../../entities/employee/model/types';
import {
  defaultEmployeePermissionsByRole,
  employeeRoleOptions,
} from '../../../../entities/employee/model/types';
import { Button } from '../../../../shared/ui/Button';
import { Modal } from '../../../../shared/ui/Modal';
import { employeePermissionLabelKey, employeeRoleLabelKey } from './employee-ui';

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
    titleKey: 'employees.permissionGroups.kanban',
    permissions: ['kanban.use'],
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

type EmployeeFormModalProps = {
  form: EmployeeFormValues;
  isOpen: boolean;
  isSaving: boolean;
  isEditing: boolean;
  canManageEmployees: boolean;
  canManageOwnerAccounts: boolean;
  onChange: <K extends keyof EmployeeFormValues>(
    field: K,
    value: EmployeeFormValues[K],
  ) => void;
  onSubmit: () => void | Promise<boolean | void>;
  onClose: () => void;
};

export const EmployeeFormModal = ({
  form,
  isOpen,
  isSaving,
  isEditing,
  canManageEmployees,
  canManageOwnerAccounts,
  onChange,
  onSubmit,
  onClose,
}: EmployeeFormModalProps) => {
  const { t } = useTranslation();
  const isOwnerRoleSelected = form.role === 'owner';
  const canSubmit =
    canManageEmployees &&
    !isSaving &&
    Boolean(form.name.trim()) &&
    Boolean(form.username.trim()) &&
    form.permissions.length > 0 &&
    (isEditing || form.password.trim().length >= 3);

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

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    await onSubmit();
  };

  return (
    <Modal
      isOpen={isOpen}
      title={
        isEditing
          ? t('employees.form.editTitle')
          : t('employees.form.createTitle')
      }
      onClose={onClose}
      closeLabel={t('common.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      shellClassName="catalog-edit-modal modal-dialog employees-form-modal"
      footer={
        <footer className="payment-modal-footer">
          <div className="payment-modal-actions">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {isSaving
                ? t('employees.form.saving')
                : isEditing
                  ? t('employees.form.updateEmployee')
                  : t('employees.form.saveEmployee')}
            </Button>
          </div>
        </footer>
      }
    >
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
            {isEditing
              ? t('employees.form.newPassword')
              : t('employees.form.password')}
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
            onChange={(event) =>
              handleRoleChange(
                event.target.value as EmployeeFormValues['role'],
              )
            }
          >
            {employeeRoleOptions
              .filter((role) => canManageOwnerAccounts || role !== 'owner')
              .map((role) => (
                <option key={role} value={role}>
                  {t(employeeRoleLabelKey(role))}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>{t('employees.form.status')}</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) =>
              onChange('isActive', event.target.value === 'active')
            }
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
                <span>{t(employeePermissionLabelKey(permission))}</span>
              </label>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
};
