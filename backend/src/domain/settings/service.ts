import { Settings, type SettingsDocument } from './model';
import { normalizeSettingsPayload } from '../../shared/lib/parsers';
import type { SettingsPayload } from '../shared/types';

const formatSettings = (settings: SettingsDocument) => ({
  id: settings._id.toString(),
  serviceName: settings.serviceName,
  createdAt: settings.createdAt.toISOString(),
  updatedAt: settings.updatedAt.toISOString(),
});

export const getSettings = async () => {
  let settings = await Settings.findOne().lean<SettingsDocument | null>();
  if (!settings) {
    const created = new Settings({ serviceName: 'Service CRM' });
    await created.validate();
    await created.save();
    settings = created.toObject<SettingsDocument>();
  }

  return formatSettings(settings);
};

export const updateSettings = async (payload: SettingsPayload) => {
  const normalized = normalizeSettingsPayload(payload);
  const settings = await Settings.findOneAndUpdate({}, normalized, {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  }).lean<SettingsDocument | null>();

  if (!settings) {
    throw new Error('Settings not found.');
  }

  return formatSettings(settings);
};
