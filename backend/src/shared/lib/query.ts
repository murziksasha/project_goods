import mongoose from 'mongoose';

export const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getSearchQuery = (rawQuery: unknown) => {
  const query = typeof rawQuery === 'string' ? rawQuery.trim().toLowerCase() : '';

  if (!query) {
    return {};
  }

  return {
    searchText: {
      $regex: escapeRegExp(query),
      $options: 'i',
    },
  };
};

export const isValidObjectIdOrThrow = (value: string, label: string) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`Valid ${label} is required.`);
  }
};
