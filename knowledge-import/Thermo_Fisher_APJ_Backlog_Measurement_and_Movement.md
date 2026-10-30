---
title: Thermo Fisher APJ — Backlog Measurement & Movement
scope: table
key: dbo.WoWBacklogRawData
---

## Backlog measurement

`dbo.WoWBacklogRawData` contains open order-line observations by weekly `as_of_date`. An outstanding line may reappear in successive snapshots; each appearance is a dated balance, not a new order or booking.

| Measure | Meaning |
|---|---|
| **Backlog value** | Sum `amount p$` for the selected snapshot and eligible backlog population. The amounts are USD; valid negative balances may occur. |
| **Open order lines** | Count records at that snapshot. Repeated line identifiers or adjustments mean a record count is not necessarily a count of unique lines. |
| **Distinct orders** | Count distinct `order number` within the defined scope; check company/order-type identifiers if order numbers overlap across entities. |
| **Open quantity** | `quantity` is the remaining unfulfilled quantity, not necessarily the original ordered quantity. |

A backlog balance is **point-in-time**. Do not add values across snapshots to produce a single outstanding backlog total. The latest balance uses the latest available `as_of_date`; comparisons use the preceding available observation.

## Invoice-stage status

`588 - Print Invoice` denotes a post-shipment invoicing workflow stage under the established backlog convention. Such lines may still exist in the source but are **excluded when measuring standard unshipped backlog**. The status does not prove an invoice was posted or revenue was recognized. This business convention is distinct from the upstream selection of weekly source records.

## Changes in outstanding demand

- **New open demand** comprises orders created during the comparison interval that remain in backlog at the current snapshot; **carried-forward demand** was created earlier and remains open.
- A decrease or disappearance of an order line may reflect shipment, cancellation, partial fulfillment, adjustment, or line restructuring. Snapshot comparisons alone cannot establish which event occurred.
- A week-on-week difference measures **net change in outstanding backlog**, not confirmed bookings, shipments, invoicing, or revenue.
- Missing or repeated weekly captures can distort apparent movement; their known dates and evidence belong in **Weekly Backlog Data Lineage**.
