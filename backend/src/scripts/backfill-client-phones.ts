import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Client } from '../domain/client/model';
import { normalizeClientPayload } from '../shared/lib/parsers';

const defaultReportPath = path.resolve(process.cwd(), 'tmp/client-phone-backfill-report.json');

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const getArgValue = (name: string, fallback = '') => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1]?.trim() ?? fallback;
  }

  return fallback;
};

type BackfillReport = {
  dryRun: boolean;
  scanned: number;
  updated: number;
  alreadyConsistent: number;
  conflicts: Array<{
    identity: string;
    clientIds: string[];
    phones: string[];
  }>;
};

const run = async () => {
  const apply = hasFlag('apply');
  const reportPath = getArgValue('report', defaultReportPath);

  await connectDatabase();

  const clients = await Client.find().lean();
  const report: BackfillReport = {
    dryRun: !apply,
    scanned: clients.length,
    updated: 0,
    alreadyConsistent: 0,
    conflicts: [],
  };

  const identityOwners = new Map<string, Set<string>>();

  for (const client of clients) {
    const normalized = normalizeClientPayload({
      phone: client.phone,
      phones: Array.isArray(client.phones) && client.phones.length > 0
        ? client.phones
        : client.phone
          ? [client.phone]
          : [],
      name: client.name,
      email: client.email ?? '',
      address: client.address ?? '',
      registrationId: client.registrationId ?? '',
      iban: client.iban ?? '',
      note: client.note ?? '',
      status: client.status,
    });

    for (const phone of normalized.phones) {
      const owners = identityOwners.get(phone) ?? new Set<string>();
      owners.add(client._id.toString());
      identityOwners.set(phone, owners);
    }
  }

  for (const [identity, owners] of identityOwners.entries()) {
    if (owners.size > 1) {
      report.conflicts.push({
        identity,
        clientIds: Array.from(owners),
        phones: [identity],
      });
    }
  }

  if (report.conflicts.length > 0 && apply) {
    throw new Error(
      `Found ${report.conflicts.length} duplicate phone identities. Resolve conflicts before applying.`,
    );
  }

  for (const client of clients) {
    const normalized = normalizeClientPayload({
      phone: client.phone,
      phones: Array.isArray(client.phones) && client.phones.length > 0
        ? client.phones
        : client.phone
          ? [client.phone]
          : [],
      name: client.name,
      email: client.email ?? '',
      address: client.address ?? '',
      registrationId: client.registrationId ?? '',
      iban: client.iban ?? '',
      note: client.note ?? '',
      status: client.status,
    });

    const currentPhones = Array.isArray(client.phones) ? client.phones.filter(Boolean) : [];
    const currentIdentities = Array.isArray(client.phoneIdentities)
      ? client.phoneIdentities.filter(Boolean)
      : [];
    const isConsistent =
      currentPhones.length === normalized.phones.length &&
      currentPhones.every((phone, index) => phone === normalized.phones[index]) &&
      currentIdentities.length === normalized.phones.length &&
      currentIdentities.every((identity, index) => identity === normalized.phones[index]);

    if (isConsistent) {
      report.alreadyConsistent += 1;
      continue;
    }

    if (apply) {
      await Client.findByIdAndUpdate(client._id, {
        phone: normalized.phone,
        phones: normalized.phones,
        phoneIdentities: normalized.phones,
      });
    }

    report.updated += 1;
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(
    apply
      ? `Backfill applied. Updated ${report.updated} clients.`
      : `Dry run complete. Would update ${report.updated} clients.`,
  );
  console.log(`Conflicts: ${report.conflicts.length}`);
  console.log(`Report: ${reportPath}`);

  await mongoose.disconnect();
};

void run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});