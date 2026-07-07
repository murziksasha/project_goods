import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Employee } from './model';
import { Sale } from '../sale/model';
import { WarehouseSettings } from '../warehouse-settings/model';
import { deleteEmployee, purgeEmployeeOperationalLinks } from './service';

const employeeId = '507f1f77bcf86cd799439099';

const existingEmployee = {
  _id: employeeId,
  role: 'manager',
  username: 'manager',
  permissions: ['employees.manage'],
  isActive: true,
};

describe('employee delete cleanup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mongoose, 'isValidObjectId').mockReturnValue(true);
  });

  it('purges employee links from sales and warehouse administrators', async () => {
    const saleUpdateMany = vi
      .spyOn(Sale, 'updateMany')
      .mockResolvedValue({ modifiedCount: 1 } as never);
    const warehouseUpdateOne = vi
      .spyOn(WarehouseSettings, 'updateOne')
      .mockResolvedValue({ modifiedCount: 1 } as never);

    await purgeEmployeeOperationalLinks(employeeId);

    expect(saleUpdateMany).toHaveBeenCalledTimes(3);
    expect(saleUpdateMany).toHaveBeenCalledWith(
      { manager: new mongoose.Types.ObjectId(employeeId) },
      { $set: { manager: null }, $unset: { managerSnapshot: '' } },
    );
    expect(saleUpdateMany).toHaveBeenCalledWith(
      { master: new mongoose.Types.ObjectId(employeeId) },
      { $set: { master: null }, $unset: { masterSnapshot: '' } },
    );
    expect(saleUpdateMany).toHaveBeenCalledWith(
      { issuedBy: new mongoose.Types.ObjectId(employeeId) },
      { $set: { issuedBy: null }, $unset: { issuedBySnapshot: '' } },
    );
    expect(warehouseUpdateOne).toHaveBeenCalledWith(
      {},
      { $pull: { administrators: { employeeId } } },
    );
  });

  it('purges operational links before deleting the employee record', async () => {
    const saleUpdateMany = vi
      .spyOn(Sale, 'updateMany')
      .mockResolvedValue({ modifiedCount: 0 } as never);
    vi.spyOn(WarehouseSettings, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as never);
    vi.spyOn(Employee, 'findById').mockReturnValue({
      lean: vi.fn().mockResolvedValue(existingEmployee),
    } as never);
    vi.spyOn(Employee, 'findByIdAndDelete').mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: employeeId }),
    } as never);

    await deleteEmployee(employeeId, {
      _id: 'owner-id',
      role: 'owner',
      permissions: ['employees.manage'],
    } as never);

    expect(saleUpdateMany).toHaveBeenCalled();
    expect(Employee.findByIdAndDelete).toHaveBeenCalledWith(employeeId);
  });
});