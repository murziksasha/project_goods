import type { WarehouseSettingsPayload } from '../../../domain/shared/types';
import { toNonEmptyString } from './primitives';

export const normalizeWarehouseSettingsPayload = (
  payload: WarehouseSettingsPayload,
) => {
  const serviceCenters = Array.isArray(payload.serviceCenters)
    ? payload.serviceCenters
        .map((item, index) => {
          const source =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {};
          const id =
            toNonEmptyString(source.id) || `sc-${Date.now()}-${index}`;
          const name = toNonEmptyString(source.name);
          if (!name) return null;
          return {
            id,
            name,
            color: toNonEmptyString(source.color) || '#000000',
            address: toNonEmptyString(source.address),
            phone: toNonEmptyString(source.phone),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const warehouses = Array.isArray(payload.warehouses)
    ? payload.warehouses
        .map((item, index) => {
          const source =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {};
          const id =
            toNonEmptyString(source.id) || `w-${Date.now()}-${index}`;
          const name = toNonEmptyString(source.name);
          const serviceCenterId = toNonEmptyString(source.serviceCenterId);
          if (!name || !serviceCenterId) return null;
          const locations = Array.isArray(source.locations)
            ? source.locations
                .map((location, locationIndex) => {
                  const locationSource =
                    location && typeof location === 'object'
                      ? (location as Record<string, unknown>)
                      : {};
                  const locationName = toNonEmptyString(
                    locationSource.name,
                  );
                  if (!locationName) return null;
                  return {
                    id:
                      toNonEmptyString(locationSource.id) ||
                      `l-${Date.now()}-${index}-${locationIndex}`,
                    name: locationName,
                  };
                })
                .filter(
                  (location): location is NonNullable<typeof location> =>
                    Boolean(location),
                )
            : [];

          return {
            id,
            name,
            isActive:
              source.isActive === undefined
                ? true
                : source.isActive === true ||
                  String(source.isActive).toLowerCase() === 'true',
            serviceCenterId,
            receiptAddress: toNonEmptyString(source.receiptAddress),
            receiptPhone: toNonEmptyString(source.receiptPhone),
            locations,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const administrators = Array.isArray(payload.administrators)
    ? payload.administrators
        .map((item) => {
          const source =
            item && typeof item === 'object'
              ? (item as Record<string, unknown>)
              : {};
          const employeeId = toNonEmptyString(source.employeeId);
          if (!employeeId) return null;
          const warehouseIds = Array.isArray(source.warehouseIds)
            ? source.warehouseIds.map(toNonEmptyString).filter(Boolean)
            : [];
          return {
            employeeId,
            warehouseIds,
            defaultWarehouseId: toNonEmptyString(source.defaultWarehouseId),
            defaultLocationId: toNonEmptyString(source.defaultLocationId),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    serviceCenters,
    warehouses,
    administrators,
  };
};
