type WeatherSceneFogProps = {
  intensity?: string;
};

export const WeatherSceneFog = ({ intensity }: WeatherSceneFogProps) => (
  <div
    className={[
      'weather-scene-fog',
      intensity === 'moderate' || intensity === 'heavy'
        ? 'weather-scene-fog-dense'
        : '',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <span className="weather-scene-fog-layer weather-scene-fog-layer-a" />
    <span className="weather-scene-fog-layer weather-scene-fog-layer-b" />
    <span className="weather-scene-fog-layer weather-scene-fog-layer-c" />
  </div>
);