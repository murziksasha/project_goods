# Data retention & database size (ops)

Related: [API.md](./API.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [ACCOUNTING.md](./ACCOUNTING.md) · [index](./README.md)

Policy for multi-year LAN use. **Live purge stays off by default** until ops enables it after a restore drill.

## Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Sales hot / raw window | **36 months** |
| Finance raw transactions | **36 months**, then snapshot-only |
| Finance after cutoff | **Snapshot-only** (`FinancePeriodSnapshot`) |
| Cold storage form | **Yearly offline dumps** + checksum / verify metadata |
| Instant UI open of 5-year-old sale card | **No** |
| Auto purge sales | **Off** (`ARCHIVE_AUTO_PURGE_SALES=false`) |
| Auto purge finance | **Off** (`FINANCE_AUTO_PURGE=false`) |
| Finance yearly dump purge | **Forbidden** — live finance delete only via seal + `PURGE_FINANCE` |
| Ops baseline | Backup retention + db-stats |

### Implemented (hot/cold + finance + analytics)

| Feature | API / job | Notes |
| --- | --- | --- |
| Server analytics | `GET /api/analytics/dashboard` | Lean projection; `dataScope: live_sales_only`, `coldSalesPurgedExist` |
| Finance period seal | `POST /api/archive/finance/seal` (+ auto on scheduler) | Reverse-walk balances at **36m** cutoff |
| Finance purge | `POST /api/archive/finance/purge` body `{ confirmation: "PURGE_FINANCE" }` | Deletes txs `transactionDate <= periodEnd`; optional safety backup |
| Yearly sales dump | `POST /api/archive/yearly/sales/:year` | Terminal statuses; checksum + verified gate before purge |
| Yearly finance dump | `POST /api/archive/yearly/finance/:year` | Offline copy only; `purge` → 400 |
| List archives | `GET /api/archive/yearly` | Eligible years, snapshots, `staleOpenSales` |
| Balance-after list | uses txs **after** active seal only | Scales after purge |

Env defaults: `FINANCE_AUTO_SEAL=true`, `FINANCE_AUTO_PURGE=false`, `ARCHIVE_YEARLY_DUMPS=true`, `ARCHIVE_AUTO_PURGE_SALES=false`, `ARCHIVE_PURGE_REQUIRE_SAFETY_BACKUP=true`, `FINANCE_PURGE_REQUIRE_SAFETY_BACKUP=true`.

## Safety invariants

1. **Cashbox balances** remain source of truth for “now”; do not delete finance txs until period snapshots exist and are verified.
2. **No TTL indexes** on sales/finance.
3. **Sales purge** = verified dump (checksum + file) + live count match + confirm `PURGE_SALES_YEAR` (manual) + safety backup (default).
4. **Finance live purge** = active seal + confirm `PURGE_FINANCE` only (not yearly dump).
5. **Manual backups** are operator-owned; retention never deletes them automatically.
6. **Client history / analytics** are live-only; incomplete flags when cold sales were purged.
7. **Client delete** blocked if any cold sales year was purged from live (offline history may still reference client).
8. **Stale open sales** (non-terminal, older than hot cutoff) are reported on `GET /archive/yearly` only — never auto-deleted.
9. Yearly dump files have **no auto-retention**; offsite copy is manual ops.
10. Recommended: **restore drill** before first production purge.

## What grows

| Collection / area | Growth driver |
| --- | --- |
| `sales` | Orders/sales + embedded `timeline`, `paymentHistory`, `lineItems`, snapshots |
| `financetransactions` | Every cash movement (+ cancel pairs) |
| `clients` / `clientdevices` | CRM |
| `products` / `supplierorders` | Warehouse |
| Host volume `backup-data` | `mongodump` `.archive.gz` files (full + yearly) |

## Phase A — physical / ops (safe for logic)

### Backup disk retention (implemented)

After each successful backup create and on scheduler tick:

1. Delete **scheduled** backups older than `BACKUP_SCHEDULED_RETENTION_DAYS` (default **14**).
2. Keep at most `BACKUP_SCHEDULED_MAX_COUNT` scheduled (default **14**).
3. Keep at most `BACKUP_SAFETY_MAX_COUNT` safety (default **5**).
4. Optional total size: `BACKUP_MAX_TOTAL_BYTES` (default **0** = off). Drops oldest scheduled, then safety. **Never auto-deletes manual** backups.

Config: `backend/.env.example`, `backend/src/config/env.ts`.

### Observability (implemented)

| Surface | Access |
| --- | --- |
| `GET /api/system/db-stats` | Permission `system.backups.manage` |
| Settings → **Database** tab | Same permission; live health + collection table ([SETTINGS_SPEC.md](./SETTINGS_SPEC.md)) |
| CLI | `npm run db:stats --prefix backend` (needs `MONGO_URI`) |

Returns per-collection `count`, data/storage/index sizes, `avgObjSize`. Use as baseline before any later archive work.

### WiredTiger block compression (zstd) — maintenance runbook

MongoDB 7 WiredTiger compresses blocks (often snappy by default). **Changing compressor for an existing collection requires recreate**, not a live toggle:

1. Full safety backup (`POST /api/backups` or scheduled).
2. Maintenance window; no writers.
3. For each heavy collection (typical: `sales`, `financetransactions`):
   - export (`mongodump` query/collection) **or** `aggregate` `$out` to a temp collection created with zstd options, then rename;
   - verify counts;
   - drop old collection only after verify.
4. Example create options (mongosh; adjust names):

```javascript
db.createCollection('sales_zstd', {
  storageEngine: {
    wiredTiger: {
      configString: 'block_compressor=zstd',
    },
  },
});
// then copy documents, swap names — prefer mongodump/restore per collection with documented downtime
```

5. Re-create indexes from app models (restart backend or ensure Mongoose `syncIndexes` policy for your deploy).
6. Restore drill from safety backup if anything mismatches.

**Do not** run unattended collection drops in production scripts without dual verification.

`compact` (reclaim free space after large deletes) is also maintenance-window only; not part of daily app logic.

## Phase B — application hygiene

| Item | Status |
| --- | --- |
| Sales list `limit` (cap 5000 when provided) | Existing |
| Sales list **no default hard limit** when omitted | Orders workspace still loads full list; home KPIs use server analytics |
| `GET /sales?compact=1` | Optional projection (not default for dashboard orders) |
| Auth session prune | Idle-expired sessions pruned on token check |
| Server-side analytics | **Shipped** — live-only + honesty flags |
| Finance period snapshots | **Shipped** — seal @ **36 months**, optional purge |
| Yearly offline dumps | **Shipped** — sales/finance; verify-before-purge for sales |
| Scheduler | Re-dump missing/unverified; finance cold dumps without live purge |

## How to enable purge later (checklist)

1. Restore drill from a full safety/scheduled backup on a staging DB.
2. Confirm yearly dump file exists, `verified=true`, checksum matches.
3. Enable safety backup flags (defaults already true).
4. Manual sales: `POST /archive/yearly/sales/:year` with `{ "purge": true, "confirmation": "PURGE_SALES_YEAR" }`.
5. Finance: seal first, then `POST /archive/finance/purge` with `{ "confirmation": "PURGE_FINANCE" }`.
6. Only then consider `ARCHIVE_AUTO_PURGE_SALES=true` / `FINANCE_AUTO_PURGE=true` after monitoring.

## Recommended ops cadence

| Cadence | Action |
| --- | --- |
| Weekly | `GET /api/system/db-stats` or `npm run db:stats`; note `sales` / finance counts |
| Daily | Scheduled backup + retention (already scheduled UTC 15:00) |
| After large deletes/demo clear | Optional `compact` in maintenance window |
| Yearly | Offline dump of closed years; offsite copy of `BACKUP_DIR/yearly/` |

## Related code

- `backend/src/domain/backup/service.ts` — `enforceBackupRetention`, `createSafetyBackup`
- `backend/src/domain/backup/scheduler.ts`
- `backend/src/domain/system/db-stats.ts`
- `backend/src/domain/archive/yearly-dump.ts`
- `backend/src/domain/finance/period-snapshot.ts`
- `backend/src/domain/sale/list-sales-query.ts` — `compact`
- `backend/src/domain/auth/service.ts` — idle session prune
