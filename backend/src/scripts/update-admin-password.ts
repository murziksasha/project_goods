import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Employee } from '../domain/employee/model';
import { hashPassword } from '../shared/lib/auth';

const run = async () => {
  await connectDatabase();

  const passwordHash = hashPassword('admin');

  const result = await Employee.findOneAndUpdate(
    { username: 'admin' },
    { passwordHash },
    { returnDocument: 'after' },
  );

  if (result) {
    console.log(`Admin user password updated successfully.`);
    console.log(`Username: ${result.username}`);
    console.log(`New password hash: ${passwordHash}`);
  } else {
    console.log(
      'Admin user not found. Use create-temp-admin.ts to create one.',
    );
  }
};

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
