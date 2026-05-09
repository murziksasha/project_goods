import { initialServiceCatalogForm } from '../../../entities/service-catalog/model/forms';
import type { ServiceCatalogFormValues } from '../../../entities/service-catalog/model/types';

type MissingServiceDecisionInput = {
  kind: 'product' | 'service';
  normalizedName: string;
  selectedServiceId?: string;
  suggestionNames: string[];
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

  const normalizedLookup = normalizedName.toLowerCase();
  const hasExactSuggestion = suggestionNames.some(
    (suggestionName) => suggestionName.trim().toLowerCase() === normalizedLookup,
  );

  return !hasExactSuggestion;
};

export const buildMissingServicePayload = (
  name: string,
  price: number,
): ServiceCatalogFormValues => ({
  ...initialServiceCatalogForm,
  name: name.trim(),
  price: String(price),
});
