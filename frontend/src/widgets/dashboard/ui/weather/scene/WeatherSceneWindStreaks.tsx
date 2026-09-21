import type React from 'react';
export const WeatherSceneWindStreaks: React.FC = () => (
  <div className="weather-scene-wind-streaks" aria-hidden="true">
    {Array.from({ length: 4 }, (_, index) => (
      <span
        key={index}
        className="weather-scene-wind-streak"
        style={{ top: `${18 + index * 16}%`, animationDelay: `${index * 0.35}s` }}
      />
    ))}
  </div>
);