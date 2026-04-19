import mongoose from 'mongoose';

export const isDuplicateKeyError = (
  error: unknown,
): error is { code: number; keyPattern?: Record<string, number> } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 11000;

export const getErrorMessage = (error: unknown) => {
  if (error instanceof mongoose.Error.ValidationError) {
    return Object.values(error.errors)
      .map((validationError) => validationError.message)
      .join(', ');
  }

  if (isDuplicateKeyError(error)) {
    if (error.keyPattern?.article) {
      return 'Product article must be unique.';
    }

    if (error.keyPattern?.serialNumber) {
      return 'Product serial number must be unique.';
    }

    if (error.keyPattern?.phone) {
      return 'Client phone must be unique.';
    }

    return 'Duplicate value detected.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected server error';
};
