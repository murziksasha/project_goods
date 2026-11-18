import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  createLayoutPrintForm,
  defaultPrintForms,
  printFormVariableGroups,
  printFormVariables,
  type PrintForm,
  type PrintLayoutBlock,
} from '../../../../entities/settings';
import { PrintFormBuilder } from './PrintFormBuilder';
import i18n from '../../../../shared/i18n/config';

const buildTestForm = (blocks: PrintLayoutBlock[]): PrintForm => {
  const base = createLayoutPrintForm({
    ...defaultPrintForms[0],
    id: 'custom-variable-test',
    type: 'custom',
  });
  return {
    ...base,
    layoutBlocks: blocks,
  };
};

interface BuilderHarnessProps {
  initialBlocks: PrintLayoutBlock[];
  onFormChange?: (form: PrintForm) => void;
}

const BuilderHarness: React.FC<BuilderHarnessProps> = ({
  initialBlocks,
  onFormChange,
}) => {
  const [form, setForm] = useState(() => buildTestForm(initialBlocks));

  return (
    <PrintFormBuilder
      forms={[form]}
      selectedForm={form}
      previewValues={{}}
      onSelectForm={() => undefined}
      onUpdateForms={() => undefined}
      onUpdateForm={(_id, patch) => {
        setForm((current) => {
          const next = { ...current, ...patch };
          onFormChange?.(next);
          return next;
        });
      }}
      onDeleteForm={() => undefined}
    />
  );
};

describe('PrintFormBuilder VariablePicker collapse', () => {
  it.each([
    {
      name: 'Heading',
      block: {
        id: 'heading-1',
        type: 'heading' as const,
        level: 1 as const,
        text: 'Title ',
      },
      getTargetInput: () => screen.getByLabelText('Text') as HTMLInputElement,
      initialValue: 'Title ',
      expectedAfterInsert: 'Title {{orderNumber}}',
    },
    {
      name: 'Text',
      block: {
        id: 'paragraph-1',
        type: 'paragraph' as const,
        level: 3 as const,
        text: 'Body ',
      },
      getTargetInput: () => screen.getByLabelText('Text') as HTMLTextAreaElement,
      initialValue: 'Body ',
      expectedAfterInsert: 'Body {{orderNumber}}',
    },
    {
      name: 'Barcode',
      block: {
        id: 'barcode-1',
        type: 'barcode' as const,
        label: 'Code',
        value: '{{barcode}}',
        size: 'standard' as const,
        showValue: true,
      },
      getTargetInput: () => screen.getByLabelText('Value') as HTMLInputElement,
      initialValue: '{{barcode}}',
      expectedAfterInsert: '{{barcode}}{{orderNumber}}',
    },
  ])(
    'collapses and expands all variable groups in $name editor and inserts after expanding',
    ({ block, getTargetInput, initialValue, expectedAfterInsert }) => {
      let latestForm = buildTestForm([block]);
      const { container } = render(
        <BuilderHarness
          initialBlocks={[block]}
          onFormChange={(next) => {
            latestForm = next;
          }}
        />,
      );

      const heading = screen.getByRole('heading', { name: 'Template variables' });
      const toggle = screen.getByRole('button', { name: 'Template variables' });
      expect(heading).toContainElement(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle.getAttribute('aria-controls')).toBeTruthy();

      expect(container.querySelectorAll('.settings-variable-group')).toHaveLength(
        printFormVariableGroups.length,
      );
      expect(container.querySelectorAll('.settings-variable-row')).toHaveLength(
        printFormVariables.length,
      );

      fireEvent.click(toggle);

      expect(toggle).toBeVisible();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).not.toHaveAttribute('aria-controls');
      expect(container.querySelector('.settings-variable-grid')).toBeNull();
      expect(container.querySelectorAll('.settings-variable-group')).toHaveLength(0);
      expect(container.querySelectorAll('.settings-variable-row')).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /\{\{orderNumber\}\}/ })).toBeNull();
      expect(screen.queryByText('Special blocks')).toBeNull();

      // Toggling does not persist UI state into the template block.
      expect(latestForm.layoutBlocks).toEqual([block]);

      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelectorAll('.settings-variable-group')).toHaveLength(
        printFormVariableGroups.length,
      );
      expect(container.querySelectorAll('.settings-variable-row')).toHaveLength(
        printFormVariables.length,
      );

      expect(getTargetInput().value).toBe(initialValue);
      fireEvent.click(screen.getByRole('button', { name: /\{\{orderNumber\}\}/ }));
      expect(getTargetInput().value).toBe(expectedAfterInsert);
    },
  );

  it('resets collapsed state to expanded when the editor is reopened', () => {
    const headingBlock: PrintLayoutBlock = {
      id: 'heading-1',
      type: 'heading',
      level: 1,
      text: 'Receipt',
    };

    const firstRender = render(<BuilderHarness initialBlocks={[headingBlock]} />);
    const firstToggle = screen.getByRole('button', { name: 'Template variables' });
    fireEvent.click(firstToggle);
    expect(firstToggle).toHaveAttribute('aria-expanded', 'false');

    firstRender.unmount();

    render(<BuilderHarness initialBlocks={[headingBlock]} />);
    const reopenedToggle = screen.getByRole('button', { name: 'Template variables' });
    expect(reopenedToggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: /\{\{orderNumber\}\}/ }),
    ).toBeInTheDocument();
  });
});

describe('PrintFormBuilder print menu visibility', () => {
  it('turns the legacy state into an explicit list and allows hiding the template', () => {
    let latest: PrintForm | null = null;
    render(
      <BuilderHarness
        initialBlocks={[createPrintLayoutBlockForTest()]}
        onFormChange={(form) => {
          latest = form;
        }}
      />,
    );

    const sale = screen.getByRole('checkbox', { name: i18n.t('settings.printBuilder.printMenuTypes.sale') });
    const repair = screen.getByRole('checkbox', { name: i18n.t('settings.printBuilder.printMenuTypes.repair') });
    const warehouse = screen.getByRole('checkbox', { name: i18n.t('settings.printBuilder.printMenuTypes.warehouse') });
    expect([sale, repair, warehouse].every((box) => (box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText(i18n.t('settings.printBuilder.printMenuVisibilityLegacy'))).toBeInTheDocument();

    fireEvent.click(sale);
    expect(latest!.printMenuVisibility).toEqual(['repair', 'warehouse']);
    fireEvent.click(repair);
    fireEvent.click(warehouse);
    expect(latest!.printMenuVisibility).toEqual([]);
    expect(screen.getByText(i18n.t('settings.printBuilder.printMenuVisibilityHidden'))).toBeInTheDocument();
  });

  it('edits text size and columns layout of builder blocks', () => {
    let latest: PrintForm | null = null;
    render(
      <BuilderHarness
        initialBlocks={[{ id: 'p-1', type: 'paragraph', level: 3, text: '{{orderNumberShort}}' }]}
        onFormChange={(form) => {
          latest = form;
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(i18n.t('settings.printBuilder.textSize')), {
      target: { value: 'hero' },
    });
    expect(latest!.layoutBlocks?.[0]).toMatchObject({ size: 'hero' });
    expect(latest!.content).toContain('print-text-size-hero');
  });
});

function createPrintLayoutBlockForTest(): PrintLayoutBlock {
  return { id: 'p-vis', type: 'paragraph', level: 3, text: 'x' };
}
