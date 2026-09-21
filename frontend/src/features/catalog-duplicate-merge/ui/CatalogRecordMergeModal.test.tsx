import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogRecordMergeModal } from './CatalogRecordMergeModal';

interface MockItem {
  id: string;
  name: string;
  phone?: string;
  note?: string;
}

const mockRecords: MockItem[] = [
  {
    id: '1',
    name: 'iPhone 13',
    phone: '+380501111111',
    note: 'First note',
  },
  {
    id: '2',
    name: 'iPhone 13 Pro',
    phone: '+380502222222',
    note: 'Second note',
  },
  {
    id: '3',
    name: 'Samsung Galaxy',
    phone: '+380503333333',
    note: 'Third note',
  },
];

describe('CatalogRecordMergeModal', () => {
  it('renders modal with target and source fields and swap button', () => {
    render(
      <CatalogRecordMergeModal
        isOpen
        title='Merge devices'
        records={mockRecords}
        onClose={vi.fn()}
        onMerge={vi.fn()}
        getRecordId={(item) => item.id}
        getRecordName={(item) => item.name}
        getRecordSecondaryText={(item) => item.phone}
        getRecordNote={(item) => item.note}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Merge devices')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Target \(Surviving\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Source \(To delete\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /swap/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Merge$/i }),
    ).toBeDisabled();
  });

  it('allows selecting target and source and shows preview cards', async () => {
    render(
      <CatalogRecordMergeModal
        isOpen
        title='Merge devices'
        records={mockRecords}
        onClose={vi.fn()}
        onMerge={vi.fn()}
        getRecordId={(item) => item.id}
        getRecordName={(item) => item.name}
        getRecordSecondaryText={(item) => item.phone}
        getRecordNote={(item) => item.note}
      />,
    );

    const targetInput = screen.getByLabelText(
      /Target \(Surviving\)/i,
    );
    fireEvent.change(targetInput, { target: { value: 'iPhone 13' } });

    const targetOption = screen.getAllByRole('button', {
      name: /^iPhone 13\+/i,
    })[0];
    fireEvent.click(targetOption);
    expect(targetInput).toHaveValue('iPhone 13');

    const sourceInput = screen.getByLabelText(
      /Source \(To delete\)/i,
    );
    fireEvent.change(sourceInput, {
      target: { value: 'iPhone 13 Pro' },
    });

    const sourceOption = screen.getByRole('button', {
      name: /^iPhone 13 Pro\+/i,
    });
    fireEvent.click(sourceOption);
    expect(sourceInput).toHaveValue('iPhone 13 Pro');

    // Both selected -> preview cards appear and merge button is enabled
    expect(screen.getByText('First note')).toBeInTheDocument();
    expect(screen.getByText('Second note')).toBeInTheDocument();

    const mergeBtn = screen.getByRole('button', { name: /^Merge$/i });
    expect(mergeBtn).not.toBeDisabled();
  });

  it('swaps target and source when swap button is clicked', () => {
    render(
      <CatalogRecordMergeModal
        isOpen
        title='Merge devices'
        records={mockRecords}
        onClose={vi.fn()}
        onMerge={vi.fn()}
        getRecordId={(item) => item.id}
        getRecordName={(item) => item.name}
        getRecordSecondaryText={(item) => item.phone}
        getRecordNote={(item) => item.note}
      />,
    );

    const targetInput = screen.getByLabelText(
      /Target \(Surviving\)/i,
    );
    fireEvent.change(targetInput, { target: { value: 'iPhone 13' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: /^iPhone 13\+/i })[0],
    );

    const sourceInput = screen.getByLabelText(
      /Source \(To delete\)/i,
    );
    fireEvent.change(sourceInput, { target: { value: 'Samsung' } });
    fireEvent.click(
      screen.getByRole('button', { name: /^Samsung Galaxy\+/i }),
    );

    expect(targetInput).toHaveValue('iPhone 13');
    expect(sourceInput).toHaveValue('Samsung Galaxy');

    const swapBtn = screen.getByRole('button', { name: /swap/i });
    fireEvent.click(swapBtn);

    expect(targetInput).toHaveValue('Samsung Galaxy');
    expect(sourceInput).toHaveValue('iPhone 13');
  });

  it('disables merge button and shows warning if same record is selected for both', () => {
    render(
      <CatalogRecordMergeModal
        isOpen
        title='Merge devices'
        records={mockRecords}
        onClose={vi.fn()}
        onMerge={vi.fn()}
        getRecordId={(item) => item.id}
        getRecordName={(item) => item.name}
        getRecordSecondaryText={(item) => item.phone}
        getRecordNote={(item) => item.note}
      />,
    );

    const targetInput = screen.getByLabelText(
      /Target \(Surviving\)/i,
    );
    fireEvent.change(targetInput, { target: { value: 'iPhone 13' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: /^iPhone 13\+/i })[0],
    );

    const sourceInput = screen.getByLabelText(
      /Source \(To delete\)/i,
    );
    fireEvent.change(sourceInput, { target: { value: 'iPhone 13' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: /^iPhone 13\+/i })[0],
    );

    expect(
      screen.getByText(
        /Target and source records must be different/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Merge$/i }),
    ).toBeDisabled();
  });

  it('calls onMerge and onClose when confirmed', async () => {
    const handleMerge = vi.fn().mockResolvedValue(true);
    const handleClose = vi.fn();

    render(
      <CatalogRecordMergeModal
        isOpen
        title='Merge devices'
        records={mockRecords}
        onClose={handleClose}
        onMerge={handleMerge}
        getRecordId={(item) => item.id}
        getRecordName={(item) => item.name}
        getRecordSecondaryText={(item) => item.phone}
        getRecordNote={(item) => item.note}
      />,
    );

    const targetInput = screen.getByLabelText(
      /Target \(Surviving\)/i,
    );
    fireEvent.change(targetInput, { target: { value: 'iPhone 13' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: /^iPhone 13\+/i })[0],
    );

    const sourceInput = screen.getByLabelText(
      /Source \(To delete\)/i,
    );
    fireEvent.change(sourceInput, {
      target: { value: 'iPhone 13 Pro' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /^iPhone 13 Pro\+/i }),
    );

    const mergeBtn = screen.getByRole('button', { name: /^Merge$/i });
    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(handleMerge).toHaveBeenCalledWith('1', '2');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('displays error message when onMerge fails', async () => {
    const handleMerge = vi
      .fn()
      .mockRejectedValue(new Error('Server error occurred'));

    render(
      <CatalogRecordMergeModal
        isOpen
        title='Merge devices'
        records={mockRecords}
        onClose={vi.fn()}
        onMerge={handleMerge}
        getRecordId={(item) => item.id}
        getRecordName={(item) => item.name}
      />,
    );

    const targetInput = screen.getByLabelText(
      /Target \(Surviving\)/i,
    );
    fireEvent.change(targetInput, { target: { value: 'iPhone 13' } });
    fireEvent.click(
      screen.getAllByRole('button', { name: /iPhone 13/i })[0],
    );

    const sourceInput = screen.getByLabelText(
      /Source \(To delete\)/i,
    );
    fireEvent.change(sourceInput, {
      target: { value: 'iPhone 13 Pro' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /iPhone 13 Pro/i }),
    );

    const mergeBtn = screen.getByRole('button', { name: /^Merge$/i });
    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Server error occurred'),
      ).toBeInTheDocument();
    });
  });
});
