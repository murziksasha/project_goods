type WeatherSunGraphicProps = {
  variant?: 'full' | 'small';
  showRays?: boolean;
  rayOpacity?: number;
  className?: string;
};

const SUN_CENTER = 32;

export const WeatherSunGraphic = ({
  variant = 'full',
  showRays = true,
  rayOpacity = 1,
  className = '',
}: WeatherSunGraphicProps) => {
  const isSmall = variant === 'small';
  const sunRadius = isSmall ? 10 : 14;
  const rayInner = isSmall ? 14 : 18;
  const rayOuter = isSmall ? 19 : 24;
  const strokeWidth = isSmall ? 2.25 : 3;

  return (
    <svg
      viewBox="0 0 64 64"
      className={['weather-scene-sun-graphic', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {showRays ? (
        <g className="weather-scene-sun-rays-svg" style={{ opacity: rayOpacity }}>
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index * Math.PI) / 4;
            const x1 = SUN_CENTER + Math.cos(angle) * rayInner;
            const y1 = SUN_CENTER + Math.sin(angle) * rayInner;
            const x2 = SUN_CENTER + Math.cos(angle) * rayOuter;
            const y2 = SUN_CENTER + Math.sin(angle) * rayOuter;
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#f59e0b"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : null}
      <circle
        cx={SUN_CENTER}
        cy={SUN_CENTER}
        r={sunRadius}
        className="weather-scene-sun-disc"
        fill="#f59e0b"
      />
    </svg>
  );
};