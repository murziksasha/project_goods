import {
  normalizeWarehouseSettingsPayload,
} from '../../shared/lib/parsers';
import { WarehouseSettings, type WarehouseSettingsDocument } from './model';
import type { WarehouseSettingsPayload } from '../shared/types';

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
    throw new Error('Warehouse settings not found.');
  }

  return formatWarehouseSettings(settings);
};
