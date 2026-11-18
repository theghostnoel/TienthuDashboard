# Security Specification — Tiến Thu Inventory Firestore Rules

## 1. Operational Requirement & Access Model
- The store owner explicitly requires **zero login / zero password / zero access codes** on the internal web dashboard so any workshop workstation opens directly into the dashboard and syncs transactions in real time across devices.
- Therefore, rules enforce strict **payload validation, immutable ledger protection, type/size bounds, and temporal integrity** on every Firestore document without blocking unauthenticated store workstations.

## 2. Data Invariants
1. **Default Deny:** Any path not explicitly matched (`/inventory_transactions/{txId}`, `/catalog_parts_custom/{partId}`, `/system_metadata/{metaKey}`, `/test/connection`) is denied (`allow read, write: if false`).
2. **Append-Only Ledger (`inventory_transactions`):** Historical transactions can only be created with valid schema, positive `soLuong > 0`, valid `loaiGiaoDich` (`NHAP_NCC` | `XUAT_SUA_CHUA`), valid `ngayIso` (`YYYY-MM-DD`), strict key allowlist (`hasAll` + `hasOnly`), and `createdAt == request.time`. `update` and `delete` are strictly forbidden (`if false`) so no device can alter or erase past transactions.
3. **Catalog Overrides (`catalog_parts_custom`):** `partId` must match `maPhuTung`, numeric prices/minimums must be `>= 0`, string lengths are strictly bounded, `updatedAt == request.time`, and updates must only touch allowed fields. Deletions are forbidden (`if false`).
4. **System Metadata (`system_metadata`):** Only `google_sheet_seed_v1` (write-once create), `tx_counter` (monotonic `lastSeq >= existing().lastSeq`), `tham_so_override` (strict date regex `YYYY-MM-DD`, numeric bounds `[0..365]`/`[1..365]`, `updatedAt == request.time`), and `google_sheet_config` (strict `spreadsheetId` regex `^[a-zA-Z0-9_\\-]+$`, length `[10..128]`, optional `webhookUrl` strictly matching `https://script.google.com/macros/s/.../exec`, `updatedAt == request.time`) are permitted; `list` and `delete` are forbidden.

## 3. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Shadow field injection on `inventory_transactions` create (`{ ..., isAdmin: true }`).
2. Negative or zero `soLuong` (`soLuong: 0` or `soLuong: -5`).
3. Excessively large `soLuong` (`soLuong: 2000000`).
4. Invalid `loaiGiaoDich` (`"DELETE_ALL"`).
5. Malformed `ngayIso` (`"18/11/2026"` instead of `"YYYY-MM-DD"`).
6. Oversized `ghiChu` (> 500 chars) or oversized `txId` (> 128 chars / invalid chars).
7. Updating or deleting an existing `inventory_transactions` record.
8. Client-forged `createdAt` timestamp (`createdAt != request.time`).
9. Creating `catalog_parts_custom/PT999` with mismatched `maPhuTung: "PT001"`.
10. Negative `giaNhapThamChieu` or `dinhMucToiThieu` on `catalog_parts_custom`.
11. Decrementing `system_metadata/tx_counter.lastSeq` backwards.
12. Reading or writing any undeclared collection (e.g. `/admin_secrets/config`).
