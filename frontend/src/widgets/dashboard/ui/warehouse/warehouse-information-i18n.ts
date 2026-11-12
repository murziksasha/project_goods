import type { TFunction } from 'i18next';
import type { WarehouseAgeBucketKey } from '../../../../entities/analytics';

export type WarehouseWarningItem = {
  code: string;
  count?: number;
  units?: number;
};

export const AGE_BUCKET_KEYS: WarehouseAgeBucketKey[] = [
  '0-30',
  '31-60',
  '61-90',
  '90+',
  'unknown',
];

export const translateAgeBucket = (
  t: TFunction,
  bucket: WarehouseAgeBucketKey,
): string => t(`warehouse.information.aging.${bucket}`);

export const translateStockState = (
  t: TFunction,
  state: string,
  variant: 'filter' | 'label' = 'label',
): string => {
  if (variant === 'filter') {
    return t(`warehouse.information.stockStates.${state}`, {
      defaultValue: state,
    });
  }
  return t(`warehouse.information.stockStateLabels.${state}`, {
    defaultValue: state,
  });
};

export const translateDemandPattern = (t: TFunction, pattern: string): string =>
  t(`warehouse.information.demandPatterns.${pattern}`, {
    defaultValue: pattern,
  });

export const translateAssignedName = (t: TFunction, name: string): string => {
  if (name === 'Unassigned warehouse') {
    return t('warehouse.information.unassignedWarehouse');
  }
  if (name === 'Unassigned location') {
    return t('warehouse.information.unassignedLocation');
  }
  if (name === 'Unassigned supplier') {
    return t('warehouse.information.unassignedSupplier');
  }
  return name;
};

export const translateLocationLabel = (
  t: TFunction,
  warehouseName: string,
  locationName: string,
): string =>
  t('warehouse.information.cells.warehouseLocation', {
    warehouse: translateAssignedName(t, warehouseName),
    location: translateAssignedName(t, locationName),
  });

const KNOWN_WARNING_PATTERNS: Array<{
  regex: RegExp;
  code: string;
  countFrom?: number;
  unitsFrom?: number;
}> = [
  {
    regex:
      /^Cold yearly archive purges exist; trailing demand only reflects live persisted sales\.$/,
    code: 'coldArchiveDemand',
  },
  {
    regex:
      /^Only (\d+) day\(s\) of live sales history available in the 90-day observation window\.$/,
    code: 'shortSalesHistory',
    countFrom: 1,
  },
  {
    regex:
      /^(\d+) on-hand record\(s\) \((\d+) unit\(s\)\) have no purchase date \(Unknown age\)\.$/,
    code: 'unknownAgeOnHand',
    countFrom: 1,
    unitsFrom: 2,
  },
];

const translateWarningByCode = (
  t: TFunction,
  code: string,
  count?: number,
  units?: number,
): string => t(`warehouse.information.warnings.${code}`, { count, units });

const translateWarningFallback = (t: TFunction, warning: string): string => {
  for (const pattern of KNOWN_WARNING_PATTERNS) {
    const match = warning.match(pattern.regex);
    if (match) {
      const count =
        pattern.countFrom !== undefined
          ? Number(match[pattern.countFrom])
          : undefined;
      const units =
        pattern.unitsFrom !== undefined
          ? Number(match[pattern.unitsFrom])
          : undefined;
      return translateWarningByCode(t, pattern.code, count, units);
    }
  }
  return warning;
};

export const translateCoverageWarnings = (
  t: TFunction,
  warnings: string[],
  warningItems?: WarehouseWarningItem[],
): string[] => {
  if (warningItems && warningItems.length > 0) {
    return warningItems.map((item) =>
      translateWarningByCode(t, item.code, item.count, item.units),
    );
  }
  return warnings.map((warning) => translateWarningFallback(t, warning));
};
