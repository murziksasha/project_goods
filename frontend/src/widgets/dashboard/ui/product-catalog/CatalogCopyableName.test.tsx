import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clipboard from '../../../../shared/lib/clipboard';
import { CatalogCopyableName } from './CatalogCopyableName';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CatalogCopyableName', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens on name click and does not copy', () => {
    const onOpen = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    render(<CatalogCopyableName name="БЖ Lenovo 20V" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'БЖ Lenovo 20V' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(copySpy).not.toHaveBeenCalled();
  });

  it('copies name without opening', async () => {
    const onOpen = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(<CatalogCopyableName name="БЖ Asus 19V" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: /Copy name|catalog\.tables\.copyName/ }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Copied|catalog\.tables\.copied/ }),
      ).toBeInTheDocument();
    });
    expect(copySpy).toHaveBeenCalledWith('БЖ Asus 19V');
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('hides copy control when name is empty', () => {
    render(<CatalogCopyableName name="   " onOpen={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: /Copy name|catalog\.tables\.copyName/ }),
    ).toBeNull();
  });
});
