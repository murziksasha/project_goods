import {
  clientStatuses,
  getEffectiveClientStatus,
  type ClientStatus,
} from './constants';
import { Client, type ClientDocument } from './model';
import { Sale, type SaleDocument } from '../sale/model';
import { getClientPhonesFromRecord } from '../../shared/lib/client-phones';
import { formatClient, formatClientHistory } from '../../shared/lib/formatters';
import { normalizeClientPayload } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { withOptionalMongoSession } from '../../shared/lib/mongo-session';
import { HttpError, isDuplicateKeyError } from '../../shared/lib/errors';
import type { ClientPayload } from '../shared/types';

const getClientSnapshot = async (client: ClientDocument) => {
  const visitCount = await Sale.countDocuments({ client: client._id });

  return {
    name: client.name,
    phone: client.phone,
    phones: getClientPhonesFromRecord(client),
    status: getEffectiveClientStatus(client.status ?? '', visitCount),
    email: client.email ?? '',
    address: client.address ?? '',
    registrationId: client.registrationId ?? '',
    iban: client.iban ?? '',
  };
};

const duplicatePhoneMessage = 'Client phone already exists.';

const normalizeExceptClientIds = (exceptClientIds?: string | string[]) => {
  const list = Array.isArray(exceptClientIds)
    ? exceptClientIds
    : exceptClientIds
      ? [exceptClientIds]
      : [];

  return list.map((id) => id.trim()).filter(Boolean);
};

const assertUniqueClientPhones = async (
  phones: string[],
  exceptClientIds?: string | string[],
) => {
  const list = (phones || []).filter(Boolean);
  if (list.length === 0) return;

  const excludedIds = normalizeExceptClientIds(exceptClientIds);

  // Check via identities for multikey support; also legacy phone field
  const orConditions = [
    { phoneIdentities: { $in: list } },
    { phone: { $in: list } },
  ];
  const query: Record<string, unknown> = { $or: orConditions };
  if (excludedIds.length > 0) {
    query._id = { $nin: excludedIds };
  }

  const existing = await Client.findOne(query).lean<Pick<ClientDocument, '_id' | 'phone' | 'phones'> | null>();
  if (!existing) return;

  throw new HttpError(409, duplicatePhoneMessage);
};

export const listClients = async (queryValue: unknown, statusValue: unknown) => {
  const query = getSearchQuery(queryValue) as Record<string, unknown>;
  const status =
    typeof statusValue === 'string' && statusValue !== 'all' ? statusValue : '';

  if (status && clientStatuses.includes(status as ClientStatus)) {
    query.status = status;
  }

  const clients = await Client.find(query)
    .sort({ createdAt: -1 })
    .lean<ClientDocument[]>();

  return clients.map(formatClient);
};

export const createClient = async (payload: ClientPayload) => {
  const normalizedPayload = normalizeClientPayload(payload);
  await assertUniqueClientPhones(normalizedPayload.phones || [normalizedPayload.phone]);

  const client = new Client(normalizedPayload);
  await client.validate();
  try {
    await client.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, duplicatePhoneMessage);
    }
    throw error;
  }
  return formatClient(client.toObject<ClientDocument>());
};

export const updateClient = async (clientId: string, payload: ClientPayload) => {
  isValidObjectIdOrThrow(clientId, 'clientId');
  const normalizedPayload = normalizeClientPayload(payload);
  await assertUniqueClientPhones(normalizedPayload.phones || [normalizedPayload.phone], clientId);

  const client = await Client.findByIdAndUpdate(clientId, normalizedPayload, {
    returnDocument: 'after',
    runValidators: true,
  }).lean<ClientDocument | null>();

  if (!client) {
    throw new HttpError(404, 'Client not found.');
  }

  await Sale.updateMany(
    { client: client._id },
    { $set: { clientSnapshot: await getClientSnapshot(client) } },
  );

  return formatClient(client);
};

export const deleteClient = async (clientId: string) => {
  isValidObjectIdOrThrow(clientId, 'clientId');

  if (await Sale.exists({ client: clientId })) {
    throw new HttpError(400, 'Cannot delete a client that has sales history.');
  }

  const deletedClient = await Client.findByIdAndDelete(clientId).lean<ClientDocument | null>();
  if (!deletedClient) {
    throw new HttpError(404, 'Client not found.');
  }

  return { id: clientId };
};

