# CLIENTS RULES

## Client Status Localization Rule
- Keep client status values in original English.
- Do not translate client status enums in UI labels, API payloads, or documentation.

## Blacklist Status Rule
- `blacklist` is a manual priority client status and must not be replaced by automatic visit-based status logic.
- Clients list rows with `blacklist` status must be visually marked with a red warning treatment and the `blacklist` badge.
- Client lookup suggestions in order creation must visually mark `blacklist` clients before the operator selects them.
- `blacklist` is a warning state, not a hard validation block: creating repair and sale orders remains allowed.

