import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Sale } from '../domain/sale/model';
import { resetRecordNumberSequence } from '../domain/sequence/service';

const run = async () => {
  await connectDatabase();

  const deletedSales = await Sale.deleteMany({});
  await resetRecordNumberSequence(0);

  console.log(
    `Sales cleanup completed. Deleted: ${deletedSales.deletedCount ?? 0}. Record sequence reset to 0.`,
  );
};

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
