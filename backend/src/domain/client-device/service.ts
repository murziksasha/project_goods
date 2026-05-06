import type { ClientDevicePayload } from '../shared/types';
import { formatClientDevice } from '../../shared/lib/formatters';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { ClientDevice, type ClientDeviceDocument } from './model';
import { Sale } from '../sale/model';
import { assertNotStale } from '../../shared/lib/errors';

const normalizeClientDevicePayload = (payload: ClientDevicePayload) => ({
  clientId: toNonEmptyString(payload.clientId),
  clientName: toNonEmptyString(payload.clientName),
  clientPhone: toNonEmptyString(payload.clientPhone),
  name: toNonEmptyString(payload.name).replace(/\s+/g, ' '),
  serialNumber: '',
  note: toNonEmptyString(payload.note),
  source: toNonEmptyString(payload.source) === 'clientCard' ? 'clientCard' : 'repairOrder',
  isActive:
    payload.isActive === undefined
      ? true
      : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
});
const toNameKey = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDeviceUsageCount = async (device: ClientDeviceDocument) => {
  const normalizedName = device.name.trim();
  const normalizedSerial = device.serialNumber.trim();

  const usageQuery: Record<string, unknown> = {
    client: device.client,
  };

  const orConditions: Array<Record<string, unknown>> = [];
  if (normalizedName) {
    orConditions.push({ 'productSnapshot.name': normalizedName });
    orConditions.push({ note: { $regex: escapeRegExp(normalizedName), $options: 'i' } });
  }
  if (normalizedSerial) {
    orConditions.push({ 'productSnapshot.serialNumber': normalizedSerial });
    orConditions.push({ note: { $regex: escapeRegExp(normalizedSerial), $options: 'i' } });
  }

  if (orConditions.length > 0) {
    usageQuery.$or = orConditions;
  }

  return Sale.countDocuments(usageQuery);
};

export const listClientDevices = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const devices = await ClientDevice.find(query).sort({ createdAt: -1 }).lean<ClientDeviceDocument[]>();
  const deduped = new Map<string, ClientDeviceDocument>();
  devices.forEach((device) => {
    const key = `${device.client.toString()}::${toNameKey(device.name)}`;
    if (!deduped.has(key)) {
      deduped.set(key, device);
    }
  });
  const uniqueDevices = Array.from(deduped.values());

  return Promise.all(
    uniqueDevices.map(async (device) => {
      const usageCount = await getDeviceUsageCount(device);
      return formatClientDevice(device, usageCount);
    }),
  );
};

export const createClientDevice = async (payload: ClientDevicePayload) => {
  const normalized = normalizeClientDevicePayload(payload);
  isValidObjectIdOrThrow(normalized.clientId, 'clientId');
  const normalizedNameKey = toNameKey(normalized.name);
  const duplicateByName = await ClientDevice.exists({
    client: normalized.clientId,
    nameKey: normalizedNameKey,
  });
  if (duplicateByName) {
    const existingDevice = await ClientDevice.findOne({
      client: normalized.clientId,
      nameKey: normalizedNameKey,
    }).lean<ClientDeviceDocument | null>();
    if (existingDevice) {
      const usageCount = await getDeviceUsageCount(existingDevice);
      return formatClientDevice(existingDevice, usageCount);
    }
    throw new Error('Device name already exists for this client.');
  }

  const device = new ClientDevice({
    client: normalized.clientId,
    clientName: normalized.clientName,
    clientPhone: normalized.clientPhone,
    name: normalized.name,
    serialNumber: normalized.serialNumber,
    note: normalized.note,
    source: normalized.source,
    isActive: normalized.isActive,
  });

  await device.validate();
  await device.save();

  return formatClientDevice(device.toObject<ClientDeviceDocument>(), 0);
};

export const updateClientDevice = async (deviceId: string, payload: ClientDevicePayload) => {
  isValidObjectIdOrThrow(deviceId, 'deviceId');
  const normalized = normalizeClientDevicePayload(payload);
  isValidObjectIdOrThrow(normalized.clientId, 'clientId');
  const normalizedNameKey = toNameKey(normalized.name);
  const existingDevice = await ClientDevice.findById(deviceId).lean<ClientDeviceDocument | null>();
  if (!existingDevice) throw new Error('Client device not found.');
  assertNotStale(payload.expectedUpdatedAt, existingDevice.updatedAt, 'Client device');
  const duplicateByName = await ClientDevice.exists({
    _id: { $ne: deviceId },
    client: normalized.clientId,
    nameKey: normalizedNameKey,
  });
  if (duplicateByName) {
    throw new Error('Device name already exists for this client.');
  }

  const device = await ClientDevice.findByIdAndUpdate(
    deviceId,
    {
      client: normalized.clientId,
      clientName: normalized.clientName,
      clientPhone: normalized.clientPhone,
      name: normalized.name,
      serialNumber: normalized.serialNumber,
      note: normalized.note,
      source: normalized.source,
      isActive: normalized.isActive,
    },
    { new: true, runValidators: true },
  ).lean<ClientDeviceDocument | null>();

  if (!device) throw new Error('Client device not found.');
  const usageCount = await getDeviceUsageCount(device);
  return formatClientDevice(device, usageCount);
};

export const deleteClientDevice = async (deviceId: string) => {
  isValidObjectIdOrThrow(deviceId, 'deviceId');
  const existing = await ClientDevice.findById(deviceId).lean<ClientDeviceDocument | null>();
  if (!existing) throw new Error('Client device not found.');

  const usageCount = await getDeviceUsageCount(existing);
  if (usageCount > 0) {
    throw new Error('This device is used in orders or sales and cannot be removed.');
  }

  const deleted = await ClientDevice.findByIdAndDelete(deviceId).lean<ClientDeviceDocument | null>();
  if (!deleted) throw new Error('Client device not found.');
  return { id: deviceId };
};
