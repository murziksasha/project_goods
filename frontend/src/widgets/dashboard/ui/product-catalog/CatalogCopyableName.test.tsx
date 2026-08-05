import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogCopyableName } from './CatalogCopyableName';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../../shared/lib/clipboard', () => ({
  copyTextToClipboard: vi.fn(),
}));

import { copyTextToClipboard } from '../../../../shared/lib/clipboard';

describe('CatalogCopyableName', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens on name click and does not copy', () => {
    const onOpen = vi.fn();
    render(<CatalogCopyableName name="БЖ Lenovo 20V" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'БЖ Lenovo 20V' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(copyTextToClipboard).not.toHaveBeenCalled();
  });

  it('copies name without opening', async () => {
    const onOpen = vi.fn();
    vi.mocked(copyTextToClipboard).mockResolvedValue(true);

    render(<CatalogCopyableName name="БЖ Asus 19V" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'catalog.tables.copyName' }));

    await waitFor(() => {
      expect(copyTextToClipboard).toHaveBeenCalledWith('БЖ Asus 19V');
    });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('hides copy control when name is empty', () => {
    render(<CatalogCopyableName name="   " onOpen={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'catalog.tables.copyName' }),
    ).toBeNull();
  });
});
