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

export const getBuildLabel = (locale = 'uk-UA') => {
  const sha = import.meta.env.DEV ? 'dev' : __APP_BUILD_SHA__;
  const time = formatBuildTime(__APP_BUILD_TIME__, locale);
  return `${sha} · ${time}`;
};