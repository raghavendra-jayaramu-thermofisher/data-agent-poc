---
title: Thermo Fisher APJ — Order Holds & Compliance
scope: datasource
---

## Order restrictions

An outstanding order may have stock available but still be unable to progress to shipment because of a commercial, operational, or regulatory restriction. **Stock availability and permission to ship are separate conditions.**

| Concept | Business meaning |
|---|---|
| **Order hold** | A restriction on order processing or release until an identified issue is addressed. A hold code indicates a reason or category; not every recorded code necessarily represents a blocking hold. |
| **Credit hold** | A restriction pending credit-related checks or approval, such as a credit-limit or payment-status issue. Clearance is distinct from physical stock availability. |
| **Customer / operational hold** | A non-credit restriction involving order instructions, customer-service review, documentation, logistics, or other processing requirements. The label *Customer Hold* does not necessarily mean the customer requested it. |
| **Stop code** | A separate restriction or control indicator. A stop code and a hold code can coexist on the same order and describe different issues. |
| **Compliance restriction** | A control associated with product, destination-country, licensing, or regulatory requirements. Goods should not be treated as eligible to ship until the applicable restriction is cleared. |

## New Zealand MPI compliance

**MPI** is New Zealand's **Ministry for Primary Industries**. In the APJ order context, stop code **`RIM`** denotes a restricted-item control associated with New Zealand and is used to identify potential MPI-related shipment restrictions. It is a **stop code, not an order hold code**, and its presence does not mean the order has passed regulatory clearance.

The applicability of a restriction may depend on the affected product or order line, destination, and its status at the reporting date. A historical `RIM` association alone does not establish that every open line on the order is currently restricted.

## Hold lifecycle and interpretation

- A hold can be **initiated, reviewed, released, or reapplied**. A release timestamp applies to the recorded hold event; it does not automatically prove a separate stop code was cleared.
- **Historical hold events and current restrictions are different evidence.** Determining whether an order was blocked on a particular date requires the relevant status and effective-time evidence.
- Multiple restrictions can apply simultaneously. The same outstanding value should not be counted more than once in an additive breakdown unless the categories have an agreed, mutually exclusive classification.
- A missing, blank, or unknown code is not definitive proof that no restriction exists. Code descriptions and blocking significance depend on the applicable business-code definitions.
- Resolving a restriction makes an order **eligible to progress**, not necessarily shipped, invoiced, or recognized as revenue.
