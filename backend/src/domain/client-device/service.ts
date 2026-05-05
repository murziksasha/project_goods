import type { ClientDevicePayload } from '../shared/types';
import { formatClientDevice } from '../../shared/lib/formatters';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { ClientDevice, type ClientDeviceDocument } from './model';

const normalizeClientDevicePayload = (payload: ClientDevicePayload) => ({
  clientId: toNonEmptyString(payload.clientId),
  clientName: toNonEmptyString(payload.clientName),
  clientPhone: toNonEmptyString(payload.clientPhone),
  name: toNonEmptyString(payload.name),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  note: toNonEmptyString(payload.note),
  source: toNonEmptyString(payload.source) === 'clientCard' ? 'clientCard' : 'repairOrder',
  isActive:
    payload.isActive === undefined
      ? true
      : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
});

export const listClientDevices = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const devices = await ClientDevice.find(query)
    .sort({ createdAt: -1 })
    .lean<ClientDeviceDocument[]>();
  return devices.map(formatClientDevice);
};

export const createClientDevice = async (payload: ClientDevicePayload) => {
  const normalized = normalizeClientDevicePayload(payload);
  isValidObjectIdOrThrow(normalized.clientId, 'clientId');

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

  return formatClientDevice(device.toObject<ClientDeviceDocument>());
};

export const updateClientDevice = async (deviceId: string, payload: ClientDevicePayload) => {
  isValidObjectIdOrThrow(deviceId, 'deviceId');
  const normalized = normalizeClientDevicePayload(payload);
  isValidObjectIdOrThrow(normalized.clientId, 'clientId');

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
  return formatClientDevice(device);
};

export const deleteClientDevice = async (deviceId: string) => {
  isValidObjectIdOrThrow(deviceId, 'deviceId');
  const deleted = await ClientDevice.findByIdAndDelete(deviceId).lean<ClientDeviceDocument | null>();
  if (!deleted) throw new Error('Client device not found.');
  return { id: deviceId };
};
