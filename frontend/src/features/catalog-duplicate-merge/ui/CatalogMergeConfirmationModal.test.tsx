import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogMergeConfirmationModal } from './CatalogMergeConfirmationModal';

describe('CatalogMergeConfirmationModal', () => {
  it('renders target and source information and calls handlers', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <CatalogMergeConfirmationModal
        isOpen
        targetName='Existing Device'
        targetNote='Target existing note'
        sourceName='Typo Device'
        sourceNote='Source draft note'
        onClose={handleClose}
        onConfirm={handleConfirm}
      />,
    );

    expect(screen.getByText('Existing Device')).toBeInTheDocument();
    expect(
      screen.getByText('Target existing note'),
    ).toBeInTheDocument();
    expect(screen.getByText('Typo Device')).toBeInTheDocument();
    expect(screen.getByText('Source draft note')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: /confirm merge/i }),
    );
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons and shows merging label when isMerging is true', () => {
    render(
      <CatalogMergeConfirmationModal
        isOpen
        isMerging
        targetName='Existing Item'
        sourceName='Typo Item'
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', {
      name: /merging/i,
    });
    const cancelButton = screen.getByRole('button', {
      name: /cancel/i,
    });

    expect(confirmButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <CatalogMergeConfirmationModal
        isOpen
        targetName='Existing Item'
        sourceName='Typo Item'
        error='Target item not found.'
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Target item not found.'),
    ).toBeInTheDocument();
  });
});
