const formatBuildTime = (isoTime: string, locale: string) => {
  const parsed = new Date(isoTime);
  if (Number.isNaN(parsed.getTime())) {
    return isoTime;
  }

  return parsed.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const readInjectedBuildSha = () =>
  typeof __APP_BUILD_SHA__ === 'string' ? __APP_BUILD_SHA__ : 'dev';

const readInjectedBuildTime = () =>
  typeof __APP_BUILD_TIME__ === 'string'
    ? __APP_BUILD_TIME__
    : '1970-01-01T00:00:00.000Z';

export const getBuildSha = () =>
  import.meta.env.DEV ? 'dev' : readInjectedBuildSha();

export const getBuildLabel = (locale = 'uk-UA') => {
  const sha = getBuildSha();
  const time = formatBuildTime(readInjectedBuildTime(), locale);
  return `${sha} · ${time}`;
};