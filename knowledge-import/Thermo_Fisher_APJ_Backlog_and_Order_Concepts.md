---
title: Thermo Fisher APJ — Backlog & Order Concepts
scope: table
key: dbo.WoWBacklogRawData
---

## Orders and outstanding demand

| Concept | Business meaning |
|---|---|
| **Sales order** | Thermo Fisher's record of customer demand. One sales order can contain multiple order lines; the customer's purchase-order reference is a different identifier. |
| **Order line** | A particular product or service and its outstanding quantity, value, dates, and processing status. Partial fulfillment can reduce a line's open balance or result in additional split lines. |
| **Backlog** | Customer-order demand still recorded as outstanding at a reporting point. It represents potential future fulfillment and revenue, **not completed shipment, invoicing, or realized revenue**. |
| **Open quantity and value** | The remaining quantity and monetary balance of an order line, rather than necessarily the original amount ordered. Adjustments and credits can produce negative values. |
| **Snapshot** | A dated view of outstanding demand. The same line may appear in successive snapshots; those appearances are not separate orders or bookings. |
| **Backorder** | An ERP processing condition that is distinct from the wider backlog population. A backorder indicator alone does not determine stock availability or fulfillment readiness. |

## Dates and reporting classifications

- **Order creation date:** When the sales order was entered; different from when the customer wants delivery or when fulfillment is expected.
- **Customer requested date (CRD):** The date requested by the customer for the order line. An outstanding line with a CRD earlier than the reporting date is **overdue (aged by CRD)**.
- **Promised date / planned release date (PDD):** The working date for expected release or fulfillment. It can differ from CRD and may be derived from planning information; it is **not proof of actual shipment or customer delivery**. A past PDD and a past CRD describe different delays.
- **Current-quarter backlog:** Outstanding lines whose CRD falls in the reporting fiscal quarter **or an earlier period**, including overdue requests. **Future-quarter backlog** has a CRD later than the current fiscal quarter. Fiscal boundaries follow the separate Fiscal Calendar knowledge.
- **New orders vs carried forward:** Of the orders still outstanding in a reporting snapshot, **New** means created within the agreed reporting interval; **Carried Forward** means created before it. Carried forward does **not** necessarily mean overdue. This split is independent of current- versus future-quarter CRD.

## Derived dates and aging rules

The following derivations summarize the earlier backlog knowledge. **Use the stored derived fields when available** rather than recomputing from raw date strings; full upstream transformation/fallback precedence has not been independently established.

| Derived field | Derivation and interpretation |
|---|---|
| `Final_CRD` | Customer-requested date: use `requested date`; otherwise `order request date`; otherwise `order create date`, following the source's fallback logic. This is the working CRD for quarter classification and CRD aging. |
| `FinalOrderReleaseDate` | Working release/planning date (PDD), **not** the raw `order release date`. Start with a valid raw release date; if missing, placeholder (`1900-01-01`), earlier than order creation, considered stale/past, or unrealistically far ahead (more than five years), use a valid fallback from planner update, clearance, scheduled pick, promised dates, or `Final_CRD`. The precise fallback precedence and reference date for the stale-date test require upstream confirmation. |
| `ReferenceDateNew` | The **later of** `Final_CRD` and `FinalOrderReleaseDate`. It is the reference date for general backlog aging, whereas CRD aging uses `Final_CRD` alone. |

### Overdue definitions

- **Overdue order (by CRD):** `Final_CRD` is strictly **earlier** than the snapshot's `as_of_date`; this is the default meaning of "overdue order." 
- **Overdue PDD/release:** `FinalOrderReleaseDate` is strictly **earlier** than `as_of_date`. This identifies a past planned release date, not confirmed late customer delivery.
- A date **equal** to the snapshot date is not overdue under either definition. CRD overdue and PDD overdue are independent; neither proves a shipment occurred or was missed.

### Exact aging buckets

Calculate day differences using the relevant **weekly snapshot date** as the comparison date. The two stored categorical fields have **different reference dates and boundaries**:

| Bucket | `aging week`: days = `as_of_date` − `ReferenceDateNew` | `Aging week CRD`: days = `as_of_date` − `Final_CRD` |
|---|---:|---:|
| Not yet aged | `Nil`: days ≤ 0 | `Not Aged`: days < 0 |
| `1 Week` | 1–7 | 0–13 |
| `2 Weeks` | 8–14 | 14–20 |
| `3 Weeks` | 15–21 | 21–27 |
| `4 Weeks` | 22–28 | 28–34 |
| `5-8 Weeks` | 29–56 | 35–62 |
| `9-12 Weeks` | 57–84 | 63–90 |
| `More than 3 months` | ≥ 85 | ≥ 91 |

The `Aging week CRD` **`1 Week` bucket includes day zero**, although an order with a CRD equal to its snapshot date is **not yet overdue** under the strict overdue definition. In reporting, the Power BI aged-order view uses **`Aging week CRD`**, not `aging week` (see **Backlog Reporting & Analysis Rules**).

Invalid/placeholder dates (including `1900-01-01` and documented far-future sentinels) should not be interpreted as genuine business commitments. Report missing or unresolvable dates as unknown instead of silently making them current or overdue.

## Interpretation boundaries

- A line's reduced value or disappearance between snapshots can reflect fulfillment, cancellation, adjustment, or reporting changes; backlog movement alone does **not** confirm shipment or revenue.
- A line first appearing in a report is not necessarily a newly created sales order. Likewise, an order may contain several lines with different outstanding balances or statuses.
- Snapshot backlog captures demand **still open at that point**; it cannot establish the total bookings or shipments that occurred between snapshots without separate transaction evidence.
