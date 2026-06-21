import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhonesField } from './PhonesField';

afterEach(() => {
  cleanup();
});

describe('PhonesField', () => {
  it('emits atomic phone updates when editing primary phone', () => {
    const onPhonesUpdate = vi.fn();

    render(
      <PhonesField
        phone='+380501111111'
        phones={['+380501111111', '+380502222222']}
        onPhonesUpdate={onPhonesUpdate}
      />,
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '+380509999999' } });

    expect(onPhonesUpdate).toHaveBeenCalledTimes(1);
    expect(onPhonesUpdate).toHaveBeenCalledWith({
      phone: '+380509999999',
      phones: ['+380509999999', '+380502222222'],
    });
  });

  it('promotes additional phone to primary', () => {
    const onPhonesUpdate = vi.fn();

    render(
      <PhonesField
        phone='+380501111111'
        phones={['+380501111111', '+380502222222']}
        onPhonesUpdate={onPhonesUpdate}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Set as primary phone' }),
    );

    expect(onPhonesUpdate).toHaveBeenCalledWith({
      phone: '+380502222222',
      phones: ['+380502222222', '+380501111111'],
    });
  });

  it('removes additional phone row', () => {
    const onPhonesUpdate = vi.fn();

    render(
      <PhonesField
        phone='+380501111111'
        phones={['+380501111111', '+380502222222']}
        onPhonesUpdate={onPhonesUpdate}
      />,
    );

    const phonesField = screen.getByText('Phones').parentElement as HTMLElement;
    const removeButtons = within(phonesField).getAllByRole('button', {
      name: 'Remove phone',
    });
    fireEvent.click(removeButtons[1]);

    expect(onPhonesUpdate).toHaveBeenCalledWith({
      phone: '+380501111111',
      phones: ['+380501111111'],
    });
  });
});