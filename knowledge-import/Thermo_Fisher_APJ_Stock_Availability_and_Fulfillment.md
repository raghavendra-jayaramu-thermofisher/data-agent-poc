---
title: Thermo Fisher APJ — Stock Availability & Fulfillment
scope: datasource
---

## Stock availability

Stock availability describes how outstanding customer-order demand is covered by inventory in the **fulfilling distribution center (DC)** or by incoming supply. Stock at a factory or supplier is not automatically available for immediate shipment from the DC.

| Concept | Business meaning |
|---|---|
| **Stock Available** | The reporting classification indicates sufficient or partial stock coverage, or an order already progressing through fulfillment. It can include lines with restrictions; it does **not** by itself guarantee that the entire order can ship immediately. |
| **In Transit** | Supply has been shipped on a transfer/intercompany order but has not yet been recorded as received at the destination DC. It is a separate operational category, **not locally available stock**. |
| **Stock NOT Available** | Outstanding demand without adequate stock coverage under the reporting classification. It may require replenishment, production, or a future supply commitment before fulfillment can proceed. |

**Coverage versus readiness:** Full, partial, and no-stock coverage describe inventory relative to an order line's remaining quantity. An available-stock classification may still coexist with a hold, compliance restriction, future shipment date, or incomplete processing. High-level stock indicators can also group some transit-covered lines with available stock; the **detailed classification** distinguishes actual operational categories.

## Inventory movement and fulfillment

- **Transfer shipment:** When supply ships from a factory or hub toward a DC, it enters **In Transit** in the inventory process.
- **Goods receipt (GR):** After receiving and checking the goods, the warehouse posts receipt in the E1 ERP system. This transaction moves the recorded inventory from **In Transit** to **Stock Available** at that DC.
- **Customer fulfillment:** Local stock coverage alone does not establish shipment. Order restrictions must be cleared and applicable scheduling, picking, packing, and dispatch steps must be completed.
- **Made-to-stock (MTS):** Some orders can use inventory already held at the DC; they need not pass through a new transfer-and-receipt cycle.

## Interpretation boundaries

- Available and in-transit quantities are **inventory-pool inputs**, not necessarily stock reserved for a specific customer. The same pool can support multiple order lines; repeated quantities must not be added across those lines as if independently allocated.
- The same SKU can have different availability in different DCs or fulfillment branches. Availability is **time-dependent**; current balances do not prove historical stock positions.
- An in-transit balance does not prove physical arrival, overdue GR, or a warehouse failure. Shipment tracking, arrival evidence, and ERP receipt records are needed to establish the cause.
- **Goods receipt, customer shipment, invoicing, and revenue recognition are distinct events.** A promised or scheduled date is not proof that an event occurred.
