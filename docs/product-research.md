# Product research workspace, samples, and launch decisions

Task 5 adds the organization-isolated research domain and Task 6 turns it into a focused sourcing workspace. It helps a team decide whether a product idea deserves capital before it becomes an operational catalog item. It does not create inventory, supplier-product relationships, purchase orders, marketplace integrations, or sales behavior.

The main `#research` route is the Product Research workspace. It shows only sourcing-critical summaries and filters. A candidate opens into Overview, Suppliers, Marketplace, Economics, Samples, and Decision tabs, with this visible progress path:

```text
Idea → Supplier → Market → Economics → Sample → Decision → SKU
```

`#research/quick-capture` is optimized for supplier visits. Product name, supplier, and unit price are the only required business inputs; it atomically creates a normal `research` candidate and its first preferred supplier option. Market observations and economics are deliberately not required at capture time.

## Workflow

```text
Research → Shortlisted → Sourcing → Sampling → Approved
    ↘ Rejected      ↗       ↗          ↘ Rejected

Approved → explicit Create Product from Candidate → Launched + linked draft Product
```

Status changes are checked by the service. `launched` cannot be selected manually; it is written only by a successful conversion transaction. A rejected candidate can return to research. A launched candidate is historical and cannot move backward.

## Candidate records and history

`product_candidates` stores the hypothesis: name, optional brand/category/model/GTIN, description, notes, planned selling price, status, author, and optional converted product link. Planned selling price is intentionally separate from observed marketplace prices.

Evidence is recorded in separate append-only histories:

- market snapshots capture multiple manual Noon/listing observations: title, URL, seller/brand, current/original price, rating, reviews, recent-sales/rank/fulfillment signals, observation time, and notes;
- supplier options can reference an existing `suppliers` row or preserve a temporary lead, with quote cost, optional quantity prices at 1/5/10/20/50/100, same-price mode, MOQ, lead time, warranty, defect replacement, invoice/sample availability, and an explicitly selected preferred option;
- sample records keep the workflow state (`not_requested`, `requested`, `purchased`, `testing`, `passed`, or `failed`), cost, notes, and a flexible JSON checklist;
- fee assumptions store name, percentage/fixed type, value, effective dates, source URL, and notes;
- evidence rows store URLs or external file/screenshot metadata—never file binary data in PostgreSQL;
- unit-economics and launch-evaluation rows are append-only so a later decision never rewrites the evidence used by an earlier decision.

The sample checklist is intentionally product-neutral. The UI offers useful computer-accessory suggestions such as USB-C power delivery, HDMI output, thermals, build quality, and packaging, but users can add any product-specific check.

## Authoritative unit economics

Money and percentages are validated as decimal strings and calculated by PostgreSQL with `NUMERIC`, not JavaScript floating-point arithmetic. Each calculation is saved. Task 6 can link a calculation to the selected supplier option; the service then uses that option's authoritative unit cost and the candidate's saved planned selling price.

Inputs are selling price, supplier unit cost, local transport, packaging, referral percentage/fixed fee, fulfillment fee, shipping reimbursement, advertising, estimated return reserve, other variable costs, and optional margin/ROI targets.

For one unit:

```text
referral amount = selling price × referral percentage / 100

total variable cost = supplier cost
                    + local transport + packaging
                    + referral amount + fixed referral fee
                    + fulfillment + advertising + return reserve + other costs
                    - shipping reimbursement

gross profit = selling price - supplier cost
contribution profit = selling price - total variable cost
net margin % = contribution profit / selling price × 100
ROI % = contribution profit / total variable cost × 100
```

Break-even accounts for the fact that the percentage referral fee changes with selling price:

```text
break-even price = (supplier cost + non-percentage variable costs)
                   / (1 - referral percentage / 100)
```

The referral percentage must be below 100. Division-by-zero ROI is returned as `null`. Maximum purchase price is calculated for the optional target margin and target ROI. Shipping reimbursement reduces variable cost but cannot make any input negative.

These formulas are documented so future contributors can change them deliberately through a new migration/service version rather than silently changing a React display.

## Fee assumptions

No marketplace name or fee is hard-coded. A fee assumption has an effective period and source. Add a new row when a marketplace changes its fee; do not edit old evidence. The calculator accepts the applicable fee values selected by the user and stores them with that calculation.

## Launch evaluation and capital allocation

A structured evaluation records:

