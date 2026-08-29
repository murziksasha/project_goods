import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../../entities/settings/model/printForms';
import { getCompanyValidation } from '../../model/settings-panel';
import { CompanySettingsSection } from './CompanySettingsSection';

describe('CompanySettingsSection', () => {
  it('shows appearance and identity groups with print tokens outside labels', () => {
    const form = createDefaultSettingsForm();
    render(
      <CompanySettingsSection
        form={form}
        validation={getCompanyValidation(form)}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Company identity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Company name')).toBeInTheDocument();
    expect(screen.queryByLabelText(/\{\{company\}\}/)).not.toBeInTheDocument();
    expect(screen.getByText('{{company}}')).toBeInTheDocument();
    expect(screen.getByText('{{company_id}}')).toBeInTheDocument();
  });

  it('reports invalid company name', () => {
    const form = { ...createDefaultSettingsForm(), company: 'A' };
    const onChange = vi.fn();
    render(
      <CompanySettingsSection
        form={form}
        validation={getCompanyValidation(form)}
        onChange={onChange}
      />,
    );

    expect(
      screen.getByText('Company name must be at least 2 characters.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Company name'), {
      target: { value: 'Service' },
    });
    expect(onChange).toHaveBeenCalledWith('company', 'Service');
  });
});
