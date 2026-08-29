import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialEmployeeForm } from '../../../../entities/employee/model/forms';
import type { Employee } from '../../../../entities/employee/model/types';
import i18n from '../../../../shared/i18n/config';
import { EmployeeManagementPanel } from './EmployeeManagementPanel';

afterEach(() => {
  cleanup();
});

const inactiveEmployee: Employee = {
  id: 'employee-inactive',
  name: 'Former Master',
  phone: '',
  email: '',
  username: 'former',
  role: 'master',
  permissions: ['repairs.execute'],
  isActive: false,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const currentEmployee: Employee = {
  id: 'owner-id',
  name: 'Oleksandr Gryhoriev',
  phone: '+380635567090',
  email: '',
  username: 'murzik',
  role: 'owner',
  permissions: ['employees.manage'],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderPanel = (
  employees: Employee[],
  overrides: Partial<Parameters<typeof EmployeeManagementPanel>[0]> = {},
) => {
  const onEdit = vi.fn();
  const onCancelEdit = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <EmployeeManagementPanel
        employees={employees}
        form={initialEmployeeForm}
        isLoading={false}
        isSaving={false}
        isEditing={false}
        canManageEmployees
        canManageOwnerAccounts
        currentEmployeeId="owner-id"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancelEdit={onCancelEdit}
        onEdit={onEdit}
        onDelete={vi.fn()}
        {...overrides}
      />
    </I18nextProvider>,
  );
  return { onEdit, onCancelEdit };
};

describe('EmployeeManagementPanel', () => {
  it('shows inactive badge after employee name', () => {
    renderPanel([inactiveEmployee]);

    const listCard = screen.getByText('Former Master').closest('.list-card');
    expect(listCard).not.toBeNull();
    expect(
      within(listCard as HTMLElement).getByText('Inactive'),
    ).toHaveClass('catalog-inactive-badge');
    expect(within(listCard as HTMLElement).getByText('Master')).toBeInTheDocument();
  });

  it('shows current-user chip and disables self delete', () => {
    renderPanel([currentEmployee]);

    const listCard = screen.getByText('Oleksandr Gryhoriev').closest('.list-card');
    expect(listCard).not.toBeNull();
    expect(
      within(listCard as HTMLElement).getByText('current user'),
    ).toHaveClass('employee-current-badge');
    expect(
      within(listCard as HTMLElement).getByRole('button', { name: 'Delete' }),
    ).toBeDisabled();
  });

  it('filters employees by search and status', () => {
    renderPanel([inactiveEmployee, currentEmployee]);

    fireEvent.change(screen.getByPlaceholderText('Name, login, email, phone...'), {
      target: { value: 'former' },
    });
    expect(screen.getByText('Former Master')).toBeInTheDocument();
    expect(screen.queryByText('Oleksandr Gryhoriev')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Name, login, email, phone...'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'inactive' },
    });
    expect(screen.getByText('Former Master')).toBeInTheDocument();
    expect(screen.queryByText('Oleksandr Gryhoriev')).not.toBeInTheDocument();
  });

  it('opens create modal from Add employee', () => {
    const { onCancelEdit } = renderPanel([currentEmployee]);

    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }));
    expect(onCancelEdit).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Create employee' })).toBeInTheDocument();
  });

  it('opens edit modal from the employee name', () => {
    const { onEdit } = renderPanel([inactiveEmployee]);

    fireEvent.click(screen.getByRole('button', { name: 'Former Master' }));
    expect(onEdit).toHaveBeenCalledWith(inactiveEmployee);
  });
});
