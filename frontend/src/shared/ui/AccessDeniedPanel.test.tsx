import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessDeniedPanel } from './AccessDeniedPanel';

describe('AccessDeniedPanel', () => {
  it('shows denied page message and navigates home', () => {
    const onNavigate = vi.fn();
    render(
      <AccessDeniedPanel
        page="accounting"
        allowedPages={['home', 'orders']}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accessDenied\.goHome|Go to main|На головну/i }));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });
});
