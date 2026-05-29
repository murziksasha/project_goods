import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import type { AppSettingsFormValues } from '../../../entities/settings/model/types';
import { SettingsPanel } from './SettingsPanel';
import { useState } from 'react';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
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
  it('supports print form add, duplicate, delete and live preview', async () => {
    render(<SettingsPanelHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Print forms' }));
    expect(screen.getAllByText('Квитанція').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('r000124');

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByDisplayValue('Новий шаблон')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByDisplayValue('Новий шаблон копія')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Видалити шаблон' }));
    expect(screen.getByText('Новий шаблон')).toBeInTheDocument();
  });

  it('disables save while service name is invalid', async () => {
    render(<SettingsPanelHarness />);

    const serviceName = screen.getByLabelText('Service name in header');
    fireEvent.change(serviceName, { target: { value: '' } });

    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });
});
