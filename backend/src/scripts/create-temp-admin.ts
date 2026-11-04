import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { employeePermissions } from '../domain/employee/constants';
import { Employee } from '../domain/employee/model';
import { hashPassword } from '../shared/lib/auth';
import { requireAdminPassword } from './admin-password';
import { describeErrorSafely } from '../shared/lib/redact-mongo-credentials';

const run = async () => {
  const password = requireAdminPassword(process.env.PROJECT_GOODS_ADMIN_PASSWORD);
  await connectDatabase();

  const passwordHash = hashPassword(password);

  await Employee.findOneAndUpdate(
    { username: 'admin' },
    {
      name: 'Temporary Admin',
      phone: '+380000000000',
      email: 'admin@local.test',
      username: 'admin',
      passwordHash,
      authToken: '',
      inviteToken: '',
      inviteExpiresAt: null,
      role: 'owner',
      permissions: [...employeePermissions],
      isActive: true,
      note: 'Temporary test account',
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  console.log('Temporary admin user is ready. Username: admin');
};

void run()
  .catch((error) => {
    console.error(describeErrorSafely(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
