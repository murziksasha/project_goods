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

const normalizeDeviceName = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildSnapshotNamePattern = (name: string) =>
  `^${escapeRegExp(normalizeDeviceName(name)).replace(/\s+/g, '\\s+')}$`;

const buildLineItemNamePattern = (name: string) =>
  `^${escapeRegExp(normalizeDeviceName(name)).replace(/\s+/g, '\\s+')}(?:\\s*\\(.*\\))?$`;

const matchesSnapshotDeviceName = (snapshotName: string, previousName: string) =>
  new RegExp(buildSnapshotNamePattern(previousName), 'i').test(
    normalizeDeviceName(snapshotName),
  );

const matchesLineItemDeviceName = (lineItemName: string, previousName: string) =>
  new RegExp(buildLineItemNamePattern(previousName), 'i').test(lineItemName);

const buildLinkedRepairSalesQuery = (
  clientId: ClientDeviceDocument['client'],
  previousName: string,
  previousSerial: string,
  options: { includeName: boolean; includeSerial: boolean },
) => {
  const orConditions: Array<Record<string, unknown>> = [];

  if (options.includeName && previousName) {
    orConditions.push({
      'productSnapshot.name': {
        $regex: buildSnapshotNamePattern(previousName),
        $options: 'i',
      },
    });
    orConditions.push({
      'lineItems.name': {
        $regex: buildLineItemNamePattern(previousName),
        $options: 'i',
      },
    });
  }
  if (options.includeSerial && previousSerial) {
    orConditions.push({ 'productSnapshot.serialNumber': previousSerial });
  }

  if (orConditions.length === 0) {
    return null;
  }

  return {
    client: clientId,
    kind: 'repair',
    $or: orConditions,
  };
};

const propagateDeviceChangesToRepairSales = async (
  existingDevice: ClientDeviceDocument,
  updatedDevice: ClientDeviceDocument,
) => {
  const previousName = normalizeDeviceName(existingDevice.name);
  const nextName = normalizeDeviceName(updatedDevice.name);
  const previousSerial = existingDevice.serialNumber.trim();
  const nextSerial = updatedDevice.serialNumber.trim();
  const nameChanged = previousName !== nextName;
  const serialChanged = previousSerial !== nextSerial;

  if (!nameChanged && !serialChanged) {
    return;
  }

  const clientId = updatedDevice.client ?? existingDevice.client;
  if (!clientId) {
    return;
  }

  const salesQuery = buildLinkedRepairSalesQuery(clientId, previousName, previousSerial, {
    includeName: nameChanged,
    includeSerial: serialChanged,
  });
  if (!salesQuery) {
    return;
  }

  const linkedSales = await Sale.find(salesQuery).lean();

  await Promise.all(
    linkedSales.map(async (sale) => {
      const snapshotName = sale.productSnapshot?.name ?? '';
      const snapshotSerial = sale.productSnapshot?.serialNumber ?? '';
      const nextSnapshotName =
        nameChanged &&
        previousName &&
        matchesSnapshotDeviceName(snapshotName, previousName)
          ? nextName
          : snapshotName;
      const nextSnapshotSerial =
        serialChanged && previousSerial && snapshotSerial === previousSerial
          ? nextSerial
          : snapshotSerial;
      const nextLineItems = (sale.lineItems ?? []).map((item) => {
        if (item.kind !== 'product') {
          return item;
        }
        if (
          !nameChanged ||
          !previousName ||
          !matchesLineItemDeviceName(item.name, previousName)
        ) {
          return item;
        }
        return {
          ...item,
          name: nextName,
        };
      });

      await Sale.findByIdAndUpdate(sale._id, {
        productSnapshot: {
          article: sale.productSnapshot?.article ?? '',
          name: nextSnapshotName,
          serialNumber: nextSnapshotSerial,
        },
        lineItems: nextLineItems,
      });
    }),
  );
};

type SaleDeviceUsageFields = {
  client?: { toString: () => string } | string | null;
  productSnapshot?: { name?: string | null; serialNumber?: string | null } | null;
  lineItems?: Array<{ name?: string | null }> | null;
  note?: string | null;
};

const loadSalesForDeviceUsage = () =>
  Sale.find({}, { client: 1, productSnapshot: 1, lineItems: 1, note: 1 }).lean<
    SaleDeviceUsageFields[]
  >();

