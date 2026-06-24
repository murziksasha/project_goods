type WeatherSceneCloudsProps = {
  count: number;
  variant?: 'default' | 'dark' | 'faint';
};

const cloudClasses = ['weather-scene-cloud-a', 'weather-scene-cloud-b', 'weather-scene-cloud-c'];

export const WeatherSceneClouds = ({
  count,
  variant = 'default',
}: WeatherSceneCloudsProps) => (
  <>
    {cloudClasses.slice(0, count).map((cloudClass) => (
      <div
        key={cloudClass}
        className={[
          'weather-scene-cloud',
          cloudClass,
          variant === 'dark' ? 'weather-scene-cloud-dark' : '',
          variant === 'faint' ? 'weather-scene-cloud-faint' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    ))}
  </>
);