import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Notifications } from './Notifications';

afterEach(() => {
  cleanup();
});

describe('Notifications', () => {
  it('renders a success toast when crypto.randomUUID is unavailable', () => {
    const randomUuidDescriptor = Object.getOwnPropertyDescriptor(
      crypto,
      'randomUUID',
    );
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });

    try {
      render(
        <Notifications
          error=""
          successMessage="Cashbox operation completed."
          isOffline={false}
        />,
      );

      expect(screen.getByText('Cashbox operation completed.')).toBeInTheDocument();
    } finally {
      if (randomUuidDescriptor) {
        Object.defineProperty(crypto, 'randomUUID', randomUuidDescriptor);
      }
    }
  });

  it('renders an error toast when crypto.randomUUID is unavailable', () => {
    const randomUuidDescriptor = Object.getOwnPropertyDescriptor(
      crypto,
      'randomUUID',
    );
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });

    try {
      render(
        <Notifications
          error="Cashbox operation failed."
          successMessage=""
          isOffline={false}
        />,
      );

      expect(screen.getByText('Cashbox operation failed.')).toBeInTheDocument();
    } finally {
      if (randomUuidDescriptor) {
        Object.defineProperty(crypto, 'randomUUID', randomUuidDescriptor);
      }
    }
  });
});
