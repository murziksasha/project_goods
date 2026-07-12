export type UiDensity = 'comfortable' | 'compact';

export const uiDensityStorageKey = 'project-goods.ui-density';

export const readUiDensity = (): UiDensity => {
  try {
    const raw = window.localStorage.getItem(uiDensityStorageKey);
    return raw === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
};

export const writeUiDensity = (density: UiDensity) => {
  try {
    window.localStorage.setItem(uiDensityStorageKey, density);
  } catch {
    // ignore
  }
  applyUiDensity(density);
};

export const applyUiDensity = (density: UiDensity) => {
  document.documentElement.dataset.uiDensity = density;
};
