import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clipboard from '../lib/clipboard';
import { CopyableValue } from './CopyableValue';

describe('CopyableValue', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('copies from the icon and does not fire the child click', async () => {
    const onOpen = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <CopyableValue value="+380501111111">
        <button type="button" onClick={onOpen}>
          050 111 11 11
        </button>
      </CopyableValue>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
    expect(copySpy).toHaveBeenCalledWith('+380501111111');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the child click flow and does not copy', () => {
    const onOpen = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <CopyableValue value="R000001">
        <button type="button" onClick={onOpen}>
          R000001
        </button>
      </CopyableValue>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'R000001' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(copySpy).not.toHaveBeenCalled();
  });

  it('hides the copy control when the value is empty', () => {
    render(
      <CopyableValue value="   ">
        <span>-</span>
      </CopyableValue>,
    );

    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('stops row click when the copy icon is pressed', async () => {
    const onRowClick = vi.fn();
    vi.spyOn(clipboard, 'copyTextToClipboard').mockResolvedValue(true);

    render(
      <div onClick={onRowClick}>
        <CopyableValue value="Ivan Petrenko">Ivan Petrenko</CopyableValue>
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
