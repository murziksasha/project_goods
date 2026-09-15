import { initialServiceCatalogForm } from '../../../entities/service-catalog/model/forms';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';

type MissingServiceDecisionInput = {
  kind: 'product' | 'service';
  normalizedName: string;
  selectedServiceId?: string;
  suggestionNames: string[];
};

export const normalizeServiceCatalogName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

export const hasDuplicateServiceName = (
  services: Array<{ id: string; name: string }>,
  name: string,
  exceptId?: string | null,
) => {
  const lookup = normalizeServiceCatalogName(name);
  if (!lookup) return false;
  return services.some(
    (service) =>
      service.id !== exceptId &&
      normalizeServiceCatalogName(service.name) === lookup,
  );
};

export const findExactServiceSuggestion = <T extends { name: string }>(
  services: T[],
  name: string,
): T | undefined => {
  const lookup = normalizeServiceCatalogName(name);
  if (!lookup) return undefined;
  return services.find(
    (service) => normalizeServiceCatalogName(service.name) === lookup,
  );
};

export const resolveOrCreateServiceCatalogItem = async ({
  name,
  lookup,
  create,
}: {
  name: string;
  lookup: (query: string) => Promise<ServiceCatalogItem[]>;
  create: () => Promise<ServiceCatalogItem>;
}): Promise<ServiceCatalogItem> => {
  const existing = findExactServiceSuggestion(await lookup(name), name);
  if (existing) return existing;

  try {
    return await create();
  } catch (error) {
    const retried = findExactServiceSuggestion(await lookup(name), name);
    if (retried) return retried;
    throw error;
  }
};

export const shouldCreateMissingServiceOnSubmit = ({
  kind,
  normalizedName,
  selectedServiceId,
  suggestionNames,
}: MissingServiceDecisionInput) => {
  if (kind !== 'service') return false;
  if (selectedServiceId) return false;
  if (normalizedName.length < 2) return false;

  return !findExactServiceSuggestion(
    suggestionNames.map((suggestionName) => ({ name: suggestionName })),
    normalizedName,
  );
};

export const buildMissingServicePayload = (
  name: string,
  price: number,
): ServiceCatalogFormValues => ({
  ...initialServiceCatalogForm,
  name: name.trim(),
  price: String(price),
});
