import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialEmployeeForm } from '../../../../entities/employee/model/forms';
import type { EmployeeFormValues } from '../../../../entities/employee/model/types';
import { EmployeeManagementPanel } from './EmployeeManagementPanel';
import { useState } from 'react';

afterEach(() => {
  cleanup();
});

const PanelHarness = ({
  initialForm = initialEmployeeForm,
}: {
  initialForm?: EmployeeFormValues;
}) => {
  const [form, setForm] = useState<EmployeeFormValues>(initialForm);

  return (
    <EmployeeManagementPanel
      employees={[]}
      form={form}
      isLoading={false}
      isSaving={false}
      isEditing={false}
      canManageEmployees={true}
      canManageOwnerAccounts={true}
      currentEmployeeId="owner-id"
      onChange={(field, value) =>
        setForm((currentForm) => ({ ...currentForm, [field]: value }))
      }
      onSubmit={vi.fn()}
      onCancelEdit={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />
  );
};

describe('EmployeeManagementPanel', () => {
  it('activates default permission checkboxes when role changes', () => {
    render(<PanelHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'warehouse' },
    });

    expect(screen.getByLabelText('orders.view')).toBeChecked();
    expect(screen.getByLabelText('inventory.manage')).toBeChecked();
    expect(screen.getByLabelText('supplierOrders.view')).toBeChecked();
    expect(screen.getByLabelText('supplierOrders.manage')).toBeChecked();
    expect(screen.getByLabelText('orders.manage')).not.toBeChecked();
  });

  it('activates supplier-order and inventory defaults for manager role', () => {
    render(<PanelHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'manager' },
    });

    expect(screen.getByLabelText('orders.view')).toBeChecked();
    expect(screen.getByLabelText('orders.manage')).toBeChecked();
    expect(screen.getByLabelText('orders.chat')).toBeChecked();
    expect(screen.getByLabelText('inventory.manage')).toBeChecked();
    expect(screen.getByLabelText('supplierOrders.view')).toBeChecked();
    expect(screen.getByLabelText('supplierOrders.manage')).toBeChecked();
  });

  it('activates orders.chat for master defaults', () => {
    render(<PanelHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'master' },
    });

    expect(screen.getByLabelText('orders.view')).toBeChecked();
    expect(screen.getByLabelText('orders.chat')).toBeChecked();
    expect(screen.getByLabelText('repairs.execute')).toBeChecked();
  });

  it('does not activate orders.chat for sales and support defaults', () => {
    render(<PanelHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'sales' },
    });
    expect(screen.getByLabelText('orders.chat')).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'support' },
    });
    expect(screen.getByLabelText('orders.chat')).not.toBeChecked();
  });

  it('renders supplier-order permission checkboxes', () => {
    render(<PanelHarness />);

    expect(screen.getByText('Supplier Orders')).toBeInTheDocument();
    expect(screen.getByLabelText('supplierOrders.view')).toBeInTheDocument();
    expect(screen.getByLabelText('supplierOrders.manage')).toBeInTheDocument();
    expect(screen.getByLabelText('orders.chat')).toBeInTheDocument();
  });

  it('renders print form permission checkbox for non-owner roles', () => {
    render(<PanelHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'manager' },
    });

    const printFormsPermission = screen.getByLabelText('printForms.manage');
    expect(printFormsPermission).toBeInTheDocument();
    expect(printFormsPermission).not.toBeChecked();

    fireEvent.click(printFormsPermission);
    expect(printFormsPermission).toBeChecked();
  });

  it('keeps employees.manage checked and locked for owner role', () => {
    render(<PanelHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'owner' },
    });

    const employeeManagerPermission = screen.getByLabelText('employees.manage');
    expect(employeeManagerPermission).toBeChecked();
    expect(employeeManagerPermission).toBeDisabled();
  });
});
