import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../../../../shared/i18n/config';
import { OrderDetailKitField } from './OrderDetailKitField';

const renderField = (props: Partial<React.ComponentProps<typeof OrderDetailKitField>> = {}) => {
  const onChangeKit = props.onChangeKit ?? vi.fn(async () => undefined);
  const view = render(
    <dl className="order-detail-list">
      <OrderDetailKitField saleId="sale-1" kit={['ЗП']} canEdit onChangeKit={onChangeKit} {...props} />
    </dl>,
  );
  return { onChangeKit, ...view };
};

const getInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Kit' });

describe('OrderDetailKitField', () => {
  it('shows chips with × and an add input without any edit mode or nested divs', async () => {
    await i18n.changeLanguage('en');
    const { container } = renderField({ kit: ['ЗП', 'сумка'] });
    expect(screen.getByText('ЗП')).toBeInTheDocument();
    expect(screen.getByText('сумка')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove ЗП' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add kit item' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /save|cancel|edit/i })).not.toBeInTheDocument();
    expect(container.querySelector('dd div')).toBeNull();
  });

  it('adds an item with "+" and saves immediately with an add change', async () => {
    const { onChangeKit } = renderField();
    fireEvent.change(getInput(), { target: { value: ' сумка ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add kit item' }));
    await waitFor(() =>
      expect(onChangeKit).toHaveBeenCalledWith(['ЗП', 'сумка'], { type: 'add', items: ['сумка'] }),
    );
    expect(screen.getByText('сумка')).toBeInTheDocument();
    expect(getInput()).toHaveValue('');
  });

  it('adds on Enter, splits commas and ignores duplicates', async () => {
    const { onChangeKit } = renderField();
    fireEvent.change(getInput(), { target: { value: 'зп, чохол, ,Чохол' } });
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    await waitFor(() =>
      expect(onChangeKit).toHaveBeenCalledWith(['ЗП', 'чохол'], { type: 'add', items: ['чохол'] }),
    );
  });

  it('does not save when only duplicates or blanks were typed', () => {
    const { onChangeKit } = renderField();
    fireEvent.change(getInput(), { target: { value: 'зп' } });
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onChangeKit).not.toHaveBeenCalled();
    expect(getInput()).toHaveValue('');
    expect(document.activeElement).toBe(getInput());
  });

  it('removes an item with × and saves immediately with a remove change', async () => {
    const { onChangeKit } = renderField({ kit: ['ЗП', 'сумка'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove ЗП' }));
    await waitFor(() =>
      expect(onChangeKit).toHaveBeenCalledWith(['сумка'], { type: 'remove', items: ['ЗП'] }),
    );
    expect(screen.queryByText('ЗП')).not.toBeInTheDocument();
  });

  it('focuses the empty textbox after the save promise resolves', async () => {
    let resolveSave: () => void = () => undefined;
    const onChangeKit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    renderField({ onChangeKit });
    fireEvent.change(getInput(), { target: { value: 'сумка' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add kit item' }));
    expect(getInput()).toBeDisabled();

    await act(async () => {
      resolveSave();
    });

    expect(getInput()).not.toBeDisabled();
    expect(getInput()).toHaveValue('');
    expect(document.activeElement).toBe(getInput());
  });

  it('reverts the optimistic change, restores typed text and focuses with caret at end when saving fails', async () => {
    let reject: (error: Error) => void = () => undefined;
    const onChangeKit = vi.fn(
      () => new Promise<void>((_, rejectPromise) => {
        reject = rejectPromise;
      }),
    );
    renderField({ onChangeKit });
    fireEvent.change(getInput(), { target: { value: 'сумка' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add kit item' }));
    expect(screen.getByText('сумка')).toBeInTheDocument();
    expect(getInput()).toBeDisabled();
    await act(async () => {
      reject(new Error('boom'));
    });
    expect(screen.queryByText('сумка')).not.toBeInTheDocument();
    expect(getInput()).toHaveValue('сумка');
    expect(getInput()).not.toBeDisabled();
    expect(document.activeElement).toBe(getInput());
    expect(getInput().selectionStart).toBe(5);
    expect(getInput().selectionEnd).toBe(5);
  });

  it('stays unfocused when another control takes focus while saving', async () => {
    let resolveSave: () => void = () => undefined;
    const onChangeKit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <div>
        <input data-testid="other-field" />
        <dl className="order-detail-list">
          <OrderDetailKitField saleId="sale-1" kit={['ЗП']} canEdit onChangeKit={onChangeKit} />
        </dl>
      </div>,
    );
    fireEvent.change(getInput(), { target: { value: 'сумка' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add kit item' }));
    expect(getInput()).toBeDisabled();

    const otherField = screen.getByTestId('other-field');
    otherField.focus();
    expect(document.activeElement).toBe(otherField);

    await act(async () => {
      resolveSave();
    });

    expect(getInput()).not.toBeDisabled();
    expect(document.activeElement).toBe(otherField);
    expect(document.activeElement).not.toBe(getInput());
  });

  it('is read-only without × and input when the card is locked', () => {
    renderField({ canEdit: false, kit: [] });
    expect(screen.getByText('No kit')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
  });

  it('shows legacy comma items as separate chips', () => {
    renderField({ kit: ['ЗП', 'сумка'], canEdit: false });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
