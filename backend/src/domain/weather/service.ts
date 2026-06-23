export type WeatherProvider = 'open-meteo' | 'openweather';

export type WeatherIntensity = 'light' | 'moderate' | 'heavy';

export type WeatherDayForecast = {
  date: string;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  weatherCode: number;
  condition: string;
  intensity?: WeatherIntensity;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
};

export type WeatherForecast = {
  provider: WeatherProvider;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  current: WeatherDayForecast;
  tomorrow?: WeatherDayForecast;
  daily: WeatherDayForecast[];
  fetchedAt: string;
};

export type WeatherSceneDescriptor = {
  condition: string;
  intensity?: WeatherIntensity;
};

const weatherCodeMap: Record<number, string> = {
  0: 'clear',
  1: 'partly-cloudy',
  2: 'partly-cloudy',
  3: 'cloudy',
  45: 'fog',
  48: 'fog',
  51: 'rain',
  53: 'rain',
  55: 'rain',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  95: 'thunder',
  96: 'thunder',
  99: 'thunder',
};

const lightIntensityCodes = new Set([51, 61, 71, 80]);
const moderateIntensityCodes = new Set([53, 63, 73, 81, 95]);
const heavyIntensityCodes = new Set([55, 65, 75, 82, 96, 99]);

const conditionToRepresentativeCode = (
  condition: string,
  intensity?: WeatherIntensity,
) => {
  switch (condition) {
    case 'clear':
      return 0;
    case 'partly-cloudy':
      return 2;
    case 'fog':
      return intensity === 'moderate' ? 48 : 45;
    case 'rain':
      if (intensity === 'light') return 61;
      if (intensity === 'heavy') return 65;
      return 63;
    case 'snow':
      if (intensity === 'light') return 71;
      if (intensity === 'heavy') return 75;
      return 73;
    case 'thunder':
      return intensity === 'heavy' ? 96 : 95;
    default:
      return 3;
  }
};

const intensityRank: Record<WeatherIntensity, number> = {
  light: 0,
  moderate: 1,
  heavy: 2,
};

const conditionSeverity: Record<string, number> = {
  clear: 0,
  'partly-cloudy': 1,
  cloudy: 2,
  fog: 3,
  snow: 4,
  rain: 5,
  thunder: 6,
};

const mergeSceneDescriptor = (
  current: WeatherSceneDescriptor,
  next: WeatherSceneDescriptor,
): WeatherSceneDescriptor => {
  const currentSeverity = conditionSeverity[current.condition] ?? 0;
  const nextSeverity = conditionSeverity[next.condition] ?? 0;

  if (nextSeverity > currentSeverity) {
    return next;
  }

  if (nextSeverity < currentSeverity) {
    return current;
  }

  if (
    current.intensity &&
    next.intensity &&
    intensityRank[next.intensity] > intensityRank[current.intensity]
  ) {
    return { ...current, intensity: next.intensity };
  }

  return current;
};

export const mapOpenWeatherIdToScene = (id: number): WeatherSceneDescriptor => {
  if (id === 800) return { condition: 'clear' };
  if (id === 801 || id === 802) return { condition: 'partly-cloudy' };
  if (id === 803 || id === 804) return { condition: 'cloudy' };

  if (id >= 200 && id < 300) {
    if ([202, 212, 221, 232].includes(id)) {
      return { condition: 'thunder', intensity: 'heavy' };
    }
    if ([201, 211, 230, 231].includes(id)) {
      return { condition: 'thunder', intensity: 'moderate' };
    }
    return { condition: 'thunder', intensity: 'light' };
  }

  if (id >= 300 && id < 400) {
    if (id >= 302) return { condition: 'rain', intensity: 'moderate' };
    return { condition: 'rain', intensity: 'light' };
  }

  if (id >= 500 && id < 600) {
    if (id === 500 || id === 520) return { condition: 'rain', intensity: 'light' };
    if (id === 501 || id === 521 || id === 511) {
      return { condition: 'rain', intensity: 'moderate' };
    }
    return { condition: 'rain', intensity: 'heavy' };
  }

  if (id >= 600 && id < 700) {
    if (id === 600) return { condition: 'snow', intensity: 'light' };
    if ([601, 611, 612, 615, 616].includes(id)) {
      return { condition: 'snow', intensity: 'moderate' };
    }
    return { condition: 'snow', intensity: 'heavy' };
  }

  if (id >= 701 && id < 800) {
    if (id === 741) return { condition: 'fog', intensity: 'moderate' };
    return { condition: 'fog', intensity: 'light' };
  }

  return { condition: 'cloudy' };
};

