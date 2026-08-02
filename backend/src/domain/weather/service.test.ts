import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearWeatherForecastCacheForTests,
  getWeatherForecast,
  mapOpenWeatherIdToScene,
  mapWeatherCodeToCondition,
  mapWeatherCodeToScene,
} from './service';

const openMeteoPayload = (temperature: number) => ({
  current: {
    temperature_2m: temperature,
    relative_humidity_2m: 60,
    weather_code: 0,
    wind_speed_10m: 10,
    wind_gusts_10m: 15,
    wind_direction_10m: 90,
  },
  daily: {
    time: ['2026-06-23'],
    weather_code: [0],
    temperature_2m_max: [temperature + 2],
    temperature_2m_min: [temperature - 2],
    relative_humidity_2m_mean: [60],
    wind_speed_10m_max: [12],
    wind_direction_10m_dominant: [90],
  },
});

describe('weather service', () => {
  afterEach(() => {
    clearWeatherForecastCacheForTests();
    vi.restoreAllMocks();
  });

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

  it('returns cached forecast until force bypasses the cache', async () => {
    const fetchMock = vi.fn(async () => {
      const call = fetchMock.mock.calls.length;
      return {
        ok: true,
        json: async () => openMeteoPayload(call === 1 ? 24 : 28),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getWeatherForecast({
      latitude: 46.3013,
      longitude: 30.6531,
      provider: 'open-meteo',
    });
    const cached = await getWeatherForecast({
      latitude: 46.3013,
      longitude: 30.6531,
      provider: 'open-meteo',
    });
    const forced = await getWeatherForecast({
      latitude: 46.3013,
      longitude: 30.6531,
      provider: 'open-meteo',
      force: true,
    });

    expect(first.current.temperature).toBe(24);
    expect(cached.current.temperature).toBe(24);
    expect(forced.current.temperature).toBe(28);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});