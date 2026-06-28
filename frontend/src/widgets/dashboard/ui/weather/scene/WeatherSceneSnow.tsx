type WeatherSceneSnowProps = {
  flakeCount: number;
  intensity?: string;
};

export const WeatherSceneSnow = ({ flakeCount, intensity }: WeatherSceneSnowProps) => (
  <div className="weather-scene-snow">
    {Array.from({ length: flakeCount }, (_, index) => (
      <span
        key={index}
        className={[
          'weather-scene-snowflake',
          intensity === 'heavy' ? 'weather-scene-snowflake-heavy' : '',
          intensity === 'light' ? 'weather-scene-snowflake-light' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          left: `${4 + index * (90 / Math.max(flakeCount - 1, 1))}%`,
          animationDelay: `${index * 0.16}s`,
          animationDuration: `${2.2 + (index % 3) * 0.35}s`,
        }}
      />
    ))}
  </div>
);