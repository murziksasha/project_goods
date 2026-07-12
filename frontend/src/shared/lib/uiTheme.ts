export type UiTheme = 'light' | 'dark';

export const uiThemeStorageKey = 'project-goods.ui-theme';

export const readUiTheme = (): UiTheme => {
  try {
    const raw = window.localStorage.getItem(uiThemeStorageKey);
    return raw === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const applyUiTheme = (theme: UiTheme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
};

export const writeUiTheme = (theme: UiTheme) => {
  try {
    window.localStorage.setItem(uiThemeStorageKey, theme);
  } catch {
    // ignore quota / private mode
  }
  applyUiTheme(theme);
};

export const toggleUiTheme = (): UiTheme => {
  const next: UiTheme = readUiTheme() === 'dark' ? 'light' : 'dark';
  writeUiTheme(next);
  return next;
};
