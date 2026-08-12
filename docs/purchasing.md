# Suppliers and purchasing foundation

Task 3 adds organization-isolated supplier sourcing, purchase commitments, and receiving evidence. It deliberately does not create inventory movements.

## Supplier versus supplier product

A **supplier** is a company or person the organization buys from. It stores contact details, payment terms, preferred currency, status, and internal notes.

A **supplier product** is the commercial relationship between one supplier and one SKU. A SKU may have several suppliers, and each relationship may have its own:

- supplier SKU code;
- current unit cost and currency;
- MOQ;
- lead time;
- preferred flag;
- active status and notes.

Supplier cost does not belong on `skus`. A SKU is stable catalog identity, while supplier offers change over time and differ by supplier.

Only one active supplier relationship may be preferred for a SKU. The service clears the previous preference transactionally, and a partial unique index protects the rule during concurrent requests. The system displays the preferred relationship but never automatically chooses a supplier for the user.

## Purchasing terms

### MOQ

MOQ means minimum order quantity: the smallest quantity the supplier accepts on one order. It must be greater than zero. When a PO line references a supplier product, the backend verifies the ordered quantity against that relationship's MOQ.

### Lead time

Lead time is the expected number of days between ordering and receiving. It cannot be negative. It is planning guidance and does not silently calculate or change the PO delivery date.

### Unit cost

Unit cost is the agreed purchase price for one unit before separate delivery or future landed-cost allocations. PostgreSQL stores it as `NUMERIC(19,4)`, never floating point.

### Payment terms

Payment terms record the agreed number of days before payment is due. Supplier terms can prefill a PO, but the PO stores its own historical value.

## Supplier price history

`supplier_products.current_unit_cost` supports convenient current reads. Every price change uses a transaction that:

1. locks the supplier-product row;
2. closes the current `supplier_price_history` row with `effective_to`;
3. updates the current price and currency;
4. inserts a new open history row with source and notes;
5. commits all changes together.

An unchanged price is rejected, and a partial unique index permits only one open history row per supplier product.

## Supplier comparison

`GET /api/skus/:id/suppliers` provides a paginated comparison containing supplier, current cost, currency, MOQ, lead time, preferred status, last price update, and active status. The frontend exposes this comparison from the SKU list and supplier detail pages.

## Purchase orders and items

A **purchase order (PO)** is the commercial header: supplier, PO number, dates, currency, payment terms, controlled extra costs, status, approval identity, and server-calculated totals.

A **PO item** is the historical agreement for one SKU. It stores ordered quantity, agreed unit cost, discount, tax, line total, and optional supplier-product reference.

The PO item copies the agreed cost. It must never read the supplier's current price later. If a supplier quotation changes tomorrow, yesterday's approved PO remains financially accurate.

### Financial authority

All monetary columns use PostgreSQL `NUMERIC(19,4)`. The frontend may display an estimate, but PostgreSQL calculates each line and the service recalculates the header:

```text
line_total = quantity × unit_cost − discount + tax
grand_total = subtotal − discount_total + tax_total + shipping_cost + other_cost
```

The API does not accept frontend subtotal, tax total, discount total, or grand total fields.

Shipping and other costs remain separate from unit cost. This keeps the model compatible with future freight, customs, insurance, local transport, handling, shipment, and landed-cost allocation features.

## Controlled PO workflow

```text
draft → approved → ordered → partially_received → received
  │         │          │
  └─────────┴──────────┴──→ cancelled
```

- Draft POs can change commercial fields and replace lines.
- Approved and ordered POs allow only notes and expected-delivery changes.
- Partially received, received, and cancelled POs cannot be casually edited.
- Approval records the approving user and timestamp.
- Invalid status jumps return `INVALID_PO_STATUS_TRANSITION`.
- Cancellation preserves the PO and its history.

## Goods receipts and partial receiving

A **goods receipt** records one delivery event against an ordered PO and active location. Its items record:

- the exact PO line and SKU;
- accepted quantity;
- rejected or damaged quantity;
- condition notes;
- receiving user and date through the receipt header.

Receiving is transactional. The service locks the PO and its lines, sums previously accepted quantities, rejects an accepted quantity above the remaining order, writes the receipt and items, then updates the PO status.

