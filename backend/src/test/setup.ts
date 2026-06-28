import mongoose from 'mongoose';
import { afterAll, beforeAll } from 'vitest';

// Prevent buffered mongoose operations from hanging unit tests when a model mock
// did not apply and no database is available.
beforeAll(() => {
  mongoose.set('bufferTimeoutMS', 100);
});

afterAll(async () => {
  await mongoose.disconnect().catch(() => undefined);
});