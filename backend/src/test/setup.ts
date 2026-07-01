import mongoose from 'mongoose';
import { beforeEach } from 'vitest';

// Fail fast when a model mock did not apply and no database is available.
mongoose.set('bufferTimeoutMS', 250);

const resetMongooseModels = () => {
  for (const modelName of Object.keys(mongoose.models)) {
    mongoose.deleteModel(modelName);
  }
};

beforeEach(() => {
  resetMongooseModels();
});