import type React from 'react';
export interface WeatherSceneRainProps {
  dropCount: number;
};

export const WeatherSceneRain: React.FC<WeatherSceneRainProps> = ({ dropCount }) => (
  <div className="weather-scene-rain">
    {Array.from({ length: dropCount }, (_, index) => (
      <span
        key={index}
        className="weather-scene-rain-drop"
        style={{
          left: `${4 + index * (90 / Math.max(dropCount - 1, 1))}%`,
          animationDelay: `${index * 0.1}s`,
        }}
      />
    ))}
  </div>
);