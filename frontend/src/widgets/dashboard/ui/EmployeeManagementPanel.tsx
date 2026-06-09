import { useRef, useState } from 'react';
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
  title: string;
  permissions: EmployeePermission[];
}> = [
  {
    title: 'Orders',
    permissions: [
      'orders.view',
      'orders.manage',
      'orders.chat',
      'repairs.execute',
      'sales.manage',
    ],
  },
  {
    title: 'Supplier Orders',
    permissions: ['supplierOrders.view', 'supplierOrders.manage'],
  },
  {
    title: 'Clients',
    permissions: ['clients.manage'],
  },
  {
    title: 'Inventory',
    permissions: ['inventory.manage'],
  },
  {
    title: 'Finance',
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
    title: 'Employees',
    permissions: ['employees.manage'],
  },
  {
    title: 'System',
    permissions: ['system.backups.manage'],
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
          <p className="section-label">List</p>
          <h2>Team</h2>
        </div>
      </div>

      {isLoading ? (
        <p className="empty-state">Loading employees...</p>
      ) : employees.length === 0 ? (
        <p className="empty-state">No employees yet.</p>
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
                    <p>{employee.email || 'No email'} | {employee.phone || 'No phone'} | {employee.role}</p>
                    <p>{employee.username || 'No login'}{isCurrentEmployee ? ' | current user' : ''}</p>
                    <p>{employee.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="card-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleEdit(employee)}
                      disabled={!canManageEmployees || !canWriteThisEmployee}
                    >
                      Edit
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => setEmployeeToDelete(employee)}
                      disabled={!canManageEmployees || isCurrentEmployee || !canWriteThisEmployee}
                      title={isCurrentEmployee ? 'You cannot delete your own account.' : 'Delete employee'}
                    >
                      Delete
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
        <p className="empty-state">Only owners can create, edit, or delete employees.</p>
      ) : null}

      <div className="panel-header" style={{marginTop:80}}>
        <div>
          <p className="section-label">Employees</p>
          <h2>{isEditing ? 'Edit employee' : 'Create employee'}</h2>
        </div>
        {isEditing ? (
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            Cancel
          </button>
        ) : null}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input
            value={form.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="Full name"
          />
        </label>
        <label className="field">
          <span>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => onChange('phone', event.target.value)}
            placeholder="+380..."
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => onChange('email', event.target.value)}
            placeholder="employee@example.com"
          />
        </label>
        <label className="field">
          <span>Login</span>
          <input
            value={form.username}
            onChange={(event) => onChange('username', event.target.value)}
            placeholder="login"
          />
        </label>
        <label className="field">
          <span>{isEditing ? 'New password' : 'Password'}</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => onChange('password', event.target.value)}
            placeholder={isEditing ? 'Leave blank to keep current password' : 'Password'}
          />
        </label>
        <label className="field">
          <span>Role</span>
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
          <span>Status</span>
          <select
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) => onChange('isActive', event.target.value === 'active')}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="field field-wide">
          <span>Note</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) => onChange('note', event.target.value)}
          />
        </label>
      </div>

      <div className="employee-permissions">
        {permissionGroups.map((group) => (
          <section key={group.title} className="employee-permission-group">
            <h3>{group.title}</h3>
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
        {isSaving ? 'Saving...' : isEditing ? 'Update employee' : 'Save employee'}
      </button>

      {employeeToDelete ? (
        <div className="modal-backdrop" role="presentation">
          <section className="payment-modal payment-modal-message" role="dialog" aria-modal="true">
            <div className="payment-modal-summary">
              <h3>Delete employee</h3>
              <p>
                Are you sure you want to delete user "{employeeToDelete.name}"?
              </p>
            </div>
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setEmployeeToDelete(null)}>
                  Cancel
                </button>
                <button type="button" className="danger-button" onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};
