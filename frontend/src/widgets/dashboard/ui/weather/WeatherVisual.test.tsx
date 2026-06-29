import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import { WeatherVisual } from './WeatherVisual';

afterEach(() => {
  cleanup();
});

const renderWeatherVisual = (props: ComponentProps<typeof WeatherVisual>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <WeatherVisual {...props} />
    </I18nextProvider>,
  );

describe('WeatherVisual', () => {
  it('renders animated scene with wind and intensity metadata', () => {
    const { container } = renderWeatherVisual({
      condition: 'rain',
      temperature: 18,
      humidity: 72,
      intensity: 'heavy',
      windSpeed: 24,
      windGust: 38,
      windDirection: 90,
      label: 'Today',
      animated: true,
    });

    expect(container.querySelector('.weather-visual-media')).toBeTruthy();
    expect(container.querySelector('.weather-scene--intensity-heavy')).toBeTruthy();
    expect(screen.getByText(/Wind 24 km\/h E/)).toBeTruthy();
    expect(screen.getByText(/gusts 38 km\/h/)).toBeTruthy();
    expect(screen.getByText('Heavy rain')).toBeTruthy();
  });

  it('uses static icon in compact mode even when animated is enabled', () => {
    const { container } = renderWeatherVisual({
      condition: 'clear',
      temperature: 22,
      label: 'Mon',
      compact: true,
      animated: true,
    });

    expect(container.querySelector('.weather-scene')).toBeNull();
    expect(container.querySelector('.weather-icon')).toBeTruthy();
  });
});