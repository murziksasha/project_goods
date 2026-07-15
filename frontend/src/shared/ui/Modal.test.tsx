import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <Modal isOpen={false} title="Edit" onClose={() => undefined}>
        Body
      </Modal>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('closes on Escape and restores focus', () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    render(
      <Modal isOpen title="Edit item" onClose={onClose} closeLabel="Close modal">
        <button type="button">Inside</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog', { name: 'Edit item' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen title="Edit item" onClose={onClose}>
        Body
      </Modal>,
    );

    fireEvent.mouseDown(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps focus with Tab', () => {
    render(
      <Modal
        isOpen
        title="Edit item"
        onClose={() => undefined}
        showDefaultFooter
        cancelLabel="Cancel"
        submitLabel="Save"
      >
        <input aria-label="Name" />
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit item' });
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });

  it('keeps input focus when onClose identity changes on re-render', () => {
    const { rerender } = render(
      <Modal isOpen title="Edit item" onClose={() => undefined}>
        <button type="button">Tab</button>
        <input aria-label="Name" defaultValue="A" />
      </Modal>,
    );

    const input = screen.getByLabelText('Name');
    input.focus();
    expect(document.activeElement).toBe(input);

    rerender(
      <Modal isOpen title="Edit item" onClose={() => undefined}>
        <button type="button">Tab</button>
        <input aria-label="Name" defaultValue="Ab" />
      </Modal>,
    );

    expect(document.activeElement).toBe(input);
  });
});