const sceneToRepresentativeCode = (scene: WeatherSceneDescriptor) =>
  conditionToRepresentativeCode(scene.condition, scene.intensity);

export const mapWeatherCodeToCondition = (code: number) =>
  weatherCodeMap[code] ?? 'cloudy';

export const mapWeatherCodeToScene = (code: number): WeatherSceneDescriptor => {
  const condition = mapWeatherCodeToCondition(code);

  if (condition === 'fog') {
    return { condition, intensity: code === 48 ? 'moderate' : 'light' };
  }

  if (
    condition === 'rain' ||
    condition === 'snow' ||
    condition === 'thunder'
  ) {
    if (lightIntensityCodes.has(code)) {
      return { condition, intensity: 'light' };
    }
    if (heavyIntensityCodes.has(code)) {
      return { condition, intensity: 'heavy' };
    }
    return { condition, intensity: 'moderate' };
  }

  return { condition };
};

const roundWind = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
};

const buildDayForecast = ({
  date,
  temperature,
  temperatureMin,
  temperatureMax,
  humidity,
  weatherCode,
  windSpeed,
  windGust,
  windDirection,
}: {
  date: string;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  weatherCode: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
}): WeatherDayForecast => {
  const scene = mapWeatherCodeToScene(weatherCode);
  return {
    date,
    temperature,
    temperatureMin,
    temperatureMax,
    humidity,
    weatherCode,
    condition: scene.condition,
    intensity: scene.intensity,
    windSpeed,
    windGust,
    windDirection,
  };
};

const parseCoordinate = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fetchOpenMeteoForecast = async (
  latitude: number,
  longitude: number,
): Promise<WeatherForecast> => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
  );
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,wind_direction_10m_dominant',
  );
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('forecast_days', '5');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch Open-Meteo forecast');
  }

  const payload = (await response.json()) as {
    current: {
      temperature_2m: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m?: number;
      wind_gusts_10m?: number;
      wind_direction_10m?: number;
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      relative_humidity_2m_mean: number[];
      wind_speed_10m_max?: number[];
      wind_direction_10m_dominant?: number[];
    };
  };

  const fetchedAt = new Date().toISOString();
  const currentCode = payload.current.weather_code;
  const daily = payload.daily.time.map((date, index) => {
    const weatherCode = payload.daily.weather_code[index] ?? 3;
    return buildDayForecast({
      date,
      temperature: Math.round(
        ((payload.daily.temperature_2m_max[index] ?? 0) +
          (payload.daily.temperature_2m_min[index] ?? 0)) /
          2,
      ),
      temperatureMin: Math.round(payload.daily.temperature_2m_min[index] ?? 0),
      temperatureMax: Math.round(payload.daily.temperature_2m_max[index] ?? 0),
      humidity: Math.round(payload.daily.relative_humidity_2m_mean[index] ?? 0),
      weatherCode,
      windSpeed: roundWind(payload.daily.wind_speed_10m_max?.[index]),
      windDirection: roundWind(payload.daily.wind_direction_10m_dominant?.[index]),
    });
  });

  return {
    provider: 'open-meteo',
    latitude,
    longitude,
    fetchedAt,
    current: buildDayForecast({
      date: daily[0]?.date ?? fetchedAt.slice(0, 10),
      temperature: Math.round(payload.current.temperature_2m),
      humidity: Math.round(payload.current.relative_humidity_2m),
      weatherCode: currentCode,
      windSpeed: roundWind(payload.current.wind_speed_10m),
      windGust: roundWind(payload.current.wind_gusts_10m),
      windDirection: roundWind(payload.current.wind_direction_10m),
    }),
    tomorrow: daily[1],
    daily,
  };
};

