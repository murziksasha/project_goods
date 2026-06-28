import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WeatherAnimatedScene } from './WeatherAnimatedScene';

afterEach(() => {
  cleanup();
});

describe('WeatherAnimatedScene', () => {
  it('renders sky layers for every condition', () => {
    const { container } = render(<WeatherAnimatedScene condition="rain" />);

    expect(container.querySelector('.weather-scene-sky-fallback')).toBeTruthy();
    expect(container.querySelector('.weather-scene-sky')).toBeTruthy();
  });

  it('renders sun and svg rays for clear', () => {
    const { container } = render(<WeatherAnimatedScene condition="clear" />);

    expect(container.querySelector('.weather-scene-sun-glow')).toBeTruthy();
    expect(container.querySelector('.weather-scene-sun-graphic-full')).toBeTruthy();
    expect(container.querySelector('.weather-scene-sun-rays-svg')).toBeTruthy();
    expect(container.querySelector('.weather-scene-cloud')).toBeNull();
  });

  it('renders sun glow, rays, and clouds for partly-cloudy', () => {
    const { container } = render(<WeatherAnimatedScene condition="partly-cloudy" />);

    expect(container.querySelector('.weather-scene-sun-glow-small')).toBeTruthy();
    expect(container.querySelector('.weather-scene-sun-graphic-small')).toBeTruthy();
    expect(container.querySelector('.weather-scene-sun-rays-svg')).toBeTruthy();
    expect(container.querySelectorAll('.weather-scene-cloud')).toHaveLength(2);
  });

  it('renders clouds without sun for cloudy', () => {
    const { container } = render(<WeatherAnimatedScene condition="cloudy" />);

    expect(container.querySelector('.weather-scene-sun-graphic')).toBeNull();
    expect(container.querySelectorAll('.weather-scene-cloud')).toHaveLength(3);
  });

  it('renders rain drops for rain', () => {
    const { container } = render(<WeatherAnimatedScene condition="rain" />);

    expect(container.querySelectorAll('.weather-scene-rain-drop').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.weather-scene-cloud-dark')).toHaveLength(2);
  });

  it('marks animated scenes for css-driven motion', () => {
    const { container } = render(
      <WeatherAnimatedScene condition="clear" animated />,
    );

    expect(container.querySelector('.weather-scene--animated')).toBeTruthy();
  });

  it.each([
    ['fog', '.weather-scene-fog'],
    ['snow', '.weather-scene-snow'],
    ['thunder', '.weather-scene-lightning'],
  ] as const)('renders %s scene elements', (condition, selector) => {
    const { container } = render(<WeatherAnimatedScene condition={condition} animated />);
    expect(container.querySelector(selector)).toBeTruthy();
  });

  it('applies intensity and wind modifiers for openweather-like payloads', () => {
    const { container } = render(
      <WeatherAnimatedScene
        condition="rain"
        intensity="heavy"
        windSpeed={32}
        windDirection={90}
        animated
      />,
    );

    expect(container.querySelector('.weather-scene--intensity-heavy')).toBeTruthy();
    expect(container.querySelector('.weather-scene--wind-windy')).toBeTruthy();
    expect(container.querySelector('.weather-scene-wind-streaks')).toBeTruthy();
  });
});