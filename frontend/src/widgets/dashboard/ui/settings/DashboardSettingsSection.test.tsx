import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../../entities/settings/model/printForms';
import { DashboardSettingsSection } from './DashboardSettingsSection';

describe('DashboardSettingsSection', () => {
  it('disables weather controls when weather is off', () => {
    const form = createDefaultSettingsForm();
    const onChange = vi.fn();
    render(
      <DashboardSettingsSection
        preferences={{ ...form.dashboardPreferences, weatherEnabled: false }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Weather location')).toBeDisabled();
    expect(screen.getByLabelText('Weather API provider')).toBeDisabled();
    expect(screen.getByLabelText('Enable weather animation')).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables rate chips when exchange rates are off', () => {
    const form = createDefaultSettingsForm();
    render(
      <DashboardSettingsSection
        preferences={{ ...form.dashboardPreferences, exchangeRatesEnabled: false }}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'USD' })).toBeDisabled();
  });
});