export const getClientHistory = async (clientId: string) => {
  isValidObjectIdOrThrow(clientId, 'clientId');

  const client = await Client.findById(clientId).lean<ClientDocument | null>();
  if (!client) {
    throw new HttpError(404, 'Client not found.');
  }

  const sales = await Sale.find({ client: clientId })
    .sort({ saleDate: -1 })
    .lean<SaleDocument[]>();

  return formatClientHistory(client, sales);
};

export const mergeClients = async (
  targetClientIdInput: unknown,
  sourceClientIdInput: unknown,
) => {
  const targetClientId =
    typeof targetClientIdInput === 'string'
      ? targetClientIdInput.trim()
      : '';
  const sourceClientId =
    typeof sourceClientIdInput === 'string'
      ? sourceClientIdInput.trim()
      : '';

  if (!targetClientId || !sourceClientId) {
    throw new HttpError(400, 'Both targetClientId and sourceClientId are required.');
  }
  if (targetClientId === sourceClientId) {
    throw new HttpError(400, 'Select two different clients.');
  }

  isValidObjectIdOrThrow(targetClientId, 'targetClientId');
  isValidObjectIdOrThrow(sourceClientId, 'sourceClientId');

  const [targetClient, sourceClient] = await Promise.all([
    Client.findById(targetClientId).lean<ClientDocument | null>(),
    Client.findById(sourceClientId).lean<ClientDocument | null>(),
  ]);

  if (!targetClient) {
    throw new HttpError(404, 'Target client not found.');
  }
  if (!sourceClient) {
    throw new HttpError(404, 'Source client not found.');
  }

  const mergedNote = [targetClient.note?.trim(), sourceClient.note?.trim()]
    .filter(Boolean)
    .filter((note, index, collection) => collection.indexOf(note) === index)
    .join('\n');
  const mergedStatus =
    targetClient.status === 'new' && sourceClient.status !== 'new'
      ? sourceClient.status
      : targetClient.status;
  const mergedPhonesRaw = [
    ...getClientPhonesFromRecord(targetClient),
    ...getClientPhonesFromRecord(sourceClient),
  ];
  const mergedPhone = targetClient.phone?.trim() || sourceClient.phone;
  const payload = normalizeClientPayload({
    phone: mergedPhone,
    phones: mergedPhonesRaw.length ? mergedPhonesRaw : [mergedPhone],
    name: targetClient.name?.trim() || sourceClient.name,
    email: targetClient.email?.trim() || sourceClient.email,
    address: targetClient.address?.trim() || sourceClient.address,
    registrationId:
      targetClient.registrationId?.trim() || sourceClient.registrationId,
    iban: targetClient.iban?.trim() || sourceClient.iban,
    note: mergedNote,
    status: mergedStatus,
  });

  await assertUniqueClientPhones(payload.phones, [targetClientId, sourceClientId]);

  return withOptionalMongoSession(async (session) => {
    const deleteQuery = Client.findByIdAndDelete(sourceClientId);
    const deletedSource = await (session
      ? deleteQuery.session(session)
      : deleteQuery
    ).lean<ClientDocument | null>();
    if (!deletedSource) {
      throw new HttpError(500, 'Failed to delete source client.');
    }

    const updateQuery = Client.findByIdAndUpdate(targetClientId, payload, {
      returnDocument: 'after',
      runValidators: true,
    });
    const updatedTarget = await (session
      ? updateQuery.session(session)
      : updateQuery
    ).lean<ClientDocument | null>();
    if (!updatedTarget) {
      throw new HttpError(500, 'Failed to update target client.');
    }

    const clientSnapshot = await getClientSnapshot(updatedTarget);
    const movedSalesResult = session
      ? await Sale.updateMany(
          { client: sourceClient._id },
          {
            $set: {
              client: updatedTarget._id,
              clientSnapshot,
            },
          },
          { session },
        )
      : await Sale.updateMany(
          { client: sourceClient._id },
          {
            $set: {
              client: updatedTarget._id,
              clientSnapshot,
            },
          },
        );

    return {
      client: formatClient(updatedTarget),
      removedClientId: sourceClientId,
      movedSalesCount: movedSalesResult.modifiedCount ?? 0,
    };
  });
};
