import {
  normalizeContentMargins,
  normalizeLabelSize,
  normalizePrintFormsForView,
} from '../../../entities/settings/model/printForms';
import type { PrintForm } from '../../../entities/settings/model/types';

export type PrintFormLayoutOverride = Partial<
  Pick<
    PrintForm,
    'contentMargins' | 'pageSize' | 'labelSize' | 'orientation'
  >
>;

export type StoredPrintFormOverrides = Record<string, PrintFormLayoutOverride>;

export const printFormOverridesStorageKeyPrefix =
  'project-goods.print-form-overrides';

export const getPrintFormOverridesStorageKey = (employeeId: string) =>
  `${printFormOverridesStorageKeyPrefix}.${employeeId}`;

const layoutOverrideKeys = new Set([
  'contentMargins',
  'pageSize',
  'labelSize',
  'orientation',
]);

export const isPrintFormLayoutPatch = (
  patch: Partial<PrintForm>,
): patch is PrintFormLayoutOverride =>
  Object.keys(patch).some((key) =>
    layoutOverrideKeys.has(key as keyof PrintFormLayoutOverride),
  );

export const getStoredPrintFormOverrides = (
  employeeId: string | null | undefined,
): StoredPrintFormOverrides => {
  if (!employeeId) return {};

  try {
    const raw = window.localStorage.getItem(
      getPrintFormOverridesStorageKey(employeeId),
    );
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredPrintFormOverrides;
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([formId, override]) =>
          Boolean(formId) &&
          override &&
          typeof override === 'object' &&
          isPrintFormLayoutPatch(override),
      ),
    );
  } catch {
    return {};
  }
};

export const storePrintFormOverrides = (
  employeeId: string | null | undefined,
  overrides: StoredPrintFormOverrides,
) => {
  if (!employeeId) return;

  try {
    window.localStorage.setItem(
      getPrintFormOverridesStorageKey(employeeId),
      JSON.stringify(overrides),
    );
  } catch {
    // Ignore localStorage write errors.
  }
};

export const patchPrintFormOverride = (
  employeeId: string | null | undefined,
  formId: string,
  patch: PrintFormLayoutOverride,
) => {
  if (!employeeId || !isPrintFormLayoutPatch(patch)) return;

  const overrides = getStoredPrintFormOverrides(employeeId);
  storePrintFormOverrides(employeeId, {
    ...overrides,
    [formId]: {
      ...overrides[formId],
      ...patch,
    },
  });
};

const mergeLayoutOverride = (
  form: PrintForm,
  override?: PrintFormLayoutOverride,
): PrintForm => {
  if (!override) return form;

  const pageSize = override.pageSize ?? form.pageSize;
  const merged: PrintForm = {
    ...form,
    ...override,
    pageSize,
    orientation: override.orientation ?? form.orientation,
    labelSize:
      pageSize === 'label'
        ? normalizeLabelSize(override.labelSize ?? form.labelSize)
        : override.labelSize ?? form.labelSize,
    contentMargins: normalizeContentMargins(
      override.contentMargins ?? form.contentMargins,
      pageSize,
    ),
  };

  return merged;
};

export const applyPrintFormLocalOverrides = (
  forms: PrintForm[],
  employeeId: string | null | undefined,
): PrintForm[] => {
  const normalized = normalizePrintFormsForView(forms);
  if (!employeeId) return normalized;

  const overrides = getStoredPrintFormOverrides(employeeId);
  if (Object.keys(overrides).length === 0) return normalized;

  return normalized.map((form) =>
    mergeLayoutOverride(form, overrides[form.id]),
  );
};

export const collectPrintFormLayoutOverrides = (
  forms: PrintForm[],
): StoredPrintFormOverrides => {
  const normalized = normalizePrintFormsForView(forms);

  return Object.fromEntries(
    normalized.map((form) => [
      form.id,
      {
        contentMargins: normalizeContentMargins(
          form.contentMargins,
          form.pageSize,
        ),
        pageSize: form.pageSize,
        ...(form.pageSize === 'label'
          ? { labelSize: normalizeLabelSize(form.labelSize) }
          : {}),
        orientation: form.orientation,
      },
    ]),
  );
};

export const persistPrintFormLayoutOverrides = (
  employeeId: string | null | undefined,
  forms: PrintForm[],
) => {
  if (!employeeId) return;
  storePrintFormOverrides(employeeId, collectPrintFormLayoutOverrides(forms));
};

export const extractPrintFormLayoutOverride = (
  patch: Partial<PrintForm>,
): PrintFormLayoutOverride | null => {
  if (!isPrintFormLayoutPatch(patch)) return null;

  const override: PrintFormLayoutOverride = {};
  if (patch.contentMargins) {
    override.contentMargins = patch.contentMargins;
  }
  if (patch.pageSize) {
    override.pageSize = patch.pageSize;
  }
  if (patch.labelSize) {
    override.labelSize = patch.labelSize;
  }
  if (patch.orientation) {
    override.orientation = patch.orientation;
  }

  return Object.keys(override).length > 0 ? override : null;
};