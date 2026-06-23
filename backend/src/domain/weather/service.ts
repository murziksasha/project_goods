export type WeatherProvider = 'open-meteo' | 'openweather';

export type WeatherDayForecast = {
  date: string;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  weatherCode: number;
  condition: string;
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

export const mapWeatherCodeToCondition = (code: number) =>
  weatherCodeMap[code] ?? 'cloudy';

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
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code');
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean',
  );
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
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      relative_humidity_2m_mean: number[];
    };
  };

  const fetchedAt = new Date().toISOString();
  const currentCode = payload.current.weather_code;
  const daily = payload.daily.time.map((date, index) => {
    const weatherCode = payload.daily.weather_code[index] ?? 3;
    return {
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
      condition: mapWeatherCodeToCondition(weatherCode),
    };
  });

  return {
    provider: 'open-meteo',
    latitude,
    longitude,
    fetchedAt,
    current: {
      date: daily[0]?.date ?? fetchedAt.slice(0, 10),
      temperature: Math.round(payload.current.temperature_2m),
      humidity: Math.round(payload.current.relative_humidity_2m),
      weatherCode: currentCode,
      condition: mapWeatherCodeToCondition(currentCode),
    },
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
      weather: Array<{ main: string }>;
    }>;
  };

  const fetchedAt = new Date().toISOString();
  const first = payload.list[0];
  const conditionFromMain = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('rain')) return 'rain';
    if (normalized.includes('snow')) return 'snow';
    if (normalized.includes('thunder')) return 'thunder';
    if (normalized.includes('cloud')) return 'cloudy';
    if (normalized.includes('clear')) return 'clear';
    if (normalized.includes('fog') || normalized.includes('mist')) return 'fog';
    return 'partly-cloudy';
  };

  const dailyMap = new Map<string, WeatherDayForecast>();
  payload.list.forEach((entry) => {
    const date = entry.dt_txt.slice(0, 10);
    const existing = dailyMap.get(date);
    const temperature = Math.round(entry.main.temp);
    if (!existing) {
      dailyMap.set(date, {
        date,
        temperature,
        temperatureMin: temperature,
        temperatureMax: temperature,
        humidity: Math.round(entry.main.humidity),
        weatherCode: 3,
        condition: conditionFromMain(entry.weather[0]?.main ?? 'Clouds'),
      });
      return;
    }
    existing.temperatureMin = Math.min(existing.temperatureMin ?? temperature, temperature);
    existing.temperatureMax = Math.max(existing.temperatureMax ?? temperature, temperature);
    existing.temperature = Math.round(
      ((existing.temperatureMin ?? temperature) + (existing.temperatureMax ?? temperature)) / 2,
    );
  });

  const daily = Array.from(dailyMap.values()).slice(0, 5);
  const currentCondition = conditionFromMain(first?.weather[0]?.main ?? 'Clouds');

  return {
    provider: 'openweather',
    latitude,
    longitude,
    fetchedAt,
    current: {
      date: first?.dt_txt.slice(0, 10) ?? fetchedAt.slice(0, 10),
      temperature: Math.round(first?.main.temp ?? 0),
      humidity: Math.round(first?.main.humidity ?? 0),
      weatherCode: 3,
      condition: currentCondition,
    },
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