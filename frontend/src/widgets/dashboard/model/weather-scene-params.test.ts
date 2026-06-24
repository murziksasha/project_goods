import { describe, expect, it } from 'vitest';
import {
  degreesToCompass,
  resolveSceneParams,
  resolveWindTier,
} from './weather-scene-params';

describe('weather-scene-params', () => {
  it('resolves wind tiers from km/h speed', () => {
    expect(resolveWindTier(0)).toBe('calm');
    expect(resolveWindTier(12)).toBe('breezy');
    expect(resolveWindTier(29)).toBe('windy');
  });

  it('maps wind direction to compass points', () => {
    expect(degreesToCompass(0)).toBe('N');
    expect(degreesToCompass(90)).toBe('E');
    expect(degreesToCompass(225)).toBe('SW');
  });

  it('scales rain and snow particle counts by intensity', () => {
    const light = resolveSceneParams({
      condition: 'rain',
      intensity: 'light',
    });
    const heavy = resolveSceneParams({
      condition: 'rain',
      intensity: 'heavy',
    });

    expect(light.rainDropCount).toBeLessThan(heavy.rainDropCount);
    expect(heavy.showWindStreaks).toBe(false);
  });

  it('enables wind streaks and slant for windy conditions', () => {
    const windy = resolveSceneParams({
      condition: 'rain',
      windSpeed: 32,
      windDirection: 90,
    });

    expect(windy.windTier).toBe('windy');
    expect(windy.showWindStreaks).toBe(true);
    expect(windy.windSlantDeg).not.toBe(0);
    expect(windy.style['--weather-wind-drift-x']).toBe('8px');
    expect(windy.style['--weather-rain-duration']).toBe('0.75s');
  });
});