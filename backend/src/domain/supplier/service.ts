import { formatSupplier } from '../../shared/lib/formatters';
import { normalizeSupplierPayload } from '../../shared/lib/parsers';
import { getSupplierPhonesFromRecord } from '../../shared/lib/supplier-phones';
import {
  getSearchQuery,
  isValidObjectIdOrThrow,
} from '../../shared/lib/query';
import { Supplier, type SupplierDocument } from './model';
import { SupplierOrder } from '../supplier-order/model';
import type { SupplierPayload } from '../shared/types';
import {
  HttpError,
  isDuplicateKeyError,
} from '../../shared/lib/errors';
import { withOptionalMongoSession } from '../../shared/lib/mongo-session';
import { mergeNotes } from '../shared/merge-notes';

const duplicatePhoneMessage =
  'Supplier with this phone already exists.';

const normalizeExceptSupplierIds = (
  exceptSupplierIds?: string | string[],
) => {
  const list = Array.isArray(exceptSupplierIds)
    ? exceptSupplierIds
    : exceptSupplierIds
      ? [exceptSupplierIds]
      : [];

  return list.map((id) => id.trim()).filter(Boolean);
};

const assertUniqueSupplierPhones = async (
  phones: string[],
  exceptSupplierIds?: string | string[],
) => {
  const list = (phones || []).filter(Boolean);
  if (list.length === 0) return;

  const excludedIds = normalizeExceptSupplierIds(exceptSupplierIds);
  const orConditions = [
    { phoneIdentities: { $in: list } },
    { phone: { $in: list } },
  ];
  const query: Record<string, unknown> = { $or: orConditions };
  if (excludedIds.length > 0) {
    query._id = { $nin: excludedIds };
  }

  const existing = await Supplier.findOne(query).lean<Pick<
    SupplierDocument,
    '_id'
  > | null>();
  if (!existing) return;

  throw new HttpError(409, duplicatePhoneMessage);
};

const mapSupplierError = (error: unknown) => {
  if (isDuplicateKeyError(error)) {
    const duplicateField = Object.keys(
      (error as { keyPattern?: Record<string, unknown> })
        .keyPattern ?? {},
    )[0];
    if (
      duplicateField === 'phone' ||
      duplicateField === 'phoneIdentities'
    ) {
      return new Error(duplicatePhoneMessage);
    }
    if (duplicateField === 'name') {
      return new Error('Supplier with this name already exists.');
    }
    return new Error('Supplier with same data already exists.');
  }
  return error;
};

