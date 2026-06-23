type WeatherAnimatedSceneProps = {
  condition: string;
  compact?: boolean;
  animated?: boolean;
};

export const WeatherAnimatedScene = ({
  condition,
  compact = false,
  animated = true,
}: WeatherAnimatedSceneProps) => {
  return (
    <div
      className={[
        'weather-scene',
        `weather-scene-${condition}`,
        compact ? 'weather-scene-compact' : 'weather-scene-hero',
        animated ? 'weather-scene--animated' : 'weather-scene--static',
      ].join(' ')}
      aria-hidden="true"
    >
      <div className="weather-scene-sky" />

      {condition === 'clear' ? (
        <>
          <div className="weather-scene-sun-glow" />
          <div className="weather-scene-sun" />
          <div className="weather-scene-sun-rays" />
        </>
      ) : null}

      {condition === 'partly-cloudy' ? (
        <>
          <div className="weather-scene-sun weather-scene-sun-small" />
          <div className="weather-scene-cloud weather-scene-cloud-a" />
          <div className="weather-scene-cloud weather-scene-cloud-b" />
        </>
      ) : null}

      {condition === 'cloudy' || condition === 'fog' ? (
        <>
          <div className="weather-scene-cloud weather-scene-cloud-a" />
          <div className="weather-scene-cloud weather-scene-cloud-b" />
          <div className="weather-scene-cloud weather-scene-cloud-c" />
        </>
      ) : null}

      {condition === 'rain' || condition === 'thunder' ? (
        <>
          <div className="weather-scene-cloud weather-scene-cloud-dark weather-scene-cloud-a" />
          <div className="weather-scene-cloud weather-scene-cloud-dark weather-scene-cloud-b" />
          <div className="weather-scene-rain">
            {Array.from({ length: compact ? 8 : 14 }, (_, index) => (
              <span
                key={index}
                className="weather-scene-rain-drop"
                style={{ left: `${8 + index * 6}%`, animationDelay: `${index * 0.12}s` }}
              />
            ))}
          </div>
        </>
      ) : null}

      {condition === 'thunder' ? <div className="weather-scene-lightning" /> : null}

      {condition === 'snow' ? (
        <>
          <div className="weather-scene-cloud weather-scene-cloud-a" />
          <div className="weather-scene-snow">
            {Array.from({ length: compact ? 10 : 16 }, (_, index) => (
              <span
                key={index}
                className="weather-scene-snowflake"
                style={{
                  left: `${6 + index * 5.5}%`,
                  animationDelay: `${index * 0.18}s`,
                  animationDuration: `${2.2 + (index % 3) * 0.4}s`,
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      {condition === 'fog' ? (
        <div className="weather-scene-fog">
          <span className="weather-scene-fog-layer weather-scene-fog-layer-a" />
          <span className="weather-scene-fog-layer weather-scene-fog-layer-b" />
          <span className="weather-scene-fog-layer weather-scene-fog-layer-c" />
        </div>
      ) : null}
    </div>
  );
};