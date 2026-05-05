/**
 * Formats a Ukrainian phone number from a raw format to a readable format
 * Example: +380552145211 -> 055 214 52 11
 */
export const formatUkrainianPhone = (phone: string): string => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Ukrainian phone number format: +380XX XXX XX XX
  // After +380, we need 9 digits total
  if (digits.length < 12) {
    return phone; // Return original if not enough digits
  }

  // Extract the last 9 digits (after +380)
  const last9Digits = digits.slice(-9);

  // Format as: XX XXX XX XX
  const formatted = last9Digits.replace(
    /(\d{2})(\d{3})(\d{2})(\d{2})/,
    '$1 $2 $3 $4',
  );

  return formatted;
};

/**
 * Validates a Ukrainian phone number
 * @returns true if the phone number is valid, false otherwise
 */
export const isValidUkrainianPhone = (phone: string): boolean => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Ukrainian phone number validation:
  // - 10 digits (without country code, e.g., 0635567090)
  // - 12 digits (with country code 380, e.g., 380635567090 or +380635567090)
  // Ukrainian phone number validation:
  // - 10 digits starting with '0' (without country code, e.g., 0635567090)
  // - 11 digits starting with '8' (e.g., 80635567090) - local code
  // - 12 digits starting with '380' (with country code, e.g., 380635567090 or +380635567090)
  if (digits.length === 10 && digits.startsWith('0')) {
    return true;
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    return true;
  }

  if (digits.length === 12 && digits.startsWith('380')) {
    return true;
  }

  return false;
};

/**
 * Normalizes a phone number by removing all non-digit characters
 */
export const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};
