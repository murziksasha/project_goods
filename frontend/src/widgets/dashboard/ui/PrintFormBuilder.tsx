import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import JsBarcode from 'jsbarcode';
import type {
  PrintForm,
  PrintLayoutBlock,
  PrintLayoutField,
  PrintLayoutTableColumn,
  PrintLayoutTableRow,
} from '../../../entities/settings/model/types';
import {
  createLayoutPrintForm,
  createPrintLayoutBlock,
  customLabelSizePresetId,
  getOrientedLabelSize,
  labelSizePresets,
  normalizeLabelSize,
  printFormVariableGroups,
  renderPrintLayout,
  renderPrintTemplate,
} from '../../../entities/settings/model/printForms';

type PrintFormBuilderProps = {
  forms: PrintForm[];
  selectedForm: PrintForm;
  previewValues: Record<string, string>;
  onSelectForm: (formId: string) => void;
  onUpdateForms: (forms: PrintForm[]) => void;
  onUpdateForm: (formId: string, patch: Partial<PrintForm>) => void;
  onDeleteForm: () => void;
};

const printFormTypeOptions = [
  'receipt',
  'check',
  'warranty',
  'completion-act',
  'invoice',
  'barcode',
  'custom',
];

const printFormVariableGroupKeys: Record<string, string> = {
  Order: 'order',
  Client: 'client',
  Device: 'device',
  Finance: 'finance',
  Team: 'team',
  'Company and warehouse': 'companyAndWarehouse',
  'Special blocks': 'specialBlocks',
};

const blockInsertOptions: PrintLayoutBlock['type'][] = [
  'heading',
  'paragraph',
  'fieldRow',
  'fieldGrid',
  'customTable',
  'lineItemsTable',
  'invoiceItemsTable',
  'barcode',
  'signatures',
  'divider',
  'spacer',
  'columns',
];

const alignOptions = ['left', 'center', 'right'] as const;
const barcodeSizeOptions = ['compact', 'standard', 'large'] as const;

