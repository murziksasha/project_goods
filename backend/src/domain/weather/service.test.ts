import { describe, expect, it } from 'vitest';
import { mapWeatherCodeToCondition } from './service';

describe('weather service', () => {
  it('maps known weather codes to conditions', () => {
    expect(mapWeatherCodeToCondition(0)).toBe('clear');
    expect(mapWeatherCodeToCondition(61)).toBe('rain');
    expect(mapWeatherCodeToCondition(95)).toBe('thunder');
    expect(mapWeatherCodeToCondition(999)).toBe('cloudy');
  });
});