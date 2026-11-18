import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../../../../../shared/i18n/config';
import { OrderDetailKitField } from './OrderDetailKitField';

const renderField = (props: Partial<React.ComponentProps<typeof OrderDetailKitField>> = {}) => {
  const onSaveKit = props.onSaveKit ?? vi.fn(async () => undefined);
  render(
    <dl>
      <OrderDetailKitField saleId='sale-1' kit={['ЗП']} canEdit onSaveKit={onSaveKit} {...props} />
    </dl>,
  );
  return { onSaveKit };
};

describe('OrderDetailKitField', () => {
  it('shows the comma-joined kit and saves a normalized edited list', async () => {
    const { onSaveKit } = renderField();
    expect(screen.getByText('ЗП')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('orders.detail.editKit') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orders.create.addKitItem') }));
    const label = i18n.t('orders.detail.kit');
    fireEvent.change(screen.getByLabelText(`${label} 2`), { target: { value: '  сумка ' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(onSaveKit).toHaveBeenCalledWith(['ЗП', 'сумка']));
  });

  it('does not call save when nothing changed', async () => {
    const { onSaveKit } = renderField();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orders.detail.editKit') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.save') }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: i18n.t('common.save') })).not.toBeInTheDocument(),
    );
    expect(onSaveKit).not.toHaveBeenCalled();
  });

  it('hides the edit button when the card is locked and shows the empty state', () => {
    renderField({ kit: [], canEdit: false });
    expect(screen.queryByRole('button', { name: i18n.t('orders.detail.editKit') })).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('orders.detail.kitEmpty'))).toBeInTheDocument();
  });

  it('keeps the editor open when saving fails', async () => {
    const onSaveKit = vi.fn(async () => {
      throw new Error('boom');
    });
    renderField({ onSaveKit, kit: [] });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('orders.detail.editKit') }));
    fireEvent.change(screen.getByLabelText(`${i18n.t('orders.detail.kit')} 1`), { target: { value: 'ЗП' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.save') }));
    await waitFor(() => expect(onSaveKit).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: i18n.t('common.save') })).toBeInTheDocument();
  });
});
