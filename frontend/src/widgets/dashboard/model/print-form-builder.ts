import type { PrintForm } from '../../../entities/settings/model/types';
import {
  createLayoutPrintForm,
  defaultLabelSize,
} from '../../../entities/settings/model/printForms';

export const createNewPrintForm = (sortOrder: number): PrintForm =>
  createLayoutPrintForm({
    id: `form-${Date.now()}`,
    title: 'New template',
    type: 'custom',
    content: '',
    contentFormat: 'html',
    pageSize: 'A4',
    labelSize: defaultLabelSize,
    orientation: 'portrait',
    isActive: true,
    sortOrder,
  });
