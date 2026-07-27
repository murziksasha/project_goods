# Data retention & database size (ops)

Policy decisions for multi-year LAN use. **No automatic deletion of business documents** in the live MongoDB in the current ops phase.

## Product decisions (locked)

| Topic | Decision |
| --- | --- |
| Hot horizon | **24 months** |
| Cold storage form | **Yearly offline dumps** (not live cold collections) |
| Instant UI open of 5-year-old sale card | **No** |
| Finance raw transactions | **Snapshot-only after 2 years** |
| Ops baseline | Backup retention + db-stats (Phase A/B) |

### Implemented (hot/cold + finance + analytics)

| Feature | API / job | Notes |
| --- | --- | --- |
| Server analytics | `GET /api/analytics/dashboard` | Lean projection aggregation; home UI prefers server payload |
| Finance period seal | `POST /api/archive/finance/seal` (+ auto on scheduler) | Reverse-walk balances at 2y cutoff; `FinancePeriodSnapshot` |
| Finance purge | `POST /api/archive/finance/purge` body `{ confirmation: "PURGE_FINANCE" }` | Deletes txs `transactionDate <= periodEnd`; **auto off** (`FINANCE_AUTO_PURGE`) |
| Yearly sales dump | `POST /api/archive/yearly/sales/:year` | Terminal statuses only; dump under `BACKUP_DIR/yearly/` |
| Yearly finance dump | `POST /api/archive/yearly/finance/:year` | Offline copy; live purge prefer seal path |
| List archives | `GET /api/archive/yearly` | Eligible years + snapshots |
| Balance-after list | uses txs **after** active seal only | Scales after purge |

Env defaults: `FINANCE_AUTO_SEAL=true`, `FINANCE_AUTO_PURGE=false`, `ARCHIVE_YEARLY_DUMPS=true`, `ARCHIVE_AUTO_PURGE_SALES=false`.

## What grows

| Collection / area | Growth driver |
| --- | --- |
| `sales` | Orders/sales + embedded `timeline`, `paymentHistory`, `lineItems`, snapshots |
| `financetransactions` | Every cash movement (+ cancel pairs) |
| `clients` / `clientdevices` | CRM |
| `products` / `supplierorders` | Warehouse |
| Host volume `backup-data` | `mongodump` `.archive.gz` files |

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
| Server-side analytics | **Shipped** — `GET /api/analytics/dashboard` |
| Finance period snapshots | **Shipped** — seal @ 2y, optional purge |
| Yearly offline dumps | **Shipped** — sales/finance year archives |

## Safety invariants

1. **Cashbox balances** remain source of truth for “now”; do not delete finance txs until period snapshots exist and are verified.
2. **No TTL indexes** on sales/finance.
3. **Any future purge** = safety backup + dry-run report + confirm phrase + reverse dump retained.
4. **Manual backups** are operator-owned; retention never deletes them automatically.

## Recommended ops cadence

| Cadence | Action |
| --- | --- |
| Weekly | `GET /api/system/db-stats` or `npm run db:stats`; note `sales` / finance counts |
| Daily | Scheduled backup + retention (already scheduled UTC 15:00) |
| After large deletes/demo clear | Optional `compact` in maintenance window |
| Yearly (future) | Offline dump of closed year per product policy |

## Related code

- `backend/src/domain/backup/service.ts` — `enforceBackupRetention`
- `backend/src/domain/backup/scheduler.ts`
- `backend/src/domain/system/db-stats.ts`
- `backend/src/domain/sale/list-sales-query.ts` — `compact`
- `backend/src/domain/auth/service.ts` — idle session prune
