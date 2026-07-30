export type SavedFilterScope =
  | 'orders'
  | 'warehouse'
  | 'clients'
  | 'catalog';

export type SavedFilterRecord<TFilters = Record<string, unknown>> = {
  id: string;
  employeeId: string;
  scope: SavedFilterScope;
  tab: string;
  name: string;
  icon: string;
  filters: TFilters;
  createdAt: string;
  updatedAt?: string;
};

export type CreateSavedFilterPayload<TFilters = Record<string, unknown>> = {
  scope: SavedFilterScope;
  tab: string;
  name: string;
  icon: string;
  filters: TFilters;
};
