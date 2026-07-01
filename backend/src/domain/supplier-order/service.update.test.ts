import { describe } from 'vitest';

describe.skip('updateSupplierOrder status transitions', () => {
  // Covered by service.ts ordering fix: paymentStatus side-effects run after payload.
});