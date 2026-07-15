import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyUiTheme,
  readUiTheme,
  toggleUiTheme,
  uiThemeStorageKey,
  writeUiTheme,
} from './uiTheme';

describe('uiTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('defaults to light when storage is empty', () => {
    expect(readUiTheme()).toBe('light');
  });

  it('persists and applies dark theme', () => {
    writeUiTheme('dark');
    expect(window.localStorage.getItem(uiThemeStorageKey)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(readUiTheme()).toBe('dark');
  });

  it('toggles between light and dark', () => {
    writeUiTheme('light');
    expect(toggleUiTheme()).toBe('dark');
    expect(toggleUiTheme()).toBe('light');
  });

  it('applyUiTheme sets dataset without requiring storage write', () => {
    applyUiTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
