import { useRef, useState } from 'react';
import type {
  Employee,
  EmployeeFormValues,
  EmployeePermission,
} from '../../../entities/employee/model/types';
import {
  employeePermissionOptions,
  employeeRoleOptions,
} from '../../../entities/employee/model/types';

type EmployeeManagementPanelProps = {
  employees: Employee[];
  form: EmployeeFormValues;
  isLoading: boolean;
  isSaving: boolean;
  isEditing: boolean;
  canManageEmployees: boolean;
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
  currentEmployeeId,
  onChange,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
}: EmployeeManagementPanelProps) => {
  const formTopRef = useRef<HTMLDivElement | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const togglePermission = (permission: EmployeePermission) => {
    if (form.permissions.includes(permission)) {
      onChange(
        'permissions',
        form.permissions.filter((item) => item !== permission),
      );
      return;
    }
    onChange('permissions', [...form.permissions, permission]);
  };

  const confirmDelete = () => {
    if (!employeeToDelete) {
      return;
    }

    onDelete(employeeToDelete);
    setEmployeeToDelete(null);
  };

  const handleEdit = (employee: Employee) => {
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
                      disabled={!canManageEmployees}
                    >
                      Edit
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => setEmployeeToDelete(employee)}
                      disabled={!canManageEmployees || isCurrentEmployee}
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
            onChange={(event) => onChange('role', event.target.value as EmployeeFormValues['role'])}
          >
            {employeeRoleOptions.map((role) => (
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
        {employeePermissionOptions.map((permission) => (
          <label key={permission} className="create-inline-checkbox">
            <input
              type="checkbox"
              checked={form.permissions.includes(permission)}
              onChange={() => togglePermission(permission)}
            />
            <span>{permission}</span>
          </label>
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
