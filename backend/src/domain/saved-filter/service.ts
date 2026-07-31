import mongoose from 'mongoose';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';
import {
  SavedFilter,
  savedFilterScopes,
  type SavedFilterDocument,
  type SavedFilterScope,
} from './model';

export type SavedFilterPayload = {
  scope?: unknown;
  tab?: unknown;
  name?: unknown;
  icon?: unknown;
  filters?: unknown;
};

const formatSavedFilter = (doc: SavedFilterDocument) => ({
  id: doc._id.toString(),
  employeeId: doc.employeeId.toString(),
  scope: doc.scope as SavedFilterScope,
  tab: doc.tab,
  name: doc.name,
  icon: doc.icon,
  filters: (doc.filters ?? {}) as Record<string, unknown>,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
});

const parseScope = (value: unknown): SavedFilterScope => {
  const scope = toNonEmptyString(value);
  if (!savedFilterScopes.includes(scope as SavedFilterScope)) {
    throw new HttpError(
      400,
      `Invalid filter scope. Allowed: ${savedFilterScopes.join(', ')}.`,
    );
  }
  return scope as SavedFilterScope;
};

const normalizeCreatePayload = (payload: SavedFilterPayload) => {
  const scope = parseScope(payload.scope);
  const tab = toNonEmptyString(payload.tab);
  const name = toNonEmptyString(payload.name);
  const icon = toNonEmptyString(payload.icon) || '?';
  if (!tab) {
    throw new HttpError(400, 'Filter tab is required.');
  }
  if (!name) {
    throw new HttpError(400, 'Filter name is required.');
  }
  if (
    payload.filters === null ||
    payload.filters === undefined ||
    typeof payload.filters !== 'object' ||
    Array.isArray(payload.filters)
  ) {
    throw new HttpError(400, 'Filter payload must be an object.');
  }
  return {
    scope,
    tab: tab.slice(0, 80),
    name: name.slice(0, 80),
    icon: icon.slice(0, 16),
    filters: payload.filters as Record<string, unknown>,
  };
};

export const listSavedFilters = async (
  employeeId: string,
  scopeValue: unknown,
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  const scope = parseScope(scopeValue);
  const rows = await SavedFilter.find({
    employeeId: new mongoose.Types.ObjectId(employeeId),
    scope,
  })
    .sort({ createdAt: -1 })
    .lean<SavedFilterDocument[]>();

  return rows.map(formatSavedFilter);
};

export const createSavedFilter = async (
  employeeId: string,
  payload: SavedFilterPayload,
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  const data = normalizeCreatePayload(payload);
  const created = await SavedFilter.create({
    employeeId: new mongoose.Types.ObjectId(employeeId),
    ...data,
  });
  return formatSavedFilter(created.toObject() as SavedFilterDocument);
};

export const deleteSavedFilter = async (
  employeeId: string,
  filterId: string,
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  isValidObjectIdOrThrow(filterId, 'filterId');
  const existing = await SavedFilter.findById(filterId).lean<SavedFilterDocument | null>();
  if (!existing) {
    throw new HttpError(404, 'Saved filter not found.');
  }
  if (existing.employeeId.toString() !== employeeId) {
    throw new HttpError(403, 'You can only delete your own saved filters.');
  }
  await SavedFilter.deleteOne({ _id: filterId });
  return { id: filterId, deleted: true as const };
};
