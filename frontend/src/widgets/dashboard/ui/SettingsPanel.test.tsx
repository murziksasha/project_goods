import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import type { AppSettingsFormValues } from '../../../entities/settings/model/types';
import { SettingsPanel } from './SettingsPanel';
import { useState } from 'react';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const SettingsPanelHarness = () => {
  const [form, setForm] = useState<AppSettingsFormValues>(
    createDefaultSettingsForm,
  );

  return (
    <SettingsPanel
      form={form}
      isSaving={false}
      onChange={(field, value) =>
        setForm((current) => ({ ...current, [field]: value }))
      }
      onSubmit={() => undefined}
    />
  );
};

describe('SettingsPanel', () => {
  it('allows saving default optional company print fields', async () => {
    render(<SettingsPanelHarness />);

    expect(screen.getByLabelText('Company address ({{company_address}})')).toHaveValue('');
    expect(screen.getByLabelText('Company ID ({{company_id}})')).toHaveValue('');
    expect(screen.getByLabelText('Company IBAN ({{company_iban}})')).toHaveValue('');
    expect(screen.getByLabelText('Company e-mail ({{company_email}})')).toHaveValue('');
    expect(screen.getByLabelText('Company site ({{company_site}})')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  });

  it('disables save when an optional company field is filled with an invalid value', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.change(screen.getByLabelText('Company IBAN ({{company_iban}})'), {
      target: { value: 'bad-iban' },
    });

    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('keeps valid company print fields in form state', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.change(screen.getByLabelText('Company address ({{company_address}})'), {
      target: { value: 'Kyiv, Main street 1' },
    });
    fireEvent.change(screen.getByLabelText('Company ID ({{company_id}})'), {
      target: { value: '12345678' },
    });
    fireEvent.change(screen.getByLabelText('Company IBAN ({{company_iban}})'), {
      target: { value: 'UA123456789123456789123456789' },
    });
    fireEvent.change(screen.getByLabelText('Company e-mail ({{company_email}})'), {
      target: { value: 'billing@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Company site ({{company_site}})'), {
      target: { value: 'https://example.com' },
    });

    expect(screen.getByLabelText('Company address ({{company_address}})')).toHaveValue('Kyiv, Main street 1');
    expect(screen.getByLabelText('Company ID ({{company_id}})')).toHaveValue('12345678');
    expect(screen.getByLabelText('Company IBAN ({{company_iban}})')).toHaveValue('UA123456789123456789123456789');
    expect(screen.getByLabelText('Company e-mail ({{company_email}})')).toHaveValue('billing@example.com');
    expect(screen.getByLabelText('Company site ({{company_site}})')).toHaveValue('https://example.com');
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  });

  it('supports print form add, duplicate, delete and live preview', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Print forms' }));
    expect(document.body.textContent).toContain('r000124');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByDisplayValue('New template')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heading' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editable table' }));
    expect(screen.getAllByText('Editable table').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Duplicate' })[0]);
    expect(screen.getByDisplayValue('New template copy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete template' }));
    expect(screen.getByText('New template')).toBeInTheDocument();
  }, 10000);
  it('disables save while service name is invalid', async () => {
    render(<SettingsPanelHarness />);

    const serviceName = screen.getByLabelText('Service name in header');
    fireEvent.change(serviceName, { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });
});
