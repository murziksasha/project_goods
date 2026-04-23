export const getRequestErrorMessage = (
  error: unknown,
  fallback: string,
) => (error instanceof Error ? error.message : fallback);
