import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

const blockTypeLabels: Record<PrintLayoutBlock['type'], string> = {
  heading: 'Heading',
  paragraph: 'Text',
  fieldRow: 'Field row',
  fieldGrid: 'Field grid',
  customTable: 'Editable table',
  lineItemsTable: 'Items table',
  invoiceItemsTable: 'Invoice table',
  barcode: 'Barcode',
  signatures: 'Signatures',
  divider: 'Divider',
  spacer: 'Spacer',
  columns: 'Columns',
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
        height: isLabelBarcode ? 38 : 44,
        margin: 0,
      });
    } catch {
      node.replaceWith(document.createTextNode(value));
    }
  });
};

const getLabelPreviewStyle = (form: PrintForm): CSSProperties => {
  if (form.pageSize !== 'label') return {};
  const labelSize = normalizeLabelSize(form.labelSize);
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

const VariablePicker = ({ onInsert }: { onInsert: (variable: string) => void }) => (
  <div className="settings-variable-catalog">
    <h3>Template variables</h3>
    <div className="settings-variable-grid">
      {printFormVariableGroups.map((group) => (
        <div key={group.title} className="settings-variable-group">
          <strong>{group.title}</strong>
          {group.variables.map((variable) => (
            <button
              key={variable.key}
              type="button"
              className="settings-variable-row"
              onClick={() => onInsert(`{{${variable.key}}}`)}
            >
              <code>{`{{${variable.key}}}`}</code>
              <span>{variable.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  </div>
);

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
  const appendToFirstText = (variable: string) => {
    if (block.type === 'heading' || block.type === 'paragraph') {
      onChange({ ...block, text: `${block.text}${variable}` });
    }
  };

  switch (block.type) {
    case 'heading':
      return (
        <div className="print-block-editor-fields">
          <TextInput label="Text" value={block.text} onChange={(text) => onChange({ ...block, text })} />
          <label className="field">
            <span>Level</span>
            <select
              value={block.level}
              onChange={(event) =>
                onChange({ ...block, level: Number(event.target.value) as 1 | 2 | 3 })
              }
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </label>
          <VariablePicker onInsert={appendToFirstText} />
        </div>
      );
    case 'paragraph':
      return (
        <div className="print-block-editor-fields">
          <TextAreaInput label="Text" value={block.text} onChange={(text) => onChange({ ...block, text })} />
          <VariablePicker onInsert={appendToFirstText} />
        </div>
      );
    case 'fieldRow':
    case 'fieldGrid':
      return (
        <div className="print-block-editor-fields">
          {block.type === 'fieldGrid' ? (
            <label className="field">
              <span>Columns</span>
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
                  aria-label={`Field label ${index + 1}`}
                  value={field.label}
                  onChange={(event) =>
                    onChange({ ...block, fields: updateField(block.fields, index, { label: event.target.value }) })
                  }
                />
                <input
                  aria-label={`Field value ${index + 1}`}
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
                  Delete
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              onChange({ ...block, fields: [...block.fields, { label: 'Label', value: '{{orderNumber}}' }] })
            }
          >
            Add row
          </button>
        </div>
      );
    case 'customTable':
      return (
        <div className="print-block-editor-fields">
          <div className="print-builder-table-editor">
            <strong>Columns</strong>
            {block.columns.map((column, index) => (
              <div key={column.id} className="print-builder-field-row">
                <input
                  aria-label={`Column label ${index + 1}`}
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
                  Delete
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const column = { id: `col-${Date.now()}`, label: 'Column' };
                onChange({
                  ...block,
                  columns: [...block.columns, column],
                  rows: block.rows.map((row) => ({ ...row, cells: { ...row.cells, [column.id]: '' } })),
                });
              }}
            >
              Add column
            </button>
            <strong>Rows</strong>
            {block.rows.map((row, rowIndex) => (
              <div key={row.id} className="print-builder-custom-row">
                {block.columns.map((column) => (
                  <input
                    key={`${row.id}-${column.id}`}
                    aria-label={`${column.label} row ${rowIndex + 1}`}
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
                  Delete
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
            Add row
          </button>
        </div>
      );
    case 'lineItemsTable':
      return (
        <div className="print-block-editor-fields">
          <TextInput label="Title" value={block.title ?? ''} onChange={(title) => onChange({ ...block, title })} />
          <label className="field">
            <span>Source</span>
            <select
              value={block.kind}
              onChange={(event) =>
                onChange({ ...block, kind: event.target.value === 'services' ? 'services' : 'products' })
              }
            >
              <option value="products">Products</option>
              <option value="services">Services</option>
            </select>
          </label>
        </div>
      );
    case 'invoiceItemsTable':
      return (
        <TextInput label="Title" value={block.title ?? ''} onChange={(title) => onChange({ ...block, title })} />
      );
    case 'barcode':
      return (
        <TextInput label="Label" value={block.label ?? ''} onChange={(label) => onChange({ ...block, label })} />
      );
    case 'signatures':
      return (
        <div className="print-block-editor-fields">
          <TextInput label="Left" value={block.left} onChange={(left) => onChange({ ...block, left })} />
          <TextInput label="Right" value={block.right} onChange={(right) => onChange({ ...block, right })} />
        </div>
      );
    case 'spacer':
      return (
        <label className="field">
          <span>Size</span>
          <select
            value={block.size}
            onChange={(event) =>
              onChange({ ...block, size: event.target.value === 'large' ? 'large' : event.target.value === 'small' ? 'small' : 'medium' })
            }
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
      );
    case 'columns':
      return (
        <div className="print-block-editor-fields">
          {block.columns.map((column, index) => (
            <TextAreaInput
              key={column.id}
              label={`Column ${index + 1} text`}
              value={column.blocks.map((item) => (item.type === 'paragraph' ? item.text : '')).join('\n')}
              onChange={(text) =>
                onChange({
                  ...block,
                  columns: block.columns.map((current) =>
                    current.id === column.id
                      ? {
                          ...current,
                          blocks: [
                            {
                              id: `${column.id}-text`,
                              type: 'paragraph' as const,
                              text,
                            },
                          ],
                        }
                      : current,
                  ),
                })
              }
            />
          ))}
        </div>
      );
    case 'divider':
    default:
      return <p className="print-builder-muted">This block has no settings.</p>;
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
  const [activeBlockId, setActiveBlockId] = useState(
    () => selectedForm.layoutBlocks?.[0]?.id ?? '',
  );
  const labelSize = normalizeLabelSize(selectedForm.labelSize);
  const isLegacy = !selectedForm.layoutBlocks?.length;
  const blocks = selectedForm.layoutBlocks ?? [];
  const selectedBlock = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];
  const previewHtml = useMemo(
    () => renderPrintTemplate(selectedForm.content, previewValues, selectedForm.contentFormat),
    [previewValues, selectedForm.content, selectedForm.contentFormat],
  );

  useEffect(() => {
    setActiveBlockId(selectedForm.layoutBlocks?.[0]?.id ?? '');
  }, [selectedForm.id]);

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
      title: `${selectedForm.title} layout`,
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
          <TextInput label="Template name" value={selectedForm.title} onChange={(title) => onUpdateForm(selectedForm.id, { title })} />
          <label className="field">
            <span>Document type</span>
            <select value={selectedForm.type} onChange={(event) => onUpdateForm(selectedForm.id, { type: event.target.value })}>
              {printFormTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-print-options-row">
          <label className="field">
            <span>Page size</span>
            <select value={selectedForm.pageSize} onChange={(event) => updateSelectedFormPageSize(event.target.value === 'label' ? 'label' : 'A4')}>
              <option value="A4">A4</option>
              <option value="label">Label</option>
            </select>
          </label>
          <label className="field">
            <span>Orientation</span>
            <select
              value={selectedForm.orientation}
              onChange={(event) =>
                onUpdateForm(selectedForm.id, {
                  orientation: event.target.value === 'landscape' ? 'landscape' : 'portrait',
                })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={selectedForm.isActive}
              onChange={(event) => onUpdateForm(selectedForm.id, { isActive: event.target.checked })}
            />
            <span>Active in print menu</span>
          </label>
        </div>
        {selectedForm.pageSize === 'label' ? (
          <div className="settings-print-options-row settings-label-size-row">
            <label className="field">
              <span>Label size</span>
              <select value={labelSize.presetId} onChange={(event) => updateLabelPreset(event.target.value)}>
                {labelSizePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
                <option value={customLabelSizePresetId}>Custom</option>
              </select>
            </label>
            <TextInput label="Width, mm" value={String(labelSize.widthMm)} onChange={(value) => updateLabelSize('widthMm', Number(value))} />
            <TextInput label="Height, mm" value={String(labelSize.heightMm)} onChange={(value) => updateLabelSize('heightMm', Number(value))} />
          </div>
        ) : null}

        {isLegacy ? (
          <div className="settings-legacy-editor">
            <p className="section-label">Legacy HTML form</p>
            <textarea
              className="settings-html-source"
              rows={14}
              value={selectedForm.content}
              onChange={(event) =>
                onUpdateForm(selectedForm.id, { content: event.target.value, contentFormat: 'html' })
              }
            />
            <button type="button" className="secondary-button" onClick={convertLegacyToLayout}>
              Duplicate as block layout
            </button>
          </div>
        ) : (
          <>
            <div className="print-builder-toolbar">
              {blockInsertOptions.map((type) => (
                <button key={type} type="button" className="secondary-button" onClick={() => addBlock(type)}>
                  {blockTypeLabels[type]}
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
                    <span>{index + 1}. {blockTypeLabels[block.type]}</span>
                    <small>{block.id}</small>
                  </button>
                ))}
              </div>
              {selectedBlock ? (
                <div className="print-builder-block-editor">
                  <div className="print-builder-block-actions">
                    <strong>{blockTypeLabels[selectedBlock.type]}</strong>
                    <button type="button" className="secondary-button" onClick={() => moveBlock(selectedBlock.id, -1)}>Up</button>
                    <button type="button" className="secondary-button" onClick={() => moveBlock(selectedBlock.id, 1)}>Down</button>
                    <button type="button" className="secondary-button" onClick={() => duplicateBlock(selectedBlock)}>Duplicate</button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => updateBlocks(blocks.filter((block) => block.id !== selectedBlock.id))}
                    >
                      Delete
                    </button>
                  </div>
                  <BlockEditor block={selectedBlock} onChange={(block) => updateBlock(selectedBlock.id, block)} />
                </div>
              ) : null}
            </div>
          </>
        )}
        <button type="button" className="danger-button" onClick={onDeleteForm} disabled={forms.length <= 1}>
          Delete template
        </button>
      </div>
      <aside className="settings-print-preview">
        <p className="section-label">Live preview</p>
        <h3>{selectedForm.title}</h3>
        <PrintPreview html={previewHtml} form={selectedForm} />
      </aside>
    </div>
  );
};

