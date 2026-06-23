import { describe, expect, it } from 'vitest';
import {
  mapOpenWeatherIdToScene,
  mapWeatherCodeToCondition,
  mapWeatherCodeToScene,
} from './service';

describe('weather service', () => {
  it('maps known WMO weather codes to conditions', () => {
    expect(mapWeatherCodeToCondition(0)).toBe('clear');
    expect(mapWeatherCodeToCondition(61)).toBe('rain');
    expect(mapWeatherCodeToCondition(95)).toBe('thunder');
    expect(mapWeatherCodeToCondition(999)).toBe('cloudy');
  });

  it('maps WMO codes to scene intensity', () => {
    expect(mapWeatherCodeToScene(61)).toEqual({
      condition: 'rain',
      intensity: 'light',
    });
    expect(mapWeatherCodeToScene(65)).toEqual({
      condition: 'rain',
      intensity: 'heavy',
    });
    expect(mapWeatherCodeToScene(2)).toEqual({ condition: 'partly-cloudy' });
  });

  it('maps OpenWeather condition ids to the same scene vocabulary as WMO', () => {
    expect(mapOpenWeatherIdToScene(800)).toEqual({ condition: 'clear' });
    expect(mapOpenWeatherIdToScene(801)).toEqual({ condition: 'partly-cloudy' });
    expect(mapOpenWeatherIdToScene(804)).toEqual({ condition: 'cloudy' });
    expect(mapOpenWeatherIdToScene(500)).toEqual({
      condition: 'rain',
      intensity: 'light',
    });
    expect(mapOpenWeatherIdToScene(502)).toEqual({
      condition: 'rain',
      intensity: 'heavy',
    });
    expect(mapOpenWeatherIdToScene(600)).toEqual({
      condition: 'snow',
      intensity: 'light',
    });
    expect(mapOpenWeatherIdToScene(602)).toEqual({
      condition: 'snow',
      intensity: 'heavy',
    });
    expect(mapOpenWeatherIdToScene(200)).toEqual({
      condition: 'thunder',
      intensity: 'light',
    });
    expect(mapOpenWeatherIdToScene(202)).toEqual({
      condition: 'thunder',
      intensity: 'heavy',
    });
    expect(mapOpenWeatherIdToScene(741)).toEqual({
      condition: 'fog',
      intensity: 'moderate',
    });
  });
});