import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { initialEmployeeForm } from '../../../../entities/employee/model/forms';
import type { EmployeeFormValues } from '../../../../entities/employee/model/types';
import i18n from '../../../../shared/i18n/config';
import { EmployeeFormModal } from './EmployeeFormModal';

afterEach(() => {
  cleanup();
});

const ModalHarness = ({
  initialForm = initialEmployeeForm,
  isEditing = false,
}: {
  initialForm?: EmployeeFormValues;
  isEditing?: boolean;
}) => {
  const [form, setForm] = useState<EmployeeFormValues>(initialForm);

  return (
    <I18nextProvider i18n={i18n}>
      <EmployeeFormModal
        form={form}
        isOpen
        isSaving={false}
        isEditing={isEditing}
        canManageEmployees
        canManageOwnerAccounts
        onChange={(field, value) =>
          setForm((currentForm) => ({ ...currentForm, [field]: value }))
        }
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />
    </I18nextProvider>
  );
};

describe('EmployeeFormModal', () => {
  it('renders kanban.use in a separate Kanban group', () => {
    render(<ModalHarness />);

    expect(screen.getByText('Kanban')).toBeInTheDocument();
    expect(screen.getByLabelText('Use Kanban')).not.toBeChecked();
  });

  it('activates default permission checkboxes when role changes', () => {
    render(<ModalHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'warehouse' },
    });

    expect(screen.getByLabelText('View orders')).toBeChecked();
    expect(screen.getByLabelText('Manage inventory')).toBeChecked();
    expect(screen.getByLabelText('View supplier orders')).toBeChecked();
    expect(screen.getByLabelText('Manage supplier orders')).toBeChecked();
    expect(screen.getByLabelText('Manage orders')).not.toBeChecked();
    expect(screen.getByLabelText('Use Kanban')).not.toBeChecked();
  });

  it('activates supplier-order and inventory defaults for manager role', () => {
    render(<ModalHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'manager' },
    });

    expect(screen.getByLabelText('View orders')).toBeChecked();
    expect(screen.getByLabelText('Manage orders')).toBeChecked();
    expect(screen.getByLabelText('Order chat')).toBeChecked();
    expect(screen.getByLabelText('Manage inventory')).toBeChecked();
    expect(screen.getByLabelText('View supplier orders')).toBeChecked();
    expect(screen.getByLabelText('Manage supplier orders')).toBeChecked();
  });

  it('activates orders.chat for master defaults', () => {
    render(<ModalHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'master' },
    });

    expect(screen.getByLabelText('View orders')).toBeChecked();
    expect(screen.getByLabelText('Order chat')).toBeChecked();
    expect(screen.getByLabelText('Execute repairs')).toBeChecked();
  });

  it('does not activate orders.chat for sales and support defaults', () => {
    render(<ModalHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'sales' },
    });
    expect(screen.getByLabelText('Order chat')).not.toBeChecked();

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'support' },
    });
    expect(screen.getByLabelText('Order chat')).not.toBeChecked();
  });

  it('renders supplier-order permission checkboxes', () => {
    render(<ModalHarness />);

    expect(screen.getByText('Supplier Orders')).toBeInTheDocument();
    expect(screen.getByLabelText('View supplier orders')).toBeInTheDocument();
    expect(screen.getByLabelText('Manage supplier orders')).toBeInTheDocument();
    expect(screen.getByLabelText('Order chat')).toBeInTheDocument();
  });

  it('renders print form permission checkbox for non-owner roles', () => {
    render(<ModalHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'manager' },
    });

    const printFormsPermission = screen.getByLabelText('Manage print forms');
    expect(printFormsPermission).toBeInTheDocument();
    expect(printFormsPermission).not.toBeChecked();

    fireEvent.click(printFormsPermission);
    expect(printFormsPermission).toBeChecked();
  });

  it('keeps employees.manage checked and locked for owner role', () => {
    render(<ModalHarness />);

    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'owner' },
    });

    const employeeManagerPermission = screen.getByLabelText('Manage employees');
    expect(employeeManagerPermission).toBeChecked();
    expect(employeeManagerPermission).toBeDisabled();
  });

  it('shows localized role options instead of raw keys', () => {
    render(<ModalHarness />);

    expect(screen.getByRole('option', { name: 'Owner' })).toHaveValue('owner');
    expect(screen.getByRole('option', { name: 'Manager' })).toHaveValue(
      'manager',
    );
  });
});
