import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChipListInput, type ChipListInputProps } from './ChipListInput';

const renderChips = (props: Partial<ChipListInputProps> = {}) => {
  const handlers = {
    onInputChange: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
  };
  const view = render(
    <ChipListInput
      items={['ЗП', 'сумка']}
      inputValue=""
      label="Kit"
      addLabel="Add"
      getRemoveLabel={(item) => `Remove ${item}`}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, ...view };
};

describe('ChipListInput', () => {
  it('renders chips with × and an input with + without nested divs', () => {
    const { container } = renderChips();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Remove ЗП' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Kit' })).toBeInTheDocument();
    expect(container.querySelector('div')).toBeNull();
  });

  it('enables + only for non-empty text and adds on click or Enter', () => {
    const { onAdd, rerender } = renderChips();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
    rerender(
      <ChipListInput
        items={[]}
        inputValue="чохол"
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it('removes by index and forwards typing', () => {
    const { onRemove, onInputChange } = renderChips();
    fireEvent.click(screen.getByRole('button', { name: 'Remove сумка' }));
    expect(onRemove).toHaveBeenCalledWith(1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(onInputChange).toHaveBeenCalledWith('x');
  });

  it('blocks adding at the item limit', () => {
    renderChips({ inputValue: 'x', maxItems: 2 });
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('read-only mode shows chips or the empty text only', () => {
    const { rerender } = renderChips({ readOnly: true });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(
      <ChipListInput
        items={[]}
        inputValue=""
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        readOnly
        emptyText="No kit"
      />,
    );
    expect(screen.getByText('No kit')).toBeInTheDocument();
  });

  it('leaves the textbox focused after Enter and +', () => {
    const onAdd = vi.fn();
    const { rerender } = renderChips({ inputValue: 'чохол', onAdd });
    const input = screen.getByRole('textbox', { name: 'Kit' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);

    rerender(
      <ChipListInput
        items={['ЗП', 'сумка', 'чохол']}
        inputValue=""
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(input);

    rerender(
      <ChipListInput
        items={['ЗП', 'сумка', 'чохол']}
        inputValue="кабель"
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);
    expect(onAdd).toHaveBeenCalledTimes(2);

    rerender(
      <ChipListInput
        items={['ЗП', 'сумка', 'чохол', 'кабель']}
        inputValue=""
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(input);
  });

  it('does not move focus when × is clicked', () => {
    const { onRemove } = renderChips();
    const removeButton = screen.getByRole('button', { name: 'Remove сумка' });
    removeButton.focus();
    expect(document.activeElement).toBe(removeButton);

    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledWith(1);
    expect(document.activeElement).not.toBe(screen.getByRole('textbox', { name: 'Kit' }));
  });

  it('does not focus the textbox when the list reaches maxItems or later when an item is removed', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const { rerender } = render(
      <ChipListInput
        items={['item1']}
        inputValue="item2"
        maxItems={2}
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={onRemove}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Kit' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledTimes(1);

    rerender(
      <ChipListInput
        items={['item1', 'item2']}
        inputValue=""
        maxItems={2}
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={onRemove}
      />,
    );
    expect(input).toBeDisabled();
    expect(document.activeElement).not.toBe(input);

    const removeBtn = screen.getByRole('button', { name: 'Remove item2' });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith(1);

    rerender(
      <ChipListInput
        items={['item1']}
        inputValue=""
        maxItems={2}
        label="Kit"
        addLabel="Add"
        getRemoveLabel={(item) => `Remove ${item}`}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onRemove={onRemove}
      />,
    );
    expect(input).not.toBeDisabled();
    expect(document.activeElement).not.toBe(input);
  });
});
