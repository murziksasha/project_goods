import i18n from '../i18n/config';
import type { PrintForm } from '../../entities/settings/model/types';
import {
  printWarehouseSerialLabels,
  type WarehouseSerialPrintItem,
} from '../../widgets/dashboard/ui/orders-workspace-shared';

export type SerialPrintItem = WarehouseSerialPrintItem;

export const printSerialNumbers = (
  items: SerialPrintItem[],
  printForms: PrintForm[],
  title = i18n.t('warehouse.print.serialNumbersTitle'),
) => {
  void printWarehouseSerialLabels(items, printForms, title);
};