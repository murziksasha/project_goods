import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberStepper } from './NumberStepper';

describe('NumberStepper', () => {
  it('accepts comma and dot decimal input without collapsing editable states', () => {
    const onChange = vi.fn();
    const { container } = render(<NumberStepper value='' onChange={onChange} />);

    const stepper = container.querySelector('.number-stepper') as HTMLElement;
    const input = within(stepper).getByRole('textbox');
    fireEvent.change(input, { target: { value: '834,48' } });
    fireEvent.change(input, { target: { value: '834.48' } });
    fireEvent.change(input, { target: { value: '0,01' } });
    fireEvent.change(input, { target: { value: '834,' } });

    expect(onChange).toHaveBeenNthCalledWith(1, '834,48');
    expect(onChange).toHaveBeenNthCalledWith(2, '834.48');
    expect(onChange).toHaveBeenNthCalledWith(3, '0,01');
    expect(onChange).toHaveBeenNthCalledWith(4, '834,');
  });

  it('steps whole currency units when configured with integer precision', () => {
    const onChange = vi.fn();
    const { container } = render(
      <NumberStepper
        value='100'
        onChange={onChange}
        min={0}
        step={1}
        precision={0}
      />,
    );

    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(onChange).toHaveBeenNthCalledWith(1, '101');
    expect(onChange).toHaveBeenNthCalledWith(2, '99');
  });

  it('steps money by cents when configured with precision', () => {
    const onChange = vi.fn();
    const { container } = render(
      <NumberStepper
        value='834,48'
        onChange={onChange}
        min={0}
        step={0.01}
        precision={2}
      />,
    );

    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    expect(onChange).toHaveBeenNthCalledWith(1, '834.49');
    expect(onChange).toHaveBeenNthCalledWith(2, '834.47');
  });
});
