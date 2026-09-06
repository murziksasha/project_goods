import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDismissibleSuggestions } from './useDismissibleSuggestions';

const Harness = ({
  query,
  isActive,
  splitPanel = false,
}: {
  query: string;
  isActive: boolean;
  splitPanel?: boolean;
}) => {
  const { rootRef, panelRef, isVisible } = useDismissibleSuggestions({
    query,
    isActive,
  });

  const panel = isVisible ? (
    <div data-testid="panel" ref={splitPanel ? panelRef : undefined}>
      <button type="button">Suggestion</button>
    </div>
  ) : null;

  return (
    <div>
      <div data-testid="outside">outside</div>
      <div data-testid="root" ref={rootRef}>
        <input data-testid="input" value={query} readOnly />
        {splitPanel ? null : panel}
      </div>
      {splitPanel ? panel : null}
    </div>
  );
};

const EditableHarness = ({
  initialQuery,
  isActive,
}: {
  initialQuery: string;
  isActive: boolean;
}) => {
  const [query, setQuery] = useState(initialQuery);
  const { rootRef, isVisible } = useDismissibleSuggestions({
    query,
    isActive,
  });

  return (
    <div>
      <div data-testid="outside">outside</div>
      <div data-testid="root" ref={rootRef}>
        <input
          data-testid="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {isVisible ? <div data-testid="panel">Suggestion</div> : null}
      </div>
    </div>
  );
};

describe('useDismissibleSuggestions', () => {
  it('shows the panel while active and not dismissed', () => {
    render(<Harness query="samsung" isActive />);
    expect(screen.getByTestId('panel')).toBeInTheDocument();
  });

  it('hides on pointerdown outside without changing the input', () => {
    render(<Harness query="samsung" isActive />);
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('input')).toHaveValue('samsung');
  });

  it('keeps the panel open when clicking the input or a suggestion', () => {
    render(<Harness query="samsung" isActive />);
    fireEvent.pointerDown(screen.getByTestId('input'));
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Suggestion' }));
    expect(screen.getByTestId('panel')).toBeInTheDocument();
  });

  it('treats a split panel as inside the widget', () => {
    render(<Harness query="samsung" isActive splitPanel />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Suggestion' }));
    expect(screen.getByTestId('panel')).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
  });

  it('hides on Escape and stops the event from reaching parent listeners', () => {
    const parentListener = vi.fn();
    window.addEventListener('keydown', parentListener);
    render(<Harness query="samsung" isActive />);

    fireEvent.keyDown(screen.getByTestId('input'), { key: 'Escape' });

    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
    expect(parentListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', parentListener);
  });

  it('stays hidden on the same query and reopens after an edit', () => {
    render(<EditableHarness initialQuery="samsung" isActive />);
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId('input'));
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input'), {
      target: { value: 'samsung ' },
    });
    expect(screen.getByTestId('panel')).toBeInTheDocument();
  });

  it('does not render while inactive', () => {
    render(<Harness query="samsung" isActive={false} />);
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
  });
});
