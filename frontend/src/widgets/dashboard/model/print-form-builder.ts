import type { PrintForm } from '../../../entities/settings/model/types';
import {
  createLayoutPrintForm,
  defaultLabelSize,
} from '../../../entities/settings/model/printForms';
import i18n from '../../../shared/i18n/config';

export const createNewPrintForm = (sortOrder: number): PrintForm =>
  createLayoutPrintForm({
    id: `form-${Date.now()}`,
    title: i18n.t('settings.print.newTemplate'),
    type: 'custom',
    content: '',
    contentFormat: 'html',
    pageSize: 'A4',
    labelSize: defaultLabelSize,
    orientation: 'portrait',
    isActive: true,
    sortOrder,
  });
