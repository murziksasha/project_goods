import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StringListInput } from './StringListInput';

const Harness: React.FC<{ initial?: string[]; onChange?: (items: string[]) => void }> = ({
  initial = [],
  onChange,
}) => {
  const [items, setItems] = useState(initial);
  return (
    <StringListInput
      label='Kit'
      items={items}
      onChange={(next) => {
        setItems(next);
        onChange?.(next);
      }}
      addLabel='Add'
      getRemoveLabel={(item) => `Remove ${item}`}
      maxItems={3}
    />
  );
};

describe('StringListInput', () => {
  it('adds rows with + and Enter, removes rows with ×', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Kit 1'), { target: { value: 'ЗП' } });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    fireEvent.change(screen.getByLabelText('Kit 2'), { target: { value: 'сумка' } });
    fireEvent.keyDown(screen.getByLabelText('Kit 2'), { key: 'Enter' });
    expect(screen.getByLabelText('Kit 3')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Remove ЗП' }));
    expect(onChange).toHaveBeenLastCalledWith(['сумка', '']);
  });

  it('stops adding rows at maxItems', () => {
    render(<Harness initial={['a', 'b', 'c']} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
