import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { SupplierOrder } from '../supplier-order/model';
import { Supplier } from './model';
import { mergeSuppliers } from './service';

const targetSupplierId = '507f1f77bcf86cd799439099';
const sourceSupplierId = '507f1f77bcf86cd7994390aa';

const createMockSupplier = (
  id: string,
  name: string,
  phone: string,
  phones: string[] = [phone],
  note = '',
  supplierOrder = '',
) => ({
  _id: new mongoose.Types.ObjectId(id),
  name,
  phone,
  phones,
  note,
  supplierOrder,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  vi.spyOn(SupplierOrder, 'updateMany').mockResolvedValue({
    modifiedCount: 2,
  } as never);
});

describe('mergeSuppliers', () => {
  it('rejects invalid or missing IDs', async () => {
    await expect(
      mergeSuppliers('', sourceSupplierId),
    ).rejects.toThrow(
      'Both targetSupplierId and sourceSupplierId are required.',
    );
    await expect(
      mergeSuppliers(targetSupplierId, targetSupplierId),
    ).rejects.toThrow('Select two different suppliers.');
  });

  it('merges suppliers, consolidates draftNote, moves orders, and deletes source', async () => {
    const target = createMockSupplier(
      targetSupplierId,
      'Main Parts LLC',
      '+380501111111',
      ['+380501111111'],
      'Target note',
      'Order instructions A',
    );
    const source = createMockSupplier(
      sourceSupplierId,
      'main parts llc',
      '+380502222222',
      ['+380502222222'],
      'Source note',
      'Order instructions B',
    );

    vi.spyOn(Supplier, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetSupplierId) return leanResult(target);
      if (id === sourceSupplierId) return leanResult(source);
      return leanResult(null);
    }) as never);

    const updateSpy = vi
      .spyOn(Supplier, 'findByIdAndUpdate')
      .mockImplementation(((id: string, update: any) =>
        leanResult({
          ...target,
          ...update,
        })) as never);
    const deleteSpy = vi
      .spyOn(Supplier, 'findByIdAndDelete')
      .mockReturnValue(leanResult(source) as never);

    const result = await mergeSuppliers(
      targetSupplierId,
      sourceSupplierId,
      'Draft note',
    );

    expect(updateSpy).toHaveBeenCalledWith(
      targetSupplierId,
      expect.objectContaining({
        name: 'Main Parts LLC',
        phone: '+380501111111',
        phones: ['+380501111111', '+380502222222'],
        note: 'Target note\nSource note\nDraft note',
        supplierOrder: 'Order instructions A\nOrder instructions B',
      }),
      expect.anything(),
    );

    expect(SupplierOrder.updateMany).toHaveBeenCalledWith(
      { supplier: source._id },
      { $set: { supplier: target._id } },
      expect.anything(),
    );

    expect(deleteSpy).toHaveBeenCalledWith(
      sourceSupplierId,
      expect.anything(),
    );
    expect(result.removedSupplierId).toBe(sourceSupplierId);
    expect(result.movedSupplierOrdersCount).toBe(2);
  });
});
