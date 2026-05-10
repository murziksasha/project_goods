# Product Serial Number & Warehouse Flow Spec

## Scope
This spec defines when product serial numbers are assigned and when items are allowed to appear in warehouse stock balances.

## Core Warehouse Rule
1. Until warehouse receipt (оприходування) is implemented and executed, products must not enter stock in any flow.
2. Creating or editing names in `Products` (`catalogProducts`) is catalogization only and must not create stock items.
3. Creating supplier-order drafts is planning only and must not create stock items.
4. Stock balance screens must show only items with real stock quantity (`quantity > 0`).

## Serial Number Rule
1. Product serial number format is `S` + digits, for example `S000001`.
2. Auto-generated numbering starts from `S000001` and increments by `+1`.
3. Serial number assignment belongs to Warehouse flow only (receipt/inbound stock flow), not to catalogization or supplier-order draft creation.
4. Sequence state is persisted in DB collection `sequences` with key `product-serial-number`.
5. If DB already contains serials in `S<digits>` format, sequence is synchronized to the max existing value before issuing the next number.

## API Contract Notes
- `POST /api/products/serial-number/next` is reserved for warehouse receipt flow.
- Catalog product APIs (`/api/catalog-products`) must not generate stock serials and must not create stock records.
