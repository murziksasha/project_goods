import {
  normalizeWarehouseSettingsPayload,
} from '../../shared/lib/parsers';
import { Product } from '../product/model';
import { WarehouseSettings, type WarehouseSettingsDocument } from './model';
import type { WarehouseSettingsPayload } from '../shared/types';
import { HttpError } from '../../shared/lib/errors';

const formatWarehouseSettings = (
  settings: WarehouseSettingsDocument,
) => ({
  id: settings._id.toString(),
  serviceCenters: settings.serviceCenters,
  warehouses: settings.warehouses,
  administrators: settings.administrators,
  createdAt: settings.createdAt.toISOString(),
  updatedAt: settings.updatedAt.toISOString(),
});

export const getWarehouseSettings = async () => {
  let settings =
    await WarehouseSettings.findOne().lean<WarehouseSettingsDocument | null>();
  if (!settings) {
    const created = new WarehouseSettings({
      serviceCenters: [],
      warehouses: [],
      administrators: [],
    });
    await created.validate();
    await created.save();
    settings = created.toObject<WarehouseSettingsDocument>();
  }

  return formatWarehouseSettings(settings);
};

export const updateWarehouseSettings = async (
  payload: WarehouseSettingsPayload,
) => {
  const normalized = normalizeWarehouseSettingsPayload(payload);
  const currentSettings =
    await WarehouseSettings.findOne().lean<WarehouseSettingsDocument | null>();
  const existingWarehouses = currentSettings?.warehouses ?? [];
  const nextWarehouseById = new Map(
    normalized.warehouses.map((warehouse) => [warehouse.id, warehouse]),
  );

  for (const existingWarehouse of existingWarehouses) {
    const nextWarehouse = nextWarehouseById.get(existingWarehouse.id);
    if (!nextWarehouse) continue;

    const nextLocationIds = new Set(
      nextWarehouse.locations.map((location) => location.id),
    );
    const removedLocations = existingWarehouse.locations.filter(
      (location) => !nextLocationIds.has(location.id),
    );

    for (const removedLocation of removedLocations) {
      const hasProducts = await Product.exists({
        warehouseId: existingWarehouse.id,
        locationId: removedLocation.id,
      });
      if (hasProducts) {
        throw new HttpError(
          400,
          `Location "${removedLocation.name}" cannot be deleted while products reference it.`,
        );
      }
    }
  }

  const settings = await WarehouseSettings.findOneAndUpdate(
    {},
    normalized,
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean<WarehouseSettingsDocument | null>();

  if (!settings) {
    throw new HttpError(404, 'Warehouse settings not found.');
  }

  return formatWarehouseSettings(settings);
};
