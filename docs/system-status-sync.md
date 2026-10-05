# System Status sync indicators

The sync cards are read-only. They do not refresh boarding or operations data; the refresh button only reads local status and calls the existing `get_data_versions` read action when online.

## Data inventory

| Status | Source | Meaning |
| --- | --- | --- |
| Spreadsheet boarding data | Metadata-only `waffleSyncMetadataV1` written after `syncSpreadsheetData()` completes its successful path | Records the time of a successful CSV spreadsheet read. The `directory:summary` cache is not treated as a spreadsheet sync timestamp. |
| Stay operations data | IndexedDB `waffle-house-v83`, store `responses`, key `directory:stay-operations` | Uses `savedAt`, `version`, and `payload.result === "success"`. An online read-only directory-version comparison distinguishes a matching response from cached data. |
| Pending device changes | IndexedDB `waffle-house-v108-writes`, store `mutations` | Reads only the object-store count. It includes queued and conflict records; no row contents or mutation payloads are fetched or displayed. |

The V10.8 queue is active and populated by the existing write wrappers. The System Status adapter does not replay or modify it. Checkout actions are not included in that queue.

`system-status-sync.js` stores only the sync scope, source label, attempt outcome/time, and optional version in local storage. It never stores CSV contents, guest details, or mutation payloads. Metadata write errors are swallowed so they cannot change application read/write behavior.

## State rules

- **Synced** means a successful spreadsheet read is recorded, or the saved stay-operations response version matches the current directory version.
- **Cached · offline** means a locally saved successful timestamp/response exists while `navigator.onLine` is false. Online status by itself is never considered proof of a successful read.
- **Cached** means saved data exists but its version is older/different or has not been verified.
- **Failed** means the most recent recorded source read failed, while any earlier successful time is retained. A failed version check is shown as **Failed to verify** for operations data.
- **Unavailable** is used when the relevant browser storage cannot be inspected. A missing sync timestamp is **Unknown**.

Storage reads use `indexedDB.databases()` before opening a database, so the status page does not create empty databases while checking. IndexedDB cache, queue count, and local sync metadata are inspected independently where possible, so one unavailable store does not conceal available information from another.

## Verification

`tests/system-status-sync.test.js` checks metadata-only recording and failure retention. `tests/system-status-sync.browser.spec.js` covers the actual status page, responsive light/dark layouts, saved/offline/failed/unknown/unavailable states, queue count privacy, and read-only request behavior.
