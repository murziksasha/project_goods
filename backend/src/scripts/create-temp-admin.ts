import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Employee } from '../domain/employee/model';
import { hashPassword } from '../shared/lib/auth';

const run = async () => {
  await connectDatabase();

  const passwordHash = hashPassword('admin');

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
      permissions: [
        'orders.view',
        'orders.manage',
        'repairs.execute',
        'sales.manage',
        'clients.manage',
        'inventory.manage',
        'employees.manage',
      ],
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

  console.log('Temporary admin user is ready. Login: admin / Password: admin');
};

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
