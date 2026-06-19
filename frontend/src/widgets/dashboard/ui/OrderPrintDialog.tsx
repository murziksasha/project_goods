import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PrintForm } from '../../../entities/settings/model/types';
import {
  customLabelSizePresetId,
  defaultPrintForms,
  getOrientedLabelSize,
  labelSizePresets,
  normalizeLabelSize,
  normalizePrintFormsForView,
} from '../../../entities/settings/model/printForms';
import { PrinterIcon } from './PrinterIcon';
import {
  buildOrderPrintBody,
  getPrintTemplateData,
  openOrderPrintWindow,
  renderOrderPrintCodes,
  type OrderPrintRequest,
  type PrintCompanySettings,
} from './orders-workspace-shared';

export const OrderPrintPreview = ({
  html,
  orderNumber,
  pageSize,
  labelSize,
  orientation,
}: {
  html: string;
  orderNumber: string;
  pageSize: PrintForm['pageSize'];
  labelSize: NonNullable<PrintForm['labelSize']>;
  orientation: PrintForm['orientation'];
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const orientedLabelSize = getOrientedLabelSize(labelSize, orientation);
  const previewStyle =
    pageSize === 'label'
      ? ({
          '--label-width': `${orientedLabelSize.widthMm}mm`,
          '--label-height': `${orientedLabelSize.heightMm}mm`,
          width: `${orientedLabelSize.widthMm}mm`,
          minHeight: `${orientedLabelSize.heightMm}mm`,
        } as CSSProperties)
      : undefined;

  useEffect(() => {
    if (previewRef.current) {
      void renderOrderPrintCodes(previewRef.current, orderNumber);
    }
  }, [html, orderNumber]);

  return (
    <div
      ref={previewRef}
      className={
        pageSize === 'label'
          ? 'order-print-preview-page settings-print-preview-page settings-print-preview-page-label'
          : 'order-print-preview-page settings-print-preview-page'
      }
      style={previewStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export type OrderPrintDialogProps = {
  request: OrderPrintRequest;
  printForms: PrintForm[];
  companySettings: PrintCompanySettings;
  onClose: () => void;
};

export const OrderPrintDialog = ({
  request,
  printForms,
  companySettings,
  onClose,
}: OrderPrintDialogProps) => {
  const availablePrintForms = normalizePrintFormsForView(
    printForms.length > 0 ? printForms : defaultPrintForms,
  ).filter((form) => form.isActive);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const selectedForms = availablePrintForms.filter((form) =>
    selectedFormIds.includes(form.id),
  );
  const firstSelectedForm = selectedForms[0] ?? availablePrintForms[0];
  const firstSelectedFormId = firstSelectedForm?.id;
  const firstSelectedFormPageSize = firstSelectedForm?.pageSize;
  const firstSelectedFormLabelSize = firstSelectedForm?.labelSize;
  const firstSelectedFormOrientation = firstSelectedForm?.orientation;
  const [pageSize, setPageSize] = useState<PrintForm['pageSize']>(
    firstSelectedFormPageSize ?? 'A4',
  );
  const [labelSize, setLabelSize] = useState<NonNullable<PrintForm['labelSize']>>(
    normalizeLabelSize(firstSelectedFormLabelSize),
  );
  const [orientation, setOrientation] = useState<PrintForm['orientation']>(
    firstSelectedFormOrientation ?? 'portrait',
  );

  // Resolve from selected form (esp. auto for Barcode label forms) to prevent A4+label mismatch
  const resolvedPageSize = firstSelectedForm?.pageSize ?? pageSize;
  const resolvedLabelSize = firstSelectedForm
    ? normalizeLabelSize(firstSelectedForm.labelSize)
    : labelSize;
  const resolvedOrientation = firstSelectedForm?.orientation ?? orientation;
  const [copies, setCopies] = useState(1);
  const [autoClose, setAutoClose] = useState(true);
  const templateData = getPrintTemplateData(
    request.sale,
    request.lineItems,
    request.paidAmount,
    request.orderNumber,
    companySettings,
  );
  const previewBody = buildOrderPrintBody(
    selectedForms,
    templateData,
    copies,
    resolvedPageSize,
    resolvedLabelSize,
    resolvedOrientation,
  );
  const canPrint = selectedForms.length > 0;

  useEffect(() => {
    if (!firstSelectedFormId) return;
    setPageSize(firstSelectedFormPageSize ?? 'A4');
    setLabelSize(normalizeLabelSize(firstSelectedFormLabelSize));
    setOrientation(firstSelectedFormOrientation ?? 'portrait');
  }, [
    firstSelectedFormId,
    firstSelectedFormLabelSize,
    firstSelectedFormOrientation,
    firstSelectedFormPageSize,
  ]);

  const togglePrintForm = (formId: string) => {
    setSelectedFormIds((current) =>
      current.includes(formId) ? [] : [formId],
    );
  };

  const updateLabelPreset = (presetId: string) => {
    const preset = labelSizePresets.find((item) => item.id === presetId);
    setLabelSize(
      preset
        ? {
            presetId: preset.id,
            widthMm: preset.widthMm,
            heightMm: preset.heightMm,
          }
        : {
            ...labelSize,
            presetId: customLabelSizePresetId,
          },
    );
  };

  const updateLabelSize = (field: 'widthMm' | 'heightMm', value: number) => {
    setLabelSize((current) => ({
      ...current,
      presetId: customLabelSizePresetId,
      [field]: value,
    }));
  };

  const openPreviewWindow = () =>
    openOrderPrintWindow({
      title: `Preview ${request.orderNumber}`,
      body: previewBody,
      pageSize: resolvedPageSize,
      labelSize: resolvedLabelSize,
      orientation: resolvedOrientation,
      orderNumber: request.orderNumber,
      shouldPrint: false,
      autoClose: false,
    });

  const printSelectedForms = () =>
    openOrderPrintWindow({
      title: `Print forms ${request.orderNumber}`,
      body: previewBody,
      pageSize: resolvedPageSize,
      labelSize: resolvedLabelSize,
      orientation: resolvedOrientation,
      orderNumber: request.orderNumber,
      shouldPrint: true,
      autoClose,
    });

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='order-print-dialog'
        role='dialog'
        aria-modal='true'
        aria-label='Print order'
      >
        <header className='order-print-dialog-header'>
          <div>
            <p className='section-label'>Print preview</p>
            <h2>{request.orderNumber}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label='Close print preview'
          >
            &times;
          </button>
        </header>

        <div className='order-print-dialog-grid'>
          <aside className='order-print-settings'>
            <h3>Forms</h3>
            <div className='order-print-form-list'>
              {availablePrintForms.map((form) => (
                <label key={form.id} className='payment-print-option'>
                  <input
                    type='checkbox'
                    checked={selectedFormIds.includes(form.id)}
                    onChange={() => togglePrintForm(form.id)}
                  />
                  <span>{form.title}</span>
                </label>
              ))}
            </div>

            <h3>Print settings</h3>
            <label className='field'>
              <span>Page size</span>
              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(event.target.value === 'label' ? 'label' : 'A4')
                }
              >
                <option value='A4'>A4</option>
                <option value='label'>Label</option>
              </select>
            </label>
            {pageSize === 'label' ? (
              <>
                <label className='field'>
                  <span>Label size</span>
                  <select
                    value={labelSize.presetId}
                    onChange={(event) => updateLabelPreset(event.target.value)}
                  >
                    {labelSizePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                    <option value={customLabelSizePresetId}>Custom</option>
                  </select>
                </label>
                <label className='field'>
                  <span>Width, mm</span>
                  <input
                    type='number'
                    min={10}
                    max={120}
                    step={1}
                    value={labelSize.widthMm}
                    disabled={labelSize.presetId !== customLabelSizePresetId}
                    onChange={(event) =>
                      updateLabelSize('widthMm', Number(event.target.value))
                    }
                  />
                </label>
                <label className='field'>
                  <span>Height, mm</span>
                  <input
                    type='number'
                    min={10}
                    max={120}
                    step={1}
                    value={labelSize.heightMm}
                    disabled={labelSize.presetId !== customLabelSizePresetId}
                    onChange={(event) =>
                      updateLabelSize('heightMm', Number(event.target.value))
                    }
                  />
                </label>
              </>
            ) : null}
            <label className='field'>
              <span>Orientation</span>
              <select
                value={orientation}
                onChange={(event) =>
                  setOrientation(
                    event.target.value === 'landscape' ? 'landscape' : 'portrait',
                  )
                }
              >
                <option value='portrait'>Portrait</option>
                <option value='landscape'>Landscape</option>
              </select>
            </label>
            <label className='field'>
              <span>Copies</span>
              <input
                type='number'
                min={1}
                max={10}
                value={copies}
                onChange={(event) =>
                  setCopies(Math.min(Math.max(Number(event.target.value) || 1, 1), 10))
                }
              />
            </label>
            <label className='settings-check'>
              <input
                type='checkbox'
                checked={autoClose}
                onChange={(event) => setAutoClose(event.target.checked)}
              />
              <span>Close print window after print</span>
            </label>
          </aside>

          <main className='order-print-preview'>
            {canPrint ? (
              <OrderPrintPreview
                html={previewBody}
                orderNumber={request.orderNumber}
                pageSize={resolvedPageSize}
                labelSize={resolvedLabelSize}
                orientation={resolvedOrientation}
              />
            ) : (
              <p className='empty-state'>Select at least one print form.</p>
            )}
          </main>
        </div>

        <footer className='order-print-dialog-footer'>
          <button type='button' className='secondary-button' onClick={onClose}>
            Cancel
          </button>
          <button
            type='button'
            className='secondary-button'
            onClick={() => void openPreviewWindow()}
            disabled={!canPrint}
          >
            Preview
          </button>
          <button
            type='button'
            className='primary-button print-action-button'
            onClick={() => void printSelectedForms()}
            disabled={!canPrint}
          >
            <PrinterIcon />
            Print
          </button>
        </footer>
      </section>
    </div>
  );
};

