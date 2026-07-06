import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModalBackgroundScrollLock } from './useModalBackgroundScrollLock';

describe('useModalBackgroundScrollLock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.innerHTML = '';
  });

  it('locks body and document overflow while active', () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    const { unmount } = renderHook(() =>
      useModalBackgroundScrollLock(true, {
        allowedSelectors: ['.test-modal'],
      }),
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('auto');
  });

  it('locks orders-table-wrap overflow while active', () => {
    document.body.innerHTML =
      '<div class="orders-table-wrap" style="overflow:auto"></div>';
    const tableWrap = document.querySelector<HTMLElement>('.orders-table-wrap');
    expect(tableWrap).not.toBeNull();

    const { unmount } = renderHook(() =>
      useModalBackgroundScrollLock(true, {
        allowedSelectors: ['.test-modal'],
      }),
    );

    expect(tableWrap?.style.overflow).toBe('hidden');

    unmount();
    expect(tableWrap?.style.overflow).toBe('auto');
  });

  it('prevents wheel outside allowed regions', () => {
    document.body.innerHTML =
      '<div class="test-modal"><div class="modal-content"></div></div><div class="page-background"></div>';

    renderHook(() =>
      useModalBackgroundScrollLock(true, {
        allowedSelectors: ['.test-modal'],
      }),
    );

    const background = document.querySelector('.page-background');
    const modalContent = document.querySelector('.modal-content');
    expect(background).not.toBeNull();
    expect(modalContent).not.toBeNull();

    const backgroundWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
    });
    const backgroundPrevented = !background?.dispatchEvent(backgroundWheel);
    expect(backgroundPrevented).toBe(true);

    const modalWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
    });
    const modalPrevented = !modalContent?.dispatchEvent(modalWheel);
    expect(modalPrevented).toBe(false);
  });
});