import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BeforeInstallPromptEvent,
  usePwaInstallPrompt,
} from './usePwaInstallPrompt';

const createMatchMediaMock = (matches = false) => {
  const mediaQueryList = {
    matches,
    media: '(display-mode: standalone)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  return vi.fn().mockReturnValue(mediaQueryList);
};

const InstallButton = () => {
  const { canInstall, installApp } = usePwaInstallPrompt();

  return canInstall ? (
    <button type="button" onClick={() => void installApp()}>
      Install app
    </button>
  ) : null;
};

const dispatchBeforeInstallPrompt = (
  prompt = vi.fn().mockResolvedValue(undefined),
  userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
) => {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  event.prompt = prompt;
  event.userChoice = userChoice;
  event.preventDefault = vi.fn();

  window.dispatchEvent(event);

  return { event, prompt, userChoice };
};

describe('usePwaInstallPrompt', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: createMatchMediaMock(false),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides the install button before beforeinstallprompt', () => {
    render(<InstallButton />);

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });

  it('prevents the browser mini-infobar after beforeinstallprompt', async () => {
    render(<InstallButton />);
    const { event } = dispatchBeforeInstallPrompt();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Install app' })).toBeInTheDocument();
  });

  it('prompts once and hides after the prompt is consumed', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });

    render(<InstallButton />);
    dispatchBeforeInstallPrompt(prompt, userChoice);

    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
    });
    await expect(userChoice).resolves.toEqual({ outcome: 'accepted', platform: 'web' });
  });

  it('hides after the app is installed', async () => {
    render(<InstallButton />);
    dispatchBeforeInstallPrompt();

    expect(await screen.findByRole('button', { name: 'Install app' })).toBeInTheDocument();

    window.dispatchEvent(new Event('appinstalled'));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
    });
  });

  it('stays hidden when already running standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: createMatchMediaMock(true),
    });

    render(<InstallButton />);
    dispatchBeforeInstallPrompt();

    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });
});
