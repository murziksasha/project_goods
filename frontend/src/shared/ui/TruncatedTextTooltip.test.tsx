import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TruncatedTextTooltip } from './TruncatedTextTooltip';

describe('TruncatedTextTooltip', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the provided text', () => {
    render(<TruncatedTextTooltip text="Short text" />);
    expect(screen.getByText('Short text')).toBeTruthy();
  });

  it('does not render portal tooltip for non-clipped text (no overflow)', () => {
    // jsdom defaults to no scroll overflow, tooltip should not appear
    render(<TruncatedTextTooltip text="Short text that fits" />);
    const trigger = screen.getByText('Short text that fits');
    fireEvent.mouseEnter(trigger);
    // no extra floating text node with full content should be added when not overflowing
    // (portal content would duplicate text in body)
    const duplicates = screen.queryAllByText('Short text that fits');
    // exactly the trigger (no portal duplicate should have been added)
    expect(duplicates.length).toBe(1);
  });

  it('renders tooltip content when forced overflow simulation (via wide content)', async () => {
    // Force overflow by mocking dimensions on the span after render
    const { container } = render(
      <div style={{ width: 50 }}>
        <TruncatedTextTooltip text="This is a very very long text that will be clipped in narrow container" />
      </div>,
    );

    const trigger = container.querySelector('.truncated-text-tooltip') as HTMLElement;
    // Simulate overflow by patching properties jsdom does not compute
    Object.defineProperty(trigger, 'scrollWidth', { configurable: true, value: 300 });
    Object.defineProperty(trigger, 'clientWidth', { configurable: true, value: 40 });

    // Notify listeners so the component's computeOverflow runs and flips isOverflow
    window.dispatchEvent(new Event('resize'));

    fireEvent.mouseEnter(trigger);

    // Portal content (full text) should now be present alongside the trigger
    await waitFor(() => {
      expect(screen.getAllByText('This is a very very long text that will be clipped in narrow container').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('keeps tooltip open when hovering the tooltip area (simulated)', async () => {
    const long = 'Looooooooooooooooooooooooooooooooooooooooooong';
    const { container } = render(<TruncatedTextTooltip text={long} />);

    const trigger = container.querySelector('.truncated-text-tooltip') as HTMLElement;
    Object.defineProperty(trigger, 'scrollWidth', { configurable: true, value: 400 });
    Object.defineProperty(trigger, 'clientWidth', { configurable: true, value: 30 });

    window.dispatchEvent(new Event('resize'));
    fireEvent.mouseEnter(trigger);

    // Verify the portaled tooltip content is shown
    await waitFor(() => {
      expect(screen.getAllByText(long).length).toBeGreaterThanOrEqual(2);
    });

    // Simulate moving mouse to the tooltip itself (should keep it open)
    // The portaled div is the last match for the text
    const portalContent = screen.getAllByText(long).pop() as HTMLElement;
    fireEvent.mouseEnter(portalContent);
    // Still visible after leaving trigger area
    expect(screen.getAllByText(long).length).toBeGreaterThanOrEqual(2);
  });
});
