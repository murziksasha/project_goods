import { describe, expect, it } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { getEffectiveDashboardWidgetSettings } from './dashboard-widget-settings';

describe('getEffectiveDashboardWidgetSettings', () => {
  const preferences = createDefaultSettingsForm().dashboardPreferences;

  it('defaults collapsed to false', () => {
    expect(getEffectiveDashboardWidgetSettings(preferences, {}).collapsed).toBe(false);
  });

  it('reads collapsed override when provided', () => {
    expect(
      getEffectiveDashboardWidgetSettings(preferences, { collapsed: true }).collapsed,
    ).toBe(true);
  });
});