const fetchOpenWeatherForecast = async (
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<WeatherForecast> => {
  const url = new URL('https://api.openweathermap.org/data/2.5/forecast');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('appid', apiKey);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('cnt', '40');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch OpenWeatherMap forecast');
  }

  const payload = (await response.json()) as {
    list: Array<{
      dt_txt: string;
      main: { temp: number; humidity: number };
      weather: Array<{ main: string; id: number }>;
      wind?: { speed?: number; deg?: number; gust?: number };
    }>;
  };

  const fetchedAt = new Date().toISOString();
  const first = payload.list[0];

  const dailyMap = new Map<string, WeatherDayForecast>();
  payload.list.forEach((entry) => {
    const date = entry.dt_txt.slice(0, 10);
    const existing = dailyMap.get(date);
    const temperature = Math.round(entry.main.temp);
    const windSpeed = roundWind((entry.wind?.speed ?? 0) * 3.6);
    const windDirection = roundWind(entry.wind?.deg);
    const windGust = roundWind((entry.wind?.gust ?? 0) * 3.6);
    const scene = mapOpenWeatherIdToScene(entry.weather[0]?.id ?? 800);

    if (!existing) {
      dailyMap.set(
        date,
        buildDayForecast({
          date,
          temperature,
          temperatureMin: temperature,
          temperatureMax: temperature,
          humidity: Math.round(entry.main.humidity),
          weatherCode: sceneToRepresentativeCode(scene),
          windSpeed,
          windGust,
          windDirection,
        }),
      );
      return;
    }

    existing.temperatureMin = Math.min(existing.temperatureMin ?? temperature, temperature);
    existing.temperatureMax = Math.max(existing.temperatureMax ?? temperature, temperature);
    existing.temperature = Math.round(
      ((existing.temperatureMin ?? temperature) + (existing.temperatureMax ?? temperature)) / 2,
    );
    if ((windSpeed ?? 0) > (existing.windSpeed ?? 0)) {
      existing.windSpeed = windSpeed;
      existing.windDirection = windDirection;
      existing.windGust = windGust;
    }

    const mergedScene = mergeSceneDescriptor(
      {
        condition: existing.condition,
        intensity: existing.intensity,
      },
      scene,
    );
    existing.condition = mergedScene.condition;
    existing.intensity = mergedScene.intensity;
    existing.weatherCode = sceneToRepresentativeCode(mergedScene);
  });

  const daily = Array.from(dailyMap.values()).slice(0, 5);
  const currentScene = mapOpenWeatherIdToScene(first?.weather[0]?.id ?? 800);

  return {
    provider: 'openweather',
    latitude,
    longitude,
    fetchedAt,
    current: buildDayForecast({
      date: first?.dt_txt.slice(0, 10) ?? fetchedAt.slice(0, 10),
      temperature: Math.round(first?.main.temp ?? 0),
      humidity: Math.round(first?.main.humidity ?? 0),
      weatherCode: sceneToRepresentativeCode(currentScene),
      windSpeed: roundWind((first?.wind?.speed ?? 0) * 3.6),
      windGust: roundWind((first?.wind?.gust ?? 0) * 3.6),
      windDirection: roundWind(first?.wind?.deg),
    }),
    tomorrow: daily[1],
    daily,
  };
};

export const getWeatherForecast = async ({
  latitude,
  longitude,
  provider = 'open-meteo',
  openWeatherApiKey = '',
}: {
  latitude: number;
  longitude: number;
  provider?: WeatherProvider;
  openWeatherApiKey?: string;
}) => {
  const lat = parseCoordinate(latitude, 46.3013);
  const lon = parseCoordinate(longitude, 30.6531);

  if (provider === 'openweather') {
    if (!openWeatherApiKey.trim()) {
      throw new Error('OpenWeatherMap API key is required');
    }
    return fetchOpenWeatherForecast(lat, lon, openWeatherApiKey.trim());
  }

  return fetchOpenMeteoForecast(lat, lon);
};