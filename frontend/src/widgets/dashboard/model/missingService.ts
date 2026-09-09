import { initialServiceCatalogForm } from '../../../entities/service-catalog/model/forms';
import type { ServiceCatalogFormValues } from '../../../entities/service-catalog/model/types';

type MissingServiceDecisionInput = {
  kind: 'product' | 'service';
  normalizedName: string;
  selectedServiceId?: string;
  suggestionNames: string[];
};

export const findExactServiceSuggestion = <T extends { name: string }>(
  services: T[],
  name: string,
): T | undefined => {
  const lookup = name.trim().toLowerCase();
  if (!lookup) return undefined;
  return services.find(
    (service) => service.name.trim().toLowerCase() === lookup,
  );
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
