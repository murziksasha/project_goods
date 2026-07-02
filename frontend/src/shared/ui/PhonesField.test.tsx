import { fireEvent, render, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n/config';
import { PhonesField } from './PhonesField';

function renderPhonesField(props: ComponentProps<typeof PhonesField>) {
  const view = render(<PhonesField {...props} />);
  const field = view.container.querySelector('.phones-field') as HTMLElement;
  return { ...view, field };
}

describe('PhonesField', () => {
  it('emits atomic phone updates when editing primary phone', () => {
    const onPhonesUpdate = vi.fn();

    const { field } = renderPhonesField({
      phone: '+380501111111',
      phones: ['+380501111111', '+380502222222'],
      onPhonesUpdate,
    });

    const inputs = within(field).getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: '+380509999999' } });

    expect(onPhonesUpdate).toHaveBeenCalledTimes(1);
    expect(onPhonesUpdate).toHaveBeenCalledWith({
      phone: '+380509999999',
      phones: ['+380509999999', '+380502222222'],
    });
  });

  it('promotes additional phone to primary', () => {
    const onPhonesUpdate = vi.fn();

    const { field } = renderPhonesField({
      phone: '+380501111111',
      phones: ['+380501111111', '+380502222222'],
      onPhonesUpdate,
    });

    fireEvent.click(
      within(field).getByRole('button', {
        name: i18n.t('clients.card.setPrimaryPhoneAriaLabel'),
      }),
    );

    expect(onPhonesUpdate).toHaveBeenCalledWith({
      phone: '+380502222222',
      phones: ['+380502222222', '+380501111111'],
    });
  });

  it('removes additional phone row', () => {
    const onPhonesUpdate = vi.fn();

    const { field } = renderPhonesField({
      phone: '+380501111111',
      phones: ['+380501111111', '+380502222222'],
      onPhonesUpdate,
    });

    const removeButtons = within(field).getAllByRole('button', {
      name: i18n.t('clients.card.removePhoneAriaLabel'),
    });
    fireEvent.click(removeButtons[1]);

    expect(onPhonesUpdate).toHaveBeenCalledWith({
      phone: '+380501111111',
      phones: ['+380501111111'],
    });
  });
});