const mergeSupplierPhones = (
  targetSupplier: SupplierDocument,
  sourceSupplier: SupplierDocument,
) => {
  const mergedPhonesRaw = [
    ...getSupplierPhonesFromRecord(targetSupplier),
    ...getSupplierPhonesFromRecord(sourceSupplier),
  ];
  const seen = new Set<string>();
  const mergedPhones = mergedPhonesRaw.filter((phone) => {
    if (!phone || seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });

  return mergedPhones;
};

export const listSuppliers = async (queryValue: unknown) => {
  const searchQuery = getSearchQuery(queryValue);
  const hasQuery =
    typeof queryValue === 'string' && queryValue.trim().length > 0;
  const query = hasQuery
    ? { $and: [searchQuery, { isActive: { $ne: false } }] }
    : searchQuery;
  const suppliers = await Supplier.find(query)
    .sort({ createdAt: -1 })
    .lean<SupplierDocument[]>();
  return suppliers.map(formatSupplier);
};

export const createSupplier = async (payload: SupplierPayload) => {
  try {
    const normalizedPayload = normalizeSupplierPayload(payload);
    await assertUniqueSupplierPhones(
      normalizedPayload.phones || [normalizedPayload.phone],
    );
    const supplier = new Supplier(normalizedPayload);
    await supplier.validate();
    await supplier.save();
    return formatSupplier(supplier.toObject<SupplierDocument>());
  } catch (error) {
    throw mapSupplierError(error);
  }
};

export const updateSupplier = async (
  supplierId: string,
  payload: SupplierPayload,
) => {
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  try {
    const normalizedPayload = normalizeSupplierPayload(payload);
    await assertUniqueSupplierPhones(
      normalizedPayload.phones || [normalizedPayload.phone],
      supplierId,
    );
    const supplier = await Supplier.findByIdAndUpdate(
      supplierId,
      normalizedPayload,
      { returnDocument: 'after', runValidators: true },
    ).lean<SupplierDocument | null>();

    if (!supplier) throw new HttpError(404, 'Supplier not found.');

    return formatSupplier(supplier);
  } catch (error) {
    throw mapSupplierError(error);
  }
};

export const deleteSupplier = async (supplierId: string) => {
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  const deleted = await Supplier.findByIdAndDelete(
    supplierId,
  ).lean<SupplierDocument | null>();
  if (!deleted) throw new HttpError(404, 'Supplier not found.');
  return { id: supplierId };
};

export const mergeSuppliers = async (
  targetSupplierIdInput: unknown,
  sourceSupplierIdInput: unknown,
  draftNoteInput?: unknown,
) => {
  const targetSupplierId =
    typeof targetSupplierIdInput === 'string'
      ? targetSupplierIdInput.trim()
      : '';
  const sourceSupplierId =
    typeof sourceSupplierIdInput === 'string'
      ? sourceSupplierIdInput.trim()
      : '';
  const draftNote =
    typeof draftNoteInput === 'string' ? draftNoteInput.trim() : '';

  if (!targetSupplierId || !sourceSupplierId) {
    throw new HttpError(
      400,
      'Both targetSupplierId and sourceSupplierId are required.',
    );
  }
  if (targetSupplierId === sourceSupplierId) {
    throw new HttpError(400, 'Select two different suppliers.');
  }

  isValidObjectIdOrThrow(targetSupplierId, 'targetSupplierId');
  isValidObjectIdOrThrow(sourceSupplierId, 'sourceSupplierId');

  return withOptionalMongoSession(async (session) => {
    const [targetSupplier, sourceSupplier] = await Promise.all([
      Supplier.findById(targetSupplierId, null, {
        session: session ?? undefined,
      }).lean<SupplierDocument | null>(),
      Supplier.findById(sourceSupplierId, null, {
        session: session ?? undefined,
      }).lean<SupplierDocument | null>(),
    ]);

    if (!targetSupplier)
      throw new HttpError(404, 'Target supplier not found.');
    if (!sourceSupplier)
      throw new HttpError(404, 'Source supplier not found.');

    const mergedNote = mergeNotes(
      targetSupplier.note,
      sourceSupplier.note,
      draftNote,
    );
    const mergedSupplierOrder = [
      targetSupplier.supplierOrder?.trim(),
      sourceSupplier.supplierOrder?.trim(),
    ]
      .filter(Boolean)
      .filter(
        (value, index, collection) =>
          collection.indexOf(value) === index,
      )
      .join('\n');
    const mergedPhones = mergeSupplierPhones(
      targetSupplier,
      sourceSupplier,
    );

    const updatedTarget = await Supplier.findByIdAndUpdate(
      targetSupplierId,
      normalizeSupplierPayload({
        phone:
          mergedPhones[0] ||
          targetSupplier.phone?.trim() ||
          sourceSupplier.phone,
        phones: mergedPhones,
        name: targetSupplier.name?.trim() || sourceSupplier.name,
        note: mergedNote,
        supplierOrder: mergedSupplierOrder,
        isActive: targetSupplier.isActive || sourceSupplier.isActive,
      }),
      {
        session: session ?? undefined,
        returnDocument: 'after',
        runValidators: true,
      },
    ).lean<SupplierDocument | null>();

    if (!updatedTarget)
      throw new HttpError(500, 'Failed to update target supplier.');

    const movedSupplierOrdersResult = await SupplierOrder.updateMany(
      { supplier: sourceSupplier._id },
      {
        $set: {
          supplier: updatedTarget._id,
        },
      },
      { session: session ?? undefined },
    );

    const deletedSource = await Supplier.findByIdAndDelete(
      sourceSupplierId,
      {
        session: session ?? undefined,
      },
    ).lean<SupplierDocument | null>();
    if (!deletedSource)
      throw new HttpError(500, 'Failed to delete source supplier.');

    return {
      supplier: formatSupplier(updatedTarget),
      removedSupplierId: sourceSupplierId,
      movedSupplierOrdersCount:
        movedSupplierOrdersResult.modifiedCount ?? 0,
    };
  });
};
