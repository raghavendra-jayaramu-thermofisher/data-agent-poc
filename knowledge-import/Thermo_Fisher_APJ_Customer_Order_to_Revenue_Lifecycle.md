---
title: Thermo Fisher APJ — Customer Order-to-Revenue Lifecycle
scope: datasource
---

## Business objective

Commercial Operations monitors **outstanding customer orders (backlog)** to identify fulfillment delays, prioritize action, and help convert open demand into shipment and ultimately revenue. A large backlog is not inherently bad: it may reflect strong demand, delayed supply, or orders waiting to be processed. The operational question is **what is preventing an order from progressing?**

## Conceptual order lifecycle

| Stage | Meaning and operational significance |
|---|---|
| **1. Customer demand / purchase order** | A customer requests products or services, sometimes using a customer purchase order (PO). The customer PO is an external reference; it is not the Thermo Fisher sales-order identifier. A PO is not confirmed as mandatory for every sales channel. |
| **2. Sales order creation** | Thermo Fisher records an order, potentially with multiple product/service lines, quantities, values, and customer-requested dates (CRD). The **order creation date** is useful for identifying newly entered orders. A *newly created order still open at a snapshot* is not the same as all bookings made during the period. |
| **3. Open order / backlog** | Unfulfilled order-line quantities and values remain outstanding and may recur across successive snapshots. Backlog is potential future fulfillment, **not** shipment, invoicing, or recognized revenue. Customer-requested dates and planned/committed dates support overdue and timing analysis. |
| **4. Supply and stock coverage** | An order may be covered by stock at the fulfilling distribution center (DC), partially covered, awaiting incoming inventory, or awaiting production/replenishment. A stock-coverage label alone does not prove that goods are allocated exclusively to that order or are ready to ship. |
| **5. Inbound movement and goods receipt** | Where supply moves from a factory or hub to the destination DC, it may be **In Transit** until recorded as received. Posting **goods receipt (GR)** in E1 is a distinct event from the transfer shipment. In-transit goods are not yet physically available for local warehouse shipment; made-to-stock orders may already have local stock and skip this inbound cycle. |
| **6. Order release and fulfillment** | Even with stock, a line may remain open because of credit/customer/operational/compliance restrictions, future scheduling, or incomplete processing. Warehouse picking, packing, dispatch preparation, and handoff to the carrier are distinct stages. A planned ship/pick date or processing-status label is not proof of shipment. |
| **7. Shipment and downstream financial events** | Confirmed customer shipment is separate from backlog classification. Invoicing and revenue recognition are further business/accounting events; **their precise trigger, order, timing, and system of record have not been verified** for this project. Shipment does not by itself establish recognized revenue. |

**Conceptual sequence:** Customer request/PO (where applicable) → Sales order → Open backlog → Supply/stock availability and order clearance → Pick/pack/dispatch → Customer shipment → Invoice/revenue processing (subject to applicable finance policy).

## Order-processing status interpretation

`current order status` and `next order status` describe ERP workflow stages, **not** a complete transaction or shipment audit. The following codes and descriptions come from the earlier backlog knowledge; they are representative stages rather than proof that a physical or financial event has occurred.

| Code / range | Operational meaning |
|---|---|
| **521–525** | EDI/order review, compliance checks, and acknowledgment; `525 - Print Acknowledgement` is **not** invoice printing. |
| **526–529** | Genomic manufacturing-site selection, preparation, transmission to manufacturing, and synthesis/retry. |
| **534–548** | Service waiting, picking/control pick, and transfer toward warehouse processing; `537 - Print Control Pick` and `548 - Trf to WMS` are intermediate workflow statuses. |
| **550–570** | Shipping-document preparation, packing confirmation, and dispatch-note stages. `565 - Pack Confirmation` and `570 - Print Dispatch Note` indicate advanced fulfillment processing, **not independently confirmed carrier handoff**. |
| **572, 574, 575, 584, 586** | Drop-ship waiting, other waiting stage, transfer-price update, inventory update, and cycle billing respectively. |
| **588 - Print Invoice** | Post-shipment invoicing-stage status in the historical reporting convention; it does **not** establish that an invoice was issued or revenue recognized. Reporting exclusions and exceptions are defined separately in **Backlog Reporting & Analysis Rules**. |
| **900, 902, 904, 912, 914** | Backorder-related processing codes seen in `current order status`, concerning order entry, commitments, or shipment confirmation; not equivalents of `N1`/`N2` stock categories. |

**Historical representation:** From May 26, 2025, `current order status` generally appears as a numeric code, while `next order status` retains a `code - description` label. Older extracts can use different representations; compare codes carefully. A processing milestone, especially one containing the word **Print**, must not be treated as independently verified shipment, invoicing, or revenue recognition.

## How Commercial Operations interprets backlog

- **Overdue, stock available, still open:** Investigate hold/stop controls, planned dates, warehouse-processing stage, and time since stock became available. Stock availability raises a fulfillment question; it does **not** prove that Customer Service failed to act.
- **Waiting for inventory:** Identify whether supply is unavailable, being replenished, or in transit. In-transit inventory must not be treated as physically available at the destination DC.
- **Committed to ship but still open:** Compare the relevant commitment/planned date with actual processing and shipment evidence; a missed commitment is a risk signal, not proof of its cause.
- **Backlog falling week over week:** Could reflect shipments, cancellations, adjustments, reduced new demand, or changes in reporting population. Do **not** label the decline automatically good or equate it with revenue.
- **Backlog growing week over week:** Could reflect increased incoming demand or slower fulfillment. Assess both new-order additions and order progress before interpreting performance.

## Evidence and interpretation boundaries

- **Stakeholder-established objectives:** Identify aged orders with stock but no confirmed shipment, orders waiting for inventory, and orders with upcoming/missed shipping commitments; prioritize material backlog exposure and responsible follow-up.
- **Source-observable states:** Open backlog, request and planning dates, stock classifications, hold indicators, and some fulfillment-stage statuses. These support prioritization, **not** an end-to-end transaction audit.
- **Not yet established:** A universal customer PO-to-sales-order workflow; full procurement/replenishment rules; confirmed shipment/cancellation event coverage; invoice posting; payment collection; or the finance policy and evidence needed to calculate realized revenue.
- The available backlog snapshots cannot by themselves establish **why** an order disappeared or **how much revenue** was recognized. Use actual event/finance records for those conclusions when available.

**Basis:** Stakeholder backlog-review discussion and the existing *Backlog & Order Concepts*, *Stock Availability & Fulfillment*, and *Order Holds & Compliance* knowledge. The lifecycle is a **business-oriented working model**, not an approved Thermo Fisher order-to-cash standard operating procedure.