Receiving 60 accepted units from an order of 100 produces `partially_received`. Receiving the remaining 40 produces `received`. Rejected quantities remain separate and do not satisfy the order.

Receipts are not edited or deleted through the API. Task 4 can explicitly post accepted quantities through `POST /api/goods-receipts/:id/post-inventory`; rejected quantities never enter available stock.

## Receipt evidence and controlled inventory posting

Receipt creation proves what arrived but does not automatically change stock. Directly editing an on-hand number would lose source, reversal, serial, valuation, and audit information.

Each `goods_receipt_items.id` is stable evidence containing accepted quantity, SKU, PO line, organization, receipt, and location context. Task 4 creates an idempotent `PURCHASE_RECEIPT` movement for each positive accepted item after an explicit review action. Existing receipts are never blindly backfilled. See `docs/inventory.md`.

## Organization isolation and permissions

Every Task 3 table includes `organization_id`. Composite foreign keys prevent cross-organization supplier, SKU, PO, receipt, and location relationships. Models include the organization in every lookup and update.

Permissions:

- `purchasing.read` — view suppliers, offers, POs, comparison, summary, and receipts;
- `purchasing.manage` — maintain suppliers, supplier products, prices, and draft POs;
- `purchasing.approve` — approve and mark POs ordered;
- `purchasing.receive` — record goods receipts.

Owner and administrator roles receive all four. Members receive read access only. Location selection continues to use the existing `locations.read` and `locations.manage` permissions.

## Search and pagination

Supplier, supplier-product, PO, receipt, and comparison lists are server-paginated with a maximum limit of 100.

- Suppliers: name/contact search and active status.
- Supplier products: supplier, SKU, active, preferred, and text search.
- POs: PO number, supplier, status, order date, and expected-delivery ranges.
- Receipts: receipt number, PO, supplier, location, and date range.

## Product-first purchase orders

The new-PO screen defaults to SKU first: choose a SKU, review only its active linked suppliers, explicitly select one, enter quantity, review the summary, and explicitly create the draft PO. The original supplier-first multi-line form remains available and is still used to edit drafts.

`GET /api/skus/:id/suppliers` returns transparent recommendation facts. Preference and a passed linked sample come first, followed by replacement/warranty evidence, MOQ, lead time, and cost. This intentionally may recommend a reliable supplier over the cheapest quote. Every option returns reasons, missing data, quote age, and an `is_recommended` flag; the user still selects the supplier. PO totals and historical line costs remain server-authoritative.

## API endpoints

All endpoints require an authenticated session and `x-organization-id`.

| Method | Endpoint | Permission |
| --- | --- | --- |
| GET / POST | `/api/suppliers` | `purchasing.read` / `purchasing.manage` |
| GET / PATCH | `/api/suppliers/:id` | `purchasing.read` / `purchasing.manage` |
| GET / POST | `/api/supplier-products` | `purchasing.read` / `purchasing.manage` |
| GET / PATCH | `/api/supplier-products/:id` | `purchasing.read` / `purchasing.manage` |
| POST | `/api/supplier-products/:id/price` | `purchasing.manage` |
| GET | `/api/skus/:id/suppliers` | `purchasing.read` |
| GET / POST | `/api/purchase-orders` | `purchasing.read` / `purchasing.manage` |
| GET / PATCH | `/api/purchase-orders/:id` | `purchasing.read` / `purchasing.manage` |
| POST | `/api/purchase-orders/:id/approve` | `purchasing.approve` |
| POST | `/api/purchase-orders/:id/mark-ordered` | `purchasing.approve` |
| POST | `/api/purchase-orders/:id/cancel` | `purchasing.manage` |
| POST | `/api/purchase-orders/:id/receipts` | `purchasing.receive` |
| GET | `/api/goods-receipts` | `purchasing.read` |
| GET | `/api/goods-receipts/:id` | `purchasing.read` |
| GET | `/api/purchasing-summary` | `purchasing.read` |
| GET / POST | `/api/locations` | `locations.read` / `locations.manage` |

## Migration and verification

Migration `003_suppliers_purchasing.sql` is append-only. Do not edit migrations 001, 002, or 003 after application.

```sh
npm run db:check
npm run db:migrate
npm run db:migrate
npm run verify
```

The second migration run must report all migrations as already applied.
