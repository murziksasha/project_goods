import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeatherVisual } from './WeatherVisual';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'analytics.marketWeather.windWithDirection') {
        return `Wind ${options?.speed} km/h ${options?.direction}`;
      }
      if (key === 'analytics.marketWeather.windGust') {
        return `, gusts ${options?.speed} km/h`;
      }
      if (key === 'analytics.marketWeather.humidity') {
        return `Humidity ${options?.value}%`;
      }
      if (key === 'analytics.marketWeather.conditionsWithIntensity.rain.heavy') {
        return 'Heavy rain';
      }
      if (key.startsWith('analytics.marketWeather.compass.')) {
        return String(options?.defaultValue ?? key.split('.').pop());
      }
      return key;
    },
  }),
}));

afterEach(() => {
  cleanup();
});

describe('WeatherVisual', () => {
  it('renders animated scene with wind and intensity metadata', () => {
    const { container } = render(
      <WeatherVisual
        condition="rain"
        temperature={18}
        humidity={72}
        intensity="heavy"
        windSpeed={24}
        windGust={38}
        windDirection={90}
        label="Today"
        animated
      />,
    );

    expect(container.querySelector('.weather-visual-media')).toBeTruthy();
    expect(container.querySelector('.weather-scene--intensity-heavy')).toBeTruthy();
    expect(screen.getByText(/Wind 24 km\/h E/)).toBeTruthy();
    expect(screen.getByText(/gusts 38 km\/h/)).toBeTruthy();
    expect(screen.getByText('Heavy rain')).toBeTruthy();
  });

  it('uses static icon in compact mode even when animated is enabled', () => {
    const { container } = render(
      <WeatherVisual
        condition="clear"
        temperature={22}
        label="Mon"
        compact
        animated
      />,
    );

    expect(container.querySelector('.weather-scene')).toBeNull();
    expect(container.querySelector('.weather-icon')).toBeTruthy();
  });
});