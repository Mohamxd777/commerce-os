# Inventory ledger and stock control

Task 4 adds organization-isolated stock control without putting a mutable `quantity` field on a SKU. The immutable movement ledger is authoritative. A transactional balance projection makes reads fast and can always be checked against the ledger.

## Why stock is not a simple SKU quantity

`sku.quantity = 25` answers only one question and loses the explanation. It cannot reliably show where units are, whether they are sellable, which receipt added them, which transfer removed them, or whether a retry posted twice.

Commerce OS records every change instead:

```text
+6 PURCHASE_RECEIPT · available · Main Warehouse
-2 TRANSFER_OUT    · available · Main Warehouse
+2 TRANSFER_IN     · available · Fulfillment Center
-1 QUARANTINE_IN   · available · Main Warehouse
+1 QUARANTINE_IN   · quarantine · Main Warehouse
```

The signed sum for each organization, SKU, location, and bucket is the current quantity. Positive movement quantities enter the selected bucket. Negative quantities leave it.

## Core terms

### Inventory Ledger and Movement

`inventory_movements` is the append-only audit record. A movement stores the organization, SKU, location, controlled type, signed `NUMERIC(19,4)` quantity, bucket, time, user, reason, and optional reference/correlation/idempotency fields. Existing movement rows cannot be edited or deleted through normal database writes; corrections are new movements.

Task 4 implements `PURCHASE_RECEIPT`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `DAMAGE`, `QUARANTINE_IN`, `QUARANTINE_OUT`, `RELEASE_FROM_QUARANTINE`, `RESERVATION`, and `RESERVATION_RELEASE`. `SALE` and `SALE_RETURN` are reserved by the database contract for future services; Task 4 creates no sales behavior.

### Balance

`inventory_balances` is a rebuildable read projection keyed by organization + SKU + location + bucket. An `AFTER INSERT` ledger trigger updates it in the same PostgreSQL transaction as the new movement. A protection trigger rejects arbitrary inserts, updates, or deletes. Controllers and business services never write balances.

Projection quantities cannot be negative. PostgreSQL row locking during the projection update serializes concurrent consumption of the same bucket, so two requests cannot both consume the last unit.

### Available, Reserved, Quarantine, and Damaged

- **Available Stock** is physical stock that can be sold or used.
- **Reserved Stock** is physical stock allocated to a future order. Task 4 provides the auditable bucket foundation but no sales-order flow.
- **Quarantine** is temporarily unavailable stock awaiting inspection.
- **Damaged** is known non-sellable physical stock and is excluded from available.

Moving one available unit to quarantine or damaged writes a negative available movement and a positive destination-bucket movement with the same correlation ID. Total physical stock does not change.

### Adjustment

An adjustment is an audited correction containing SKU, location, quantity, direction or bucket move, reason, notes, user, and timestamp. There is no “set stock to 37” endpoint. A future counted-stock UI must calculate and post the difference.

### Transfer

A transfer has draft, in-transit, received, or cancelled status.

- Creating/editing a draft changes no stock.
- Shipping creates `TRANSFER_OUT` from source available stock.
- While status is `in_transit`, transfer items are the authoritative in-transit quantity. No extra location bucket can be mistaken for on-hand stock.
- Receiving creates `TRANSFER_IN` at the destination.
- Repeated ship/receive requests return existing state and create no duplicate movements.
- Only a draft can be cancelled, because shipped stock needs a distinct return workflow.

### Reorder Point and Safety Stock

The **Reorder Point** is the available quantity at or below which replenishment should be considered. It is configured per SKU/location; there is no hard-coded universal threshold. **Safety Stock** is planning context intended to reduce stockout risk. Task 4 does not automatically create purchase orders.

## Goods Receipt posting and historical receipts

Goods Receipt creation remains purchasing evidence and does not automatically change stock. An authorized user explicitly calls:

```text
POST /api/goods-receipts/:id/post-inventory
```

The posting service locks the receipt, ignores rejected quantities, creates one `PURCHASE_RECEIPT` movement per item with accepted quantity, and marks the receipt posted in the same transaction.

This explicit approach is safe for receipts that may predate the inventory rules. Migration 004 never backfills them. A pre-existing receipt remains visibly unposted and can be reviewed through the same controlled action.

## Idempotency and concurrency

Receipt movements use a unique organization-scoped key containing receipt and receipt-item IDs. Transfers use unique ship/receive keys containing transfer and item IDs. The service also locks the receipt or transfer status row.

These controls protect against refreshes, frontend retries, timeouts, and concurrent requests. Idempotency never depends on browser state. Balance projection updates obtain normal PostgreSQL row locks, while the nonnegative database constraint makes a conflicting consumer roll back transactionally.

## Reconciliation

`GET /api/inventory/reconciliation` groups the ledger by organization, SKU, location, and bucket and compares it with `inventory_balances`. It reports each mismatch and difference and never repairs or overwrites data silently.

## Permissions and organization isolation

- `inventory.read`: balances, summary, movements, SKU detail, transfers, and reorder rules.
- `inventory.manage`: receipt posting, reorder-rule changes, and reconciliation.
- `inventory.transfer`: create, edit, ship, receive, and cancel transfers.
- `inventory.adjust`: audited adjustments and bucket moves.

Owners and administrators receive all four. Members receive read-only access. Every table, query, lock, and foreign-key relationship is organization-scoped.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/inventory` | Paginated stock by SKU/location, bucket, and low-stock state |
| GET | `/api/inventory/summary` | Dashboard cards and recent movements |
| GET | `/api/inventory/movements` | Filtered immutable ledger history |
| GET | `/api/inventory/reconciliation` | Report ledger/projection differences |
| POST | `/api/inventory/adjustments` | Adjustment in/out or correlated bucket movement |
| GET | `/api/skus/:id/inventory` | SKU balances, rules, movements, suppliers, transfers |
| GET / POST | `/api/inventory/reorder-rules` | List/create planning rules |
| PATCH | `/api/inventory/reorder-rules/:id` | Update a planning rule |
| GET / POST | `/api/inventory/transfers` | List/create transfers |
| GET / PATCH | `/api/inventory/transfers/:id` | Read/edit a draft transfer |
| POST | `/api/inventory/transfers/:id/ship` | Post source movement |
| POST | `/api/inventory/transfers/:id/receive` | Post destination movement |
| POST | `/api/inventory/transfers/:id/cancel` | Cancel a draft |
| POST | `/api/goods-receipts/:id/post-inventory` | Post accepted receipt quantities once |

## Serial tracking foundation and deferred work

Task 4 does not invent serial numbers. SKU-level `serial_tracking_enabled` is displayed with a deferral note. Ledger references preserve receipt, location, movement, and future sale/return association points, so a later unit-instance table can attach actual serials without redesigning the quantity ledger.

Sales, sale returns, valuation, costing, landed cost, automatic POs, marketplace integration, and actual serial instances remain intentionally deferred.
