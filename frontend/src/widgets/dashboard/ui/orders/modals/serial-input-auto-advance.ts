export const shouldAdvanceAfterSerialBulkInput = (
  previousValue: string,
  nextValue: string,
): boolean =>
  nextValue.trim().length > 0 &&
  nextValue.length - previousValue.length > 1;