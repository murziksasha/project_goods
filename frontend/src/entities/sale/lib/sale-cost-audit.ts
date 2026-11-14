import type { SaleLineItem } from '../../../shared/types/domain';

type AuditEligibleLineLike = Pick<
  SaleLineItem,
  | 'kind'
  | 'productId'
  | 'unitCostOverride'
  | 'costMethod'
  | 'fixedCost'
  | 'hourlyCost'
  | 'recordedMinutes'
  | 'requiresCostAudit'
  | 'costSnapshot'
  | 'auditedCost'
  | 'costAuditLog'
>;

export const hasKnownServiceCostFields = (
  item: Pick<
    AuditEligibleLineLike,
    'unitCostOverride' | 'costMethod' | 'fixedCost' | 'hourlyCost' | 'recordedMinutes'
  >,
): boolean => {
  if (
    item.unitCostOverride !== undefined &&
    item.unitCostOverride !== null &&
    Number.isFinite(Number(item.unitCostOverride))
  ) {
    return true;
  }
  if (item.costMethod === 'time_rate') {
    return (
      item.hourlyCost !== undefined &&
      item.hourlyCost !== null &&
      Number.isFinite(Number(item.hourlyCost)) &&
      item.recordedMinutes !== undefined &&
      item.recordedMinutes !== null &&
      Number.isFinite(Number(item.recordedMinutes))
    );
  }
  return (
    item.fixedCost !== undefined &&
    item.fixedCost !== null &&
    Number.isFinite(Number(item.fixedCost))
  );
};

export const isLineItemEligibleForCostAudit = (
  item: AuditEligibleLineLike,
  options: { serviceAuditEnabled?: boolean } = {},
): boolean => {
  if (item.kind === 'service') {
    if (!options.serviceAuditEnabled) return false;
    if (typeof item.requiresCostAudit === 'boolean') {
      return item.requiresCostAudit;
    }
    if (Array.isArray(item.costAuditLog) && item.costAuditLog.length > 0) {
      return true;
    }
    if (
      item.costSnapshot?.status === 'unknown' ||
      item.auditedCost?.status === 'unknown'
    ) {
      return true;
    }
    if (
      item.costSnapshot?.status === 'known' ||
      item.auditedCost?.status === 'known'
    ) {
      return false;
    }
    return !hasKnownServiceCostFields(item);
  }

  if (item.kind !== 'product') return false;
  if (typeof item.requiresCostAudit === 'boolean') {
    return item.requiresCostAudit;
  }
  if (Array.isArray(item.costAuditLog) && item.costAuditLog.length > 0) {
    return true;
  }
  if (
    item.costSnapshot?.status === 'unknown' ||
    item.auditedCost?.status === 'unknown'
  ) {
    return true;
  }
  if (
    item.costSnapshot?.status === 'known' ||
    item.auditedCost?.status === 'known'
  ) {
    return false;
  }
  return (
    !item.productId &&
    (item.unitCostOverride === undefined || item.unitCostOverride === null)
  );
};
