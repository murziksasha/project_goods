import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Employee } from '../domain/employee/model';
import { hashPassword } from '../shared/lib/auth';
import { requireAdminPassword } from './admin-password';
import { describeErrorSafely } from '../shared/lib/redact-mongo-credentials';

const run = async () => {
  const password = requireAdminPassword(process.env.PROJECT_GOODS_ADMIN_PASSWORD);
  await connectDatabase();

  const passwordHash = hashPassword(password);

  const result = await Employee.findOneAndUpdate(
    { username: 'admin' },
    { passwordHash },
    { returnDocument: 'after' },
  );

  if (result) {
    console.log(`Admin user password updated successfully.`);
    console.log(`Username: ${result.username}`);
  } else {
    console.log(
      'Admin user not found. Use create-temp-admin.ts to create one.',
    );
  }
};

void run()
  .catch((error) => {
    console.error(describeErrorSafely(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
