import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SavedFiltersPanel, type SavedFilterViewItem } from './SavedFiltersPanel';

const mockItems: SavedFilterViewItem[] = [
  { id: 'filter-1', name: 'Urgent', icon: '⚡' },
  { id: 'filter-2', name: 'Completed', icon: '✅' },
];

describe('SavedFiltersPanel', () => {
  it('opens drawer and portals backdrop to document.body', () => {
    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName='New Filter'
        onApply={vi.fn()}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );

    const openButton = screen.getByRole('button', { name: 'Save filter' });
    fireEvent.click(openButton);

    const backdrop = document.body.querySelector('.orders-filter-drawer-backdrop');
    expect(backdrop).toBeInTheDocument();
  });

  it('stays open when onSave returns false', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName='My preset'
        onApply={vi.fn()}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));

    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    const modalSaveBtn = saveButtons[saveButtons.length - 1];
    fireEvent.click(modalSaveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).toBeInTheDocument();
  });

  it('closes when onSave returns true', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName='My preset'
        onApply={vi.fn()}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));

    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    const modalSaveBtn = saveButtons[saveButtons.length - 1];
    fireEvent.click(modalSaveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(document.body.querySelector('.orders-filter-drawer-backdrop')).not.toBeInTheDocument();
    });
  });

  it('disables save button while pending request runs', async () => {
    let resolveSave!: (val: boolean) => void;
    const savePromise = new Promise<boolean>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(savePromise);

    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName='My preset'
        onApply={vi.fn()}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));

    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    const modalSaveBtn = saveButtons[saveButtons.length - 1];
    fireEvent.click(modalSaveBtn);

    expect(modalSaveBtn).toBeDisabled();

    resolveSave(true);
    await waitFor(() => {
      expect(document.body.querySelector('.orders-filter-drawer-backdrop')).not.toBeInTheDocument();
    });
  });

  it('closes sheet and calls onApply when a preset in the sheet is clicked', () => {
    const onApply = vi.fn();
    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName=''
        onApply={onApply}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).toBeInTheDocument();

    const drawerList = document.body.querySelector('.orders-filter-drawer-list')!;
    const urgentPresetBtn = drawerList.querySelector('button')!;
    fireEvent.click(urgentPresetBtn);

    expect(onApply).toHaveBeenCalledWith('filter-1');
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).not.toBeInTheDocument();
  });

  it('closes on Escape and stops propagation', () => {
    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName=''
        onApply={vi.fn()}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).toBeInTheDocument();

    const outerEscapeHandler = vi.fn();
    window.addEventListener('keydown', outerEscapeHandler);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).not.toBeInTheDocument();
    // Because stopPropagation was called in capture phase, the window bubbling listener should not receive it
    expect(outerEscapeHandler).not.toHaveBeenCalled();

    window.removeEventListener('keydown', outerEscapeHandler);
  });

  it('does not close reopened drawer or clear name if drawer was closed and opened while save was in flight', async () => {
    let resolveSave!: (val: boolean) => void;
    const savePromise = new Promise<boolean>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(savePromise);
    const onNameChange = vi.fn();

    render(
      <SavedFiltersPanel
        canSave={true}
        items={mockItems}
        newFilterIcon='⭐'
        newFilterName='Initial preset'
        onApply={vi.fn()}
        onDelete={vi.fn()}
        onIconChange={vi.fn()}
        onNameChange={onNameChange}
        onSave={onSave}
      />,
    );

    // 1. Open drawer
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).toBeInTheDocument();

    // 2. Click Save inside drawer (request in-flight)
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    fireEvent.click(saveButtons[saveButtons.length - 1]);
    expect(onSave).toHaveBeenCalledTimes(1);

    // 3. Close drawer via close 'x' button
    const closeBtn = screen.getByRole('button', { name: 'Close save filter panel' });
    fireEvent.click(closeBtn);
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).not.toBeInTheDocument();

    // 4. Reopen drawer
    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).toBeInTheDocument();

    // 5. Save resolves true
    resolveSave(true);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    // 6. Drawer must still be in the document and onNameChange('') must NOT have been called
    expect(document.body.querySelector('.orders-filter-drawer-backdrop')).toBeInTheDocument();
    expect(onNameChange).not.toHaveBeenCalledWith('');
  });
});