const countDeviceUsageInSales = (
  device: ClientDeviceDocument,
  sales: SaleDeviceUsageFields[],
) => {
  const normalizedName = device.name.trim().replace(/\s+/g, ' ');
  const normalizedSerial = device.serialNumber.trim();
  const clientId = device.client?.toString() ?? '';

  const namePattern = normalizedName
    ? escapeRegExp(normalizedName).replace(/\s+/g, '\\s+')
    : '';
  const snapshotRe = namePattern ? new RegExp(`^${namePattern}$`, 'i') : null;
  const lineItemRe = namePattern
    ? new RegExp(`^${namePattern}(?:\\s*\\(.*\\))?$`, 'i')
    : null;
  const nameNoteRe = namePattern ? new RegExp(escapeRegExp(normalizedName), 'i') : null;
  const serialNoteRe = normalizedSerial
    ? new RegExp(escapeRegExp(normalizedSerial), 'i')
    : null;

  return sales.reduce((count, sale) => {
    if ((sale.client?.toString() ?? '') !== clientId) {
      return count;
    }

    const snapshotName = String(sale.productSnapshot?.name ?? '');
    const snapshotSerial = String(sale.productSnapshot?.serialNumber ?? '');
    const note = String(sale.note ?? '');

    if (snapshotRe?.test(snapshotName)) return count + 1;
    if ((sale.lineItems ?? []).some((line) => lineItemRe?.test(String(line.name ?? '')))) {
      return count + 1;
    }
    if (nameNoteRe?.test(note)) return count + 1;
    if (normalizedSerial && snapshotSerial === normalizedSerial) return count + 1;
    if (serialNoteRe?.test(note)) return count + 1;
    return count;
  }, 0);
};

const getDeviceUsageCount = async (device: ClientDeviceDocument) => {
  const sales = await loadSalesForDeviceUsage();
  return countDeviceUsageInSales(device, sales);
};

export const listClientDevices = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const [devices, sales] = await Promise.all([
    ClientDevice.find(query).sort({ createdAt: -1 }).lean<ClientDeviceDocument[]>(),
    loadSalesForDeviceUsage(),
  ]);
  const deduped = new Map<string, ClientDeviceDocument>();
  devices.forEach((device) => {
    const clientKey = device.client ? device.client.toString() : 'no-client';
    const key = `${clientKey}::${toNameKey(device.name)}`;
    if (!deduped.has(key)) {
      deduped.set(key, device);
    }
  });
  const uniqueDevices = Array.from(deduped.values());

  return uniqueDevices.map((device) =>
    formatClientDevice(device, countDeviceUsageInSales(device, sales)),
  );
};

export const createClientDevice = async (payload: ClientDevicePayload) => {
  const normalized = normalizeClientDevicePayload(payload);
  const normalizedClientId = normalized.clientId || null;
  if (normalizedClientId) {
    isValidObjectIdOrThrow(normalizedClientId, 'clientId');
  }
  const normalizedNameKey = toNameKey(normalized.name);
  const duplicateByName = await ClientDevice.exists({
    client: normalizedClientId,
    nameKey: normalizedNameKey,
  });
  if (duplicateByName) {
    const existingDevice = await ClientDevice.findOne({
      client: normalizedClientId,
      nameKey: normalizedNameKey,
    }).lean<ClientDeviceDocument | null>();
    if (existingDevice) {
      const usageCount = await getDeviceUsageCount(existingDevice);
      return formatClientDevice(existingDevice, usageCount);
    }
    throw new Error('Device name already exists for this client.');
  }

  const device = new ClientDevice({
    client: normalizedClientId,
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
  const normalizedClientId = normalized.clientId || null;
  if (normalizedClientId) {
    isValidObjectIdOrThrow(normalizedClientId, 'clientId');
  }
  const normalizedNameKey = toNameKey(normalized.name);
  const existingDevice = await ClientDevice.findById(deviceId).lean<ClientDeviceDocument | null>();
  if (!existingDevice) throw new Error('Client device not found.');
  assertNotStale(payload.expectedUpdatedAt, existingDevice.updatedAt, 'Client device');
  const duplicateByName = await ClientDevice.exists({
    _id: { $ne: deviceId },
    client: normalizedClientId,
    nameKey: normalizedNameKey,
  });
  if (duplicateByName) {
    throw new Error('Device name already exists for this client.');
  }

  const device = await ClientDevice.findByIdAndUpdate(
    deviceId,
    {
      client: normalizedClientId,
      clientName: normalized.clientName,
      clientPhone: normalized.clientPhone,
      name: normalized.name,
      serialNumber: normalized.serialNumber,
      note: normalized.note,
      source: normalized.source,
      isActive: normalized.isActive,
    },
    { returnDocument: 'after', runValidators: true },
  ).lean<ClientDeviceDocument | null>();

  if (!device) throw new Error('Client device not found.');
  await propagateDeviceChangesToRepairSales(existingDevice, device);
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
