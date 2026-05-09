export type CatalogProduct = {
  id: string;
  name: string;
  note: string;
  isActive: boolean;
  sourceTags: string[];
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CatalogProductFormValues = {
  name: string;
  note: string;
  isActive: boolean;
};
