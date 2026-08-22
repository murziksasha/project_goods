import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnboundSerialIssueModal } from './UnboundSerialIssueModal';

describe('UnboundSerialIssueModal', () => {
  it('lists unbound product names and continues', () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();

    render(
      <UnboundSerialIssueModal
        productNames={['Splash cover', 'Battery pack']}
        onCancel={onCancel}
        onContinue={onContinue}
      />,
    );

    expect(
      screen.getByRole('alertdialog', {
        name: 'Serial numbers are not bound',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Splash cover')).toBeInTheDocument();
    expect(screen.getByText('Battery pack')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels from the footer and Escape without continuing', () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();

    render(
      <UnboundSerialIssueModal
        productNames={['Splash cover']}
        onCancel={onCancel}
        onContinue={onContinue}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