const renderCodes = (root: HTMLElement | Document) => {
  root.querySelectorAll<SVGSVGElement>('svg[data-barcode-value]').forEach((node) => {
    if (node.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom')) return;
    const value = node.dataset.barcodeValue || 'EMPTY';
    const isLabelBarcode = Boolean(node.closest('.print-label'));
    try {
      JsBarcode(node, value, {
        format: 'CODE128',
        displayValue: !isLabelBarcode,
        fontSize: isLabelBarcode ? 18 : 12,
        textMargin: isLabelBarcode ? 1 : 2,
        height: isLabelBarcode ? 52 : 44,
        margin: 0,
      });
    } catch {
      node.replaceWith(document.createTextNode(value));
    }
  });
};

const getLabelPreviewStyle = (form: PrintForm): CSSProperties => {
  if (form.pageSize !== 'label') return {};
  const labelSize = getOrientedLabelSize(
    normalizeLabelSize(form.labelSize),
    form.orientation,
  );
  return {
    '--label-width': `${labelSize.widthMm}mm`,
    '--label-height': `${labelSize.heightMm}mm`,
    width: `${labelSize.widthMm}mm`,
    minHeight: `${labelSize.heightMm}mm`,
  } as CSSProperties;
};

const PrintPreview = ({ html, form }: { html: string; form: PrintForm }) => {
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (previewRef.current) renderCodes(previewRef.current);
  }, [html]);

  return (
    <div
      ref={previewRef}
      className={
        form.pageSize === 'label'
          ? 'settings-print-preview-page settings-print-preview-page-label'
          : 'settings-print-preview-page'
      }
      style={getLabelPreviewStyle(form)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const cloneBlock = (block: PrintLayoutBlock): PrintLayoutBlock =>
  JSON.parse(JSON.stringify(block)) as PrintLayoutBlock;

const regenerateLayoutContent = (form: PrintForm, blocks: PrintLayoutBlock[]) => ({
  ...form,
  layoutVersion: 1 as const,
  layoutBlocks: blocks,
  content: renderPrintLayout(blocks),
  contentFormat: 'html' as const,
});

const VariablePicker = ({ onInsert }: { onInsert: (variable: string) => void }) => {
  const { t } = useTranslation();

  return (
    <div className="settings-variable-catalog">
      <h3>{t('settings.printBuilder.templateVariables')}</h3>
      <div className="settings-variable-grid">
        {printFormVariableGroups.map((group) => {
          const groupKey = printFormVariableGroupKeys[group.title] ?? group.title;
          return (
            <div key={group.title} className="settings-variable-group">
              <strong>{t(`settings.printBuilder.variableGroups.${groupKey}`)}</strong>
              {group.variables.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  className="settings-variable-row"
                  onClick={() => onInsert(`{{${variable.key}}}`)}
                >
                  <code>{`{{${variable.key}}}`}</code>
                  <span>{t(`settings.printBuilder.variables.${variable.key}`)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TextInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="field">
    <span>{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const TextAreaInput = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="field field-wide">
    <span>{label}</span>
    <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const AlignInput = ({
  value,
  onChange,
}: {
  value: 'left' | 'center' | 'right' | undefined;
  onChange: (value: 'left' | 'center' | 'right') => void;
}) => {
  const { t } = useTranslation();
  const alignLabelKeys = {
    left: 'settings.printBuilder.alignLeft',
    center: 'settings.printBuilder.alignCenter',
    right: 'settings.printBuilder.alignRight',
  } as const;

  return (
    <label className="field">
      <span>{t('settings.printBuilder.align')}</span>
      <select
        value={value ?? 'left'}
        onChange={(event) => onChange(event.target.value as 'left' | 'center' | 'right')}
      >
        {alignOptions.map((align) => (
          <option key={align} value={align}>
            {t(alignLabelKeys[align])}
          </option>
        ))}
      </select>
    </label>
  );
};

const LevelInput = ({
  value,
  onChange,
}: {
  value: 1 | 2 | 3;
  onChange: (value: 1 | 2 | 3) => void;
}) => {
  const { t } = useTranslation();

  return (
    <label className="field">
      <span>{t('settings.printBuilder.level')}</span>
    <select
      value={value}
      onChange={(event) => onChange(Number(event.target.value) as 1 | 2 | 3)}
    >
      <option value={1}>H1</option>
      <option value={2}>H2</option>
      <option value={3}>H3</option>
    </select>
  </label>
  );
};

const updateField = (
  fields: PrintLayoutField[],
  index: number,
  patch: Partial<PrintLayoutField>,
) => fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field));

const updateTableColumn = (
  columns: PrintLayoutTableColumn[],
  index: number,
  patch: Partial<PrintLayoutTableColumn>,
) =>
  columns.map((column, columnIndex) =>
    columnIndex === index ? { ...column, ...patch } : column,
  );

const updateTableRow = (
  rows: PrintLayoutTableRow[],
  rowIndex: number,
  columnId: string,
  value: string,
) =>
  rows.map((row, index) =>
    index === rowIndex
      ? { ...row, cells: { ...row.cells, [columnId]: value } }
      : row,
  );

const BlockEditor = ({
  block,
  onChange,
}: {
  block: PrintLayoutBlock;
  onChange: (block: PrintLayoutBlock) => void;
}) => {
  const { t } = useTranslation();

  const appendToFirstText = (variable: string) => {
    if (block.type === 'heading' || block.type === 'paragraph') {
      onChange({ ...block, text: `${block.text}${variable}` });
    }
  };

  switch (block.type) {
    case 'heading':
      return (
        <div className="print-block-editor-fields">
          <TextInput
            label={t('settings.printBuilder.text')}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
          <LevelInput value={block.level} onChange={(level) => onChange({ ...block, level })} />
          <AlignInput value={block.align} onChange={(align) => onChange({ ...block, align })} />
          <VariablePicker onInsert={appendToFirstText} />
        </div>
      );
    case 'paragraph':
      return (
        <div className="print-block-editor-fields">
          <TextAreaInput
            label={t('settings.printBuilder.text')}
            value={block.text}
            onChange={(text) => onChange({ ...block, text })}
          />
          <LevelInput value={block.level} onChange={(level) => onChange({ ...block, level })} />
          <AlignInput value={block.align} onChange={(align) => onChange({ ...block, align })} />
          <VariablePicker onInsert={appendToFirstText} />
        </div>
      );
    case 'fieldRow':
    case 'fieldGrid':
      return (
        <div className="print-block-editor-fields">
          {block.type === 'fieldGrid' ? (
            <label className="field">
              <span>{t('settings.printBuilder.columns')}</span>
              <select
                value={block.columns ?? 2}
                onChange={(event) =>
                  onChange({ ...block, columns: Number(event.target.value) as 2 | 3 | 4 })
                }
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
          ) : null}
          <div className="print-builder-table-editor">
            {block.fields.map((field, index) => (
              <div key={`${block.id}-field-${index}`} className="print-builder-field-row">
                <input
                  aria-label={t('settings.printBuilder.fieldLabel', { index: index + 1 })}
                  value={field.label}
                  onChange={(event) =>
                    onChange({ ...block, fields: updateField(block.fields, index, { label: event.target.value }) })
                  }
                />
                <input
                  aria-label={t('settings.printBuilder.fieldValue', { index: index + 1 })}
                  value={field.value}
                  onChange={(event) =>
                    onChange({ ...block, fields: updateField(block.fields, index, { value: event.target.value }) })
                  }
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onChange({ ...block, fields: block.fields.filter((_, fieldIndex) => fieldIndex !== index) })}
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onChange({
                ...block,
                fields: [
                  ...block.fields,
                  { label: t('settings.printBuilder.defaultFieldLabel'), value: '{{orderNumber}}' },
                ],
              })
            }
          >
            {t('settings.printBuilder.addRow')}
          </button>
        </div>
      );
    case 'customTable':
      return (
        <div className="print-block-editor-fields">
          <div className="print-builder-table-editor">
            <strong>{t('settings.printBuilder.columns')}</strong>
            {block.columns.map((column, index) => (
              <div key={column.id} className="print-builder-field-row">
                <input
                  aria-label={t('settings.printBuilder.columnLabel', { index: index + 1 })}
                  value={column.label}
                  onChange={(event) =>
                    onChange({ ...block, columns: updateTableColumn(block.columns, index, { label: event.target.value }) })
                  }
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    onChange({
                      ...block,
                      columns: block.columns.filter((_, columnIndex) => columnIndex !== index),
                      rows: block.rows.map((row) => {
                        const cells = { ...row.cells };
                        delete cells[column.id];
                        return { ...row, cells };
                      }),
                    })
                  }
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const column = {
                  id: `col-${Date.now()}`,
                  label: t('settings.printBuilder.defaultColumnLabel'),
                };
                onChange({
                  ...block,
                  columns: [...block.columns, column],
                  rows: block.rows.map((row) => ({ ...row, cells: { ...row.cells, [column.id]: '' } })),
                });
              }}
            >
              {t('settings.printBuilder.addColumn')}
            </button>
            <strong>{t('settings.printBuilder.rows')}</strong>
            {block.rows.map((row, rowIndex) => (
              <div key={row.id} className="print-builder-custom-row">
                {block.columns.map((column) => (
                  <input
                    key={`${row.id}-${column.id}`}
                    aria-label={t('settings.printBuilder.columnRow', {
                      label: column.label,
                      index: rowIndex + 1,
                    })}
                    value={row.cells[column.id] ?? ''}
                    onChange={(event) =>
                      onChange({ ...block, rows: updateTableRow(block.rows, rowIndex, column.id, event.target.value) })
                    }
                  />
                ))}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onChange({ ...block, rows: block.rows.filter((_, index) => index !== rowIndex) })}
                >
                  {t('common.delete')}
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onChange({
                ...block,
                rows: [
                  ...block.rows,
                  {
                    id: `row-${Date.now()}`,
                    cells: Object.fromEntries(block.columns.map((column) => [column.id, ''])),
                  },
                ],
              })
            }
          >
            {t('settings.printBuilder.addRow')}
          </button>
        </div>
      );
    case 'lineItemsTable':
      return (
        <div className="print-block-editor-fields">
          <TextInput
            label={t('settings.printBuilder.title')}
            value={block.title ?? ''}
            onChange={(title) => onChange({ ...block, title })}
          />
          <label className="field">
            <span>{t('settings.printBuilder.source')}</span>
            <select
              value={block.kind}
              onChange={(event) =>
                onChange({ ...block, kind: event.target.value === 'services' ? 'services' : 'products' })
              }
            >
              <option value="products">{t('settings.printBuilder.products')}</option>
              <option value="services">{t('settings.printBuilder.services')}</option>
            </select>
          </label>
        </div>
      );
    case 'invoiceItemsTable':
      return (
        <TextInput
          label={t('settings.printBuilder.title')}
          value={block.title ?? ''}
          onChange={(title) => onChange({ ...block, title })}
        />
      );
    case 'barcode':
      {
        const appendToBarcodeValue = (variable: string) => {
          onChange({ ...block, value: `${block.value ?? '{{barcode}}'}${variable}` });
        };

        const barcodeSizeLabelKeys = {
          compact: 'settings.printBuilder.barcodeSizeCompact',
          standard: 'settings.printBuilder.barcodeSizeStandard',
          large: 'settings.printBuilder.barcodeSizeLarge',
        } as const;

        return (
          <div className="print-block-editor-fields">
            <TextInput
              label={t('settings.printBuilder.label')}
              value={block.label ?? ''}
              onChange={(label) => onChange({ ...block, label })}
            />
            <TextInput
              label={t('settings.printBuilder.value')}
              value={block.value ?? '{{barcode}}'}
              onChange={(value) => onChange({ ...block, value })}
            />
            <label className="field">
              <span>{t('settings.printBuilder.size')}</span>
              <select
                value={block.size ?? 'standard'}
                onChange={(event) =>
                  onChange({
                    ...block,
                    size: event.target.value === 'compact'
                      ? 'compact'
                      : event.target.value === 'large'
                        ? 'large'
                        : 'standard',
                  })
                }
              >
                {barcodeSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {t(barcodeSizeLabelKeys[size])}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={block.showValue === true}
                onChange={(event) => onChange({ ...block, showValue: event.target.checked })}
              />
              <span>{t('settings.printBuilder.showValueUnderBarcode')}</span>
            </label>
            <VariablePicker onInsert={appendToBarcodeValue} />
          </div>
        );
      }
    case 'signatures':
      return (
        <div className="print-block-editor-fields">
          <TextInput
            label={t('settings.printBuilder.left')}
            value={block.left}
            onChange={(left) => onChange({ ...block, left })}
          />
          <TextInput
            label={t('settings.printBuilder.right')}
            value={block.right}
            onChange={(right) => onChange({ ...block, right })}
          />
        </div>
      );
    case 'spacer':
      return (
        <label className="field">
          <span>{t('settings.printBuilder.size')}</span>
          <select
            value={block.size}
            onChange={(event) =>
              onChange({ ...block, size: event.target.value === 'large' ? 'large' : event.target.value === 'small' ? 'small' : 'medium' })
            }
          >
            <option value="small">{t('settings.printBuilder.spacerSmall')}</option>
            <option value="medium">{t('settings.printBuilder.spacerMedium')}</option>
            <option value="large">{t('settings.printBuilder.spacerLarge')}</option>
          </select>
        </label>
      );
    case 'columns':
      return (
        <div className="print-block-editor-fields">
          {block.columns.map((column, index) => (
            <TextAreaInput
              key={column.id}
              label={t('settings.printBuilder.columnText', { index: index + 1 })}
              value={column.blocks.map((item) => (item.type === 'paragraph' ? item.text : '')).join('\n')}
              onChange={(text) =>
                onChange({
                  ...block,
                  columns: block.columns.map((current) => {
                    if (current.id !== column.id) return current;
                    const existingParagraph = current.blocks.find((item) => item.type === 'paragraph');
                    return {
                      ...current,
                      blocks: [
                        {
                          id: `${column.id}-text`,
                          type: 'paragraph' as const,
                          level: existingParagraph?.type === 'paragraph' ? existingParagraph.level : 3,
                          text,
                        },
                      ],
                    };
                  }),
                })
              }
            />
          ))}
        </div>
      );
    case 'divider':
    default:
      return <p className="print-builder-muted">{t('settings.printBuilder.noBlockSettings')}</p>;
  }
};

export const PrintFormBuilder = ({
  forms,
  selectedForm,
  previewValues,
  onSelectForm,
  onUpdateForms,
  onUpdateForm,
  onDeleteForm,
}: PrintFormBuilderProps) => {
  const { t } = useTranslation();
  const [activeBlockId, setActiveBlockId] = useState(
    () => selectedForm.layoutBlocks?.[0]?.id ?? '',
  );
  const labelSize = normalizeLabelSize(selectedForm.labelSize);
  const isLegacy = !selectedForm.layoutBlocks?.length;
  const blocks = selectedForm.layoutBlocks ?? [];
  const firstBlockId = selectedForm.layoutBlocks?.[0]?.id ?? '';
  const selectedBlock = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];
  const previewHtml = useMemo(
    () => renderPrintTemplate(selectedForm.content, previewValues, selectedForm.contentFormat),
    [previewValues, selectedForm.content, selectedForm.contentFormat],
  );

  useEffect(() => {
    setActiveBlockId(firstBlockId);
  }, [firstBlockId, selectedForm.id]);

  const updateBlocks = (nextBlocks: PrintLayoutBlock[]) => {
    onUpdateForm(selectedForm.id, regenerateLayoutContent(selectedForm, nextBlocks));
  };

  const updateBlock = (blockId: string, nextBlock: PrintLayoutBlock) => {
    updateBlocks(blocks.map((block) => (block.id === blockId ? nextBlock : block)));
  };

  const addBlock = (type: PrintLayoutBlock['type']) => {
    const block = createPrintLayoutBlock(type);
    updateBlocks([...blocks, block]);
    setActiveBlockId(block.id);
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    const index = blocks.findIndex((block) => block.id === blockId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= blocks.length) return;
    const nextBlocks = [...blocks];
    const [block] = nextBlocks.splice(index, 1);
    nextBlocks.splice(targetIndex, 0, block);
    updateBlocks(nextBlocks);
  };

  const duplicateBlock = (block: PrintLayoutBlock) => {
    const copy = { ...cloneBlock(block), id: `${block.type}-${Date.now()}` };
    const index = blocks.findIndex((item) => item.id === block.id);
    const nextBlocks = [...blocks];
    nextBlocks.splice(index + 1, 0, copy);
    updateBlocks(nextBlocks);
    setActiveBlockId(copy.id);
  };

  const convertLegacyToLayout = () => {
    const converted = createLayoutPrintForm({
      ...selectedForm,
      id: `${selectedForm.id}-layout-${Date.now()}`,
      title: t('settings.printBuilder.layoutSuffix', { title: selectedForm.title }),
      type: selectedForm.type || 'custom',
      sortOrder: (forms.length + 1) * 10,
    });
    onUpdateForms([...forms, converted]);
    onSelectForm(converted.id);
  };

  const updateSelectedFormPageSize = (pageSize: PrintForm['pageSize']) => {
    onUpdateForm(selectedForm.id, {
      pageSize,
      labelSize:
        pageSize === 'label'
          ? normalizeLabelSize(selectedForm.labelSize)
          : selectedForm.labelSize,
    });
  };

  const updateLabelPreset = (presetId: string) => {
    const preset = labelSizePresets.find((item) => item.id === presetId);
    onUpdateForm(selectedForm.id, {
      labelSize: preset
        ? { presetId: preset.id, widthMm: preset.widthMm, heightMm: preset.heightMm }
        : { ...labelSize, presetId: customLabelSizePresetId },
    });
  };

  const updateLabelSize = (field: 'widthMm' | 'heightMm', value: number) => {
    onUpdateForm(selectedForm.id, {
      labelSize: { ...labelSize, presetId: customLabelSizePresetId, [field]: value },
    });
  };

  return (
    <div className="settings-print-builder">
      <div className="settings-print-editor">
        <div className="settings-print-options-row">
          <TextInput
            label={t('settings.printBuilder.templateName')}
            value={selectedForm.title}
            onChange={(title) => onUpdateForm(selectedForm.id, { title })}
          />
          <label className="field">
            <span>{t('settings.printBuilder.documentType')}</span>
            <select value={selectedForm.type} onChange={(event) => onUpdateForm(selectedForm.id, { type: event.target.value })}>
              {printFormTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-print-options-row">
          <label className="field">
            <span>{t('settings.printBuilder.pageSize')}</span>
            <select value={selectedForm.pageSize} onChange={(event) => updateSelectedFormPageSize(event.target.value === 'label' ? 'label' : 'A4')}>
              <option value="A4">{t('settings.printBuilder.pageSizeA4')}</option>
              <option value="label">{t('settings.printBuilder.pageSizeLabel')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('settings.printBuilder.orientation')}</span>
            <select
              value={selectedForm.orientation}
              onChange={(event) =>
                onUpdateForm(selectedForm.id, {
                  orientation: event.target.value === 'landscape' ? 'landscape' : 'portrait',
                })
              }
            >
              <option value="portrait">{t('settings.printBuilder.portrait')}</option>
              <option value="landscape">{t('settings.printBuilder.landscape')}</option>
            </select>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={selectedForm.isActive}
              onChange={(event) => onUpdateForm(selectedForm.id, { isActive: event.target.checked })}
            />
            <span>{t('settings.printBuilder.activeInPrintMenu')}</span>
          </label>
        </div>
        {selectedForm.pageSize === 'label' ? (
          <div className="settings-print-options-row settings-label-size-row">
            <label className="field">
              <span>{t('settings.printBuilder.labelSize')}</span>
              <select value={labelSize.presetId} onChange={(event) => updateLabelPreset(event.target.value)}>
                {labelSizePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
                <option value={customLabelSizePresetId}>{t('settings.printBuilder.custom')}</option>
              </select>
            </label>
            <TextInput
              label={t('settings.printBuilder.widthMm')}
              value={String(labelSize.widthMm)}
              onChange={(value) => updateLabelSize('widthMm', Number(value))}
            />
            <TextInput
              label={t('settings.printBuilder.heightMm')}
              value={String(labelSize.heightMm)}
              onChange={(value) => updateLabelSize('heightMm', Number(value))}
            />
          </div>
        ) : null}

        {isLegacy ? (
          <div className="settings-legacy-editor">
            <p className="section-label">{t('settings.printBuilder.legacyHtmlForm')}</p>
            <textarea
              className="settings-html-source"
              rows={14}
              value={selectedForm.content}
              onChange={(event) =>
                onUpdateForm(selectedForm.id, { content: event.target.value, contentFormat: 'html' })
              }
            />
            <button type="button" className="secondary-button" onClick={convertLegacyToLayout}>
              {t('settings.printBuilder.duplicateAsBlockLayout')}
            </button>
          </div>
        ) : (
          <>
            <div className="print-builder-toolbar">
              {blockInsertOptions.map((type) => (
                <button key={type} type="button" className="secondary-button" onClick={() => addBlock(type)}>
                  {t(`settings.printBuilder.blockTypes.${type}`)}
                </button>
              ))}
            </div>
            <div className="print-builder-workspace">
              <div className="print-builder-block-list">
                {blocks.map((block, index) => (
                  <button
                    key={block.id}
                    type="button"
                    className={block.id === selectedBlock?.id ? 'print-builder-block-item print-builder-block-item-active' : 'print-builder-block-item'}
                    onClick={() => setActiveBlockId(block.id)}
                  >
                    <span>{index + 1}. {t(`settings.printBuilder.blockTypes.${block.type}`)}</span>
                    <small>{block.id}</small>
                  </button>
                ))}
              </div>
              {selectedBlock ? (
                <div className="print-builder-block-editor">
                  <div className="print-builder-block-actions">
                    <strong>{t(`settings.printBuilder.blockTypes.${selectedBlock.type}`)}</strong>
                    <button type="button" className="secondary-button" onClick={() => moveBlock(selectedBlock.id, -1)}>
                      {t('settings.printBuilder.up')}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => moveBlock(selectedBlock.id, 1)}>
                      {t('settings.printBuilder.down')}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => duplicateBlock(selectedBlock)}>
                      {t('settings.printBuilder.duplicate')}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => updateBlocks(blocks.filter((block) => block.id !== selectedBlock.id))}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  <BlockEditor block={selectedBlock} onChange={(block) => updateBlock(selectedBlock.id, block)} />
                </div>
              ) : null}
            </div>
          </>
        )}
        <button type="button" className="danger-button" onClick={onDeleteForm} disabled={forms.length <= 1}>
          {t('settings.printBuilder.deleteTemplate')}
        </button>
      </div>
      <aside className="settings-print-preview">
        <p className="section-label">{t('settings.printBuilder.livePreview')}</p>
        <h3>{selectedForm.title}</h3>
        <PrintPreview html={previewHtml} form={selectedForm} />
      </aside>
    </div>
  );
};

