import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  Employee,
  EmployeeFormValues,
  EmployeeRole,
} from '../../../../entities/employee/model/types';
import { employeeRoleOptions } from '../../../../entities/employee/model/types';
import { Button } from '../../../../shared/ui/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { LoadingState } from '../../../../shared/ui/LoadingState';
import { Modal } from '../../../../shared/ui/Modal';
import { PageHeader } from '../../../../shared/ui/PageHeader';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';
import { PhoneNumber } from '../shared/PhoneNumber';
import { EmployeeFormModal } from './EmployeeFormModal';
import { employeeRoleLabelKey, employeeRoleTone } from './employee-ui';

type EmployeeStatusFilter = 'all' | 'active' | 'inactive';

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
  onSubmit: () => void | Promise<boolean | void>;
  onCancelEdit: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
};

const matchesEmployeeSearch = (
  employee: Employee,
  query: string,
  roleLabel: string,
) => {
  if (!query) {
    return true;
  }
  const haystack = [
    employee.name,
    employee.username,
    employee.email,
    employee.phone,
    employee.role,
    roleLabel,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
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
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(
    null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all');
  const [statusFilter, setStatusFilter] =
    useState<EmployeeStatusFilter>('all');

  const activeCount = employees.filter((employee) => employee.isActive).length;
  const inactiveCount = employees.length - activeCount;
  const normalizedSearch = search.trim().toLowerCase();

  const visibleEmployees = useMemo(
    () =>
      employees.filter((employee) => {
        if (statusFilter === 'active' && !employee.isActive) {
          return false;
        }
        if (statusFilter === 'inactive' && employee.isActive) {
          return false;
        }
        if (roleFilter !== 'all' && employee.role !== roleFilter) {
          return false;
        }
        return matchesEmployeeSearch(
          employee,
          normalizedSearch,
          t(employeeRoleLabelKey(employee.role)),
        );
      }),
    [employees, normalizedSearch, roleFilter, statusFilter, t],
  );

  const closeForm = () => {
    setIsFormOpen(false);
    onCancelEdit();
  };

  const openCreate = () => {
    onCancelEdit();
    setIsFormOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    if (!canManageEmployees) {
      return;
    }
    if (employee.role === 'owner' && !canManageOwnerAccounts) {
      return;
    }
    onEdit(employee);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    const result = await onSubmit();
    if (result !== false) {
      setIsFormOpen(false);
    }
    return result;
  };

  const confirmDelete = () => {
    if (!employeeToDelete) {
      return;
    }
    onDelete(employeeToDelete);
    setEmployeeToDelete(null);
  };

  return (
    <section className="panel employees-management">
      <PageHeader
        title={t('employees.list.title')}
        subtitle={t('employees.list.activeCount', {
          active: activeCount,
          inactive: inactiveCount,
        })}
        actions={
          canManageEmployees ? (
            <Button variant="primary" onClick={openCreate}>
              {t('employees.list.addEmployee')}
            </Button>
          ) : null
        }
        toolbar={
          <div className="employees-toolbar">
            <label className="field employees-toolbar-search">
              <span className="visually-hidden">
                {t('employees.information.filters.search')}
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('employees.list.searchPlaceholder')}
              />
            </label>
            <label className="field">
              <span>{t('employees.list.filterRole')}</span>
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as EmployeeRole | 'all')
                }
              >
                <option value="all">{t('employees.list.allRoles')}</option>
                {employeeRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {t(employeeRoleLabelKey(role))}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('employees.list.filterStatus')}</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as EmployeeStatusFilter)
                }
              >
                <option value="all">{t('employees.list.allStatuses')}</option>
                <option value="active">{t('employees.list.active')}</option>
                <option value="inactive">{t('employees.list.inactive')}</option>
              </select>
            </label>
          </div>
        }
      />

      {!canManageEmployees ? (
        <EmptyState>{t('employees.list.noPermission')}</EmptyState>
      ) : null}

      {isLoading ? (
        <LoadingState>{t('employees.list.loading')}</LoadingState>
      ) : employees.length === 0 ? (
        <EmptyState>{t('employees.list.empty')}</EmptyState>
      ) : visibleEmployees.length === 0 ? (
        <EmptyState>{t('employees.list.noMatches')}</EmptyState>
      ) : (
        <div className="stack-list">
          {visibleEmployees.map((employee) => {
            const isCurrentEmployee = employee.id === currentEmployeeId;
            const canWriteThisEmployee =
              employee.role !== 'owner' || canManageOwnerAccounts;

            return (
              <article
                key={employee.id}
                className="list-card employee-card"
                onClick={() => handleEdit(employee)}
              >
                <div className="list-card-row">
                  <div className="employee-card-main">
                    <div className="employee-card-title-row">
                      <button
                        type="button"
                        className="catalog-name-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEdit(employee);
                        }}
                      >
                        {employee.name}
                      </button>
                      <StatusBadge
                        label={t(employeeRoleLabelKey(employee.role))}
                        tone={employeeRoleTone[employee.role]}
                      />
                      {!employee.isActive ? (
                        <span className="catalog-inactive-badge">
                          {t('employees.list.inactiveBadge')}
                        </span>
                      ) : null}
                      {isCurrentEmployee ? (
                        <span className="employee-current-badge">
                          {t('employees.list.currentUser')}
                        </span>
                      ) : null}
                    </div>
                    <dl className="employee-card-meta">
                      <div>
                        <dt>{t('employees.list.metaLogin')}</dt>
                        <dd>
                          {employee.username || t('employees.list.noLogin')}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('employees.list.metaEmail')}</dt>
                        <dd>{employee.email || t('employees.list.noEmail')}</dd>
                      </div>
                      <div>
                        <dt>{t('employees.list.metaPhone')}</dt>
                        <dd>
                          {employee.phone ? (
                            <PhoneNumber value={employee.phone} />
                          ) : (
                            t('employees.list.noPhone')
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="card-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(employee);
                      }}
                      disabled={!canManageEmployees || !canWriteThisEmployee}
                    >
                      {t('employees.list.edit')}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEmployeeToDelete(employee);
                      }}
                      disabled={
                        !canManageEmployees ||
                        isCurrentEmployee ||
                        !canWriteThisEmployee
                      }
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

      <EmployeeFormModal
        form={form}
        isOpen={isFormOpen}
        isSaving={isSaving}
        isEditing={isEditing}
        canManageEmployees={canManageEmployees}
        canManageOwnerAccounts={canManageOwnerAccounts}
        onChange={onChange}
        onSubmit={handleSubmit}
        onClose={closeForm}
      />

      {employeeToDelete ? (
        <Modal
          isOpen
          title={t('employees.deleteModal.title')}
          onClose={() => setEmployeeToDelete(null)}
          closeLabel={t('common.close')}
          shellClassName="payment-modal payment-modal-message modal-dialog"
          footer={
            <footer className="payment-modal-footer">
              <div className="payment-modal-actions">
                <Button
                  variant="secondary"
                  onClick={() => setEmployeeToDelete(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button variant="danger" onClick={confirmDelete}>
                  {t('common.delete')}
                </Button>
              </div>
            </footer>
          }
        >
          <p>
            {t('employees.deleteModal.message', {
              name: employeeToDelete.name,
            })}
          </p>
        </Modal>
      ) : null}
    </section>
  );
};
