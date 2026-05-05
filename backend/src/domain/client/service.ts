import { clientStatuses, type ClientStatus } from './constants';
import { Client, type ClientDocument } from './model';
import { Sale, type SaleDocument } from '../sale/model';
import { formatClient, formatClientHistory } from '../../shared/lib/formatters';
import { normalizeClientPayload } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import type { ClientPayload } from '../shared/types';

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
  const client = new Client(normalizeClientPayload(payload));
  await client.validate();
  await client.save();
  return formatClient(client.toObject<ClientDocument>());
};

export const updateClient = async (clientId: string, payload: ClientPayload) => {
  isValidObjectIdOrThrow(clientId, 'clientId');

  const client = await Client.findByIdAndUpdate(clientId, normalizeClientPayload(payload), {
    new: true,
    runValidators: true,
  }).lean<ClientDocument | null>();

  if (!client) {
    throw new Error('Client not found.');
  }

  return formatClient(client);
};

export const deleteClient = async (clientId: string) => {
  isValidObjectIdOrThrow(clientId, 'clientId');

  if (await Sale.exists({ client: clientId })) {
    throw new Error('Cannot delete a client that has sales history.');
  }

  const deletedClient = await Client.findByIdAndDelete(clientId).lean<ClientDocument | null>();
  if (!deletedClient) {
    throw new Error('Client not found.');
  }

  return { id: clientId };
};

export const getClientHistory = async (clientId: string) => {
  isValidObjectIdOrThrow(clientId, 'clientId');

  const client = await Client.findById(clientId).lean<ClientDocument | null>();
  if (!client) {
    throw new Error('Client not found.');
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
    throw new Error('Both targetClientId and sourceClientId are required.');
  }
  if (targetClientId === sourceClientId) {
    throw new Error('Select two different clients.');
  }

  isValidObjectIdOrThrow(targetClientId, 'targetClientId');
  isValidObjectIdOrThrow(sourceClientId, 'sourceClientId');

  const [targetClient, sourceClient] = await Promise.all([
    Client.findById(targetClientId).lean<ClientDocument | null>(),
    Client.findById(sourceClientId).lean<ClientDocument | null>(),
  ]);

  if (!targetClient) {
    throw new Error('Target client not found.');
  }
  if (!sourceClient) {
    throw new Error('Source client not found.');
  }

  const mergedNote = [targetClient.note?.trim(), sourceClient.note?.trim()]
    .filter(Boolean)
    .filter((note, index, collection) => collection.indexOf(note) === index)
    .join('\n');
  const mergedStatus =
    targetClient.status === 'new' && sourceClient.status !== 'new'
      ? sourceClient.status
      : targetClient.status;
  const payload = normalizeClientPayload({
    phone: targetClient.phone?.trim() || sourceClient.phone,
    name: targetClient.name?.trim() || sourceClient.name,
    note: mergedNote,
    status: mergedStatus,
  });

  const updatedTarget = await Client.findByIdAndUpdate(targetClientId, payload, {
    new: true,
    runValidators: true,
  }).lean<ClientDocument | null>();
  if (!updatedTarget) {
    throw new Error('Failed to update target client.');
  }

  const movedSalesResult = await Sale.updateMany(
    { client: sourceClient._id },
    {
      $set: {
        client: updatedTarget._id,
        clientSnapshot: {
          name: updatedTarget.name,
          phone: updatedTarget.phone,
          status: updatedTarget.status,
        },
      },
    },
  );

  const deletedSource = await Client.findByIdAndDelete(sourceClientId).lean<ClientDocument | null>();
  if (!deletedSource) {
    throw new Error('Failed to delete source client.');
  }

  return {
    client: formatClient(updatedTarget),
    removedClientId: sourceClientId,
    movedSalesCount: movedSalesResult.modifiedCount ?? 0,
  };
};