- recommendation: `buy`, `maybe`, `reject`, or `needs_more_research`;
- risk: `low`, `medium`, or `high`;
- target price, unit cost, margin, and ROI;
- launch quantity, planned capital, projected profit, and rationale;
- optional link to the unit-economics calculation used.

Organization settings define minimum margin, minimum ROI, maximum capital per launch, maximum acceptable defect risk, minimum demand score, total launch budget, and currency. Owners and administrators can edit them. The dashboard sums the latest `buy`/`maybe` planned capital for non-rejected candidates and shows a warning when it exceeds the launch budget.

## Controlled catalog conversion

`POST /api/research/candidates/:id/create-product` is the only research-to-catalog conversion. It requires `research.evaluate`, an approved candidate, and an explicit review payload for category, optional brand, Product name, Variant name, SKU code, model/MPN, and serial-tracking flag.

One PostgreSQL transaction:

1. locks the candidate;
2. verifies it is approved and not already converted;
3. verifies category/brand ownership;
4. creates one draft Product, one active Variant, and one active SKU;
5. links the candidate, records converter/time, and changes its status to `launched`;
6. commits everything together.

A unique candidate/product link and the row lock prevent duplicate conversion. The transaction creates no supplier-product row, PO, receipt, inventory movement, or balance.

## Permissions and tenancy

- `research.read`: read dashboard, candidates, histories, comparison, and settings.
- `research.manage`: maintain candidates, snapshots, supplier options, samples, fee assumptions, evidence metadata, and settings.
- `research.evaluate`: run/save economics, record launch evaluations, and convert approved candidates.

Owners and administrators receive all three permissions. Members receive `research.read` only. Every query and every composite foreign key includes `organization_id`; cross-organization IDs are hidden or rejected.

## Search, filters, and comparison

`GET /api/research/candidates` is server-paginated and supports search across candidate name, brand, model, GTIN, marketplace/listing data, notes, and supplier/lead names. Filters include status, category, supplier ID, latest decision, risk, supplier presence, and sample presence. List rows also return minimum/median observed price, observation count, selected and cheapest supplier summaries, and current workflow stage.

Comparison requires 2–10 explicitly selected candidate IDs and returns only matching rows from the active organization. It shows the latest market, supplier, sample, economic, evaluation, and capital values without merging history.

## API

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET / POST | `/api/research/candidates` | read / manage | Paginated list or create candidate |
| POST | `/api/research/quick-capture` | manage | Atomically capture a research candidate and first supplier quote |
| GET / PATCH | `/api/research/candidates/:id` | read / manage | Full history or controlled update |
| POST | `/api/research/candidates/:id/snapshots` | manage | Add market snapshot |
| GET / POST | `/api/research/candidates/:id/suppliers` | read / manage | List/add supplier options |
| PATCH | `/api/research/supplier-options/:id` | manage | Update supplier option |
| GET / POST | `/api/research/candidates/:id/samples` | read / manage | List/add samples |
| PATCH | `/api/research/samples/:id` | manage | Update sample/checklist and enforce workflow state transitions |
| POST | `/api/research/candidates/:id/fee-assumptions` | manage | Add effective fee evidence |
| POST | `/api/research/candidates/:id/evidence` | manage | Add URL or external storage metadata |
| POST | `/api/research/candidates/:id/unit-economics` | evaluate | Calculate and save decimal economics |
| POST | `/api/research/candidates/:id/evaluations` | evaluate | Add structured launch decision |
| GET | `/api/research/comparison?ids=…` | read | Compare selected candidates |
| GET | `/api/research/summary` | read | Dashboard and capital warning |
| GET / PATCH | `/api/research/settings` | read / manage | Organization thresholds |
| POST | `/api/research/candidates/:id/create-product` | evaluate | Transactional approved conversion |

All routes require authentication and `x-organization-id`.

## Running and testing

```sh
npm run db:migrate
npm run verify
```

Research API tests cover Quick Capture, quantity quotes, marketplace histories, planned-vs-observed prices, selected-supplier economics, flexible sample transitions, decisions, permissions, organization isolation, and atomic/non-duplicate conversion. Client tests cover Quick Capture, same-price quantity UX, marketplace/planned-price separation, the sample checklist, calculator request/results, comparison selection, and Arabic business-term definitions.

Sales, Orders, Accounting, marketplace APIs, and Noon API integration remain out of scope.
