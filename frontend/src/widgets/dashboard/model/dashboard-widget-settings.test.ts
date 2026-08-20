import { describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { getEffectiveDashboardWidgetSettings } from './dashboard-widget-settings';

describe('getEffectiveDashboardWidgetSettings', () => {
  const preferences = createDefaultSettingsForm().dashboardPreferences;

  it('defaults collapsed to false on wide viewports', () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(getEffectiveDashboardWidgetSettings(preferences, {}).collapsed).toBe(false);
  });

  it('defaults collapsed to true on tablet/phone widths', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('1024px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    expect(getEffectiveDashboardWidgetSettings(preferences, {}).collapsed).toBe(true);
  });

  it('reads collapsed override when provided', () => {
    expect(
      getEffectiveDashboardWidgetSettings(preferences, { collapsed: true }).collapsed,
    ).toBe(true);
  });
});