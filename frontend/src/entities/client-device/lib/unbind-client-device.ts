import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../model/types';

export type UnbindClientDeviceAction = 'delete' | 'deactivate';

export const getUnbindClientDeviceAction = (
  device: ClientDevice,
): UnbindClientDeviceAction => (device.canRemove ? 'delete' : 'deactivate');

export const buildUnbindClientDevicePayload = (
  device: ClientDevice,
): ClientDeviceFormValues => ({
  clientId: device.clientId,
  clientName: device.clientName,
  clientPhone: device.clientPhone,
  name: device.name,
  serialNumber: '',
  note: device.note,
  source: device.source,
  isActive: false,
  expectedUpdatedAt: device.updatedAt,
});

export const filterActiveClientDevicesForClient = (
  devices: ClientDevice[],
  clientId: string,
) => {
  const uniqueByName = new Map<string, ClientDevice>();

  devices
    .filter((device) => device.clientId === clientId && device.isActive)
    .forEach((device) => {
      const key = device.name.trim().toLowerCase();
      if (!key || uniqueByName.has(key)) return;
      uniqueByName.set(key, device);
    });

  return Array.from(uniqueByName.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
};

export const unbindClientDevice = async (
  device: ClientDevice,
  handlers: {
    onDelete: (deviceId: string) => Promise<boolean>;
    onUpdate: (
      deviceId: string,
      payload: ClientDeviceFormValues,
    ) => Promise<boolean>;
  },
) => {
  if (!device.isActive) {
    return false;
  }

  const action = getUnbindClientDeviceAction(device);
  if (action === 'delete') {
    return handlers.onDelete(device.id);
  }

  return handlers.onUpdate(device.id, buildUnbindClientDevicePayload(device));
};