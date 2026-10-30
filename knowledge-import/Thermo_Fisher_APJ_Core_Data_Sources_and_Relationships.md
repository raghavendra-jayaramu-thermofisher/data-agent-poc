---
title: Thermo Fisher APJ — Core Data Sources & Relationships
scope: datasource
---

## Core data sources

| Table | Description |
|---|---|
| `dbo.WoWBacklogRawData` | Weekly backlog observations identified by `as_of_date`. Contains order-line quantities and values plus enriched reporting fields such as `CRD_Status`, `N1`, and `N2`. The apparent snapshot–order–item–SKU grain is **not guaranteed unique**. |
| `dbo.LSG_BACKLOG_SPOT_DAILY` | Daily operational backlog feed with order, customer, product, status, quantity, and value information. Unlike the historical repository, this table has no stored snapshot-date column. |
| `dbo.LSG_BACKLOG_SPOT_DAILY_REPOSITORY` | Historical captures of daily backlog, distinguished by `[as of date]`. Supports analysis of specific past dates; it contains raw backlog attributes but not the weekly table's enriched stock classifications. |
| `dbo.APJ_Holds_TY_Main` | Historical order-hold events with `Hold Code`, `Stop Code`, and hold initiation/release timestamps. The data can contain multiple records per order and has no order-item or SKU key; it is **not** an authoritative snapshot of active stop codes. |
| `dbo.HoldCodeMapping` | Small code-description reference containing `CS Hold Code` and `L3_Descriptions`. It may clarify compatible hold codes; correspondence with other tables' code domains must be checked. |

## Supporting data sources

| Table | Description |
|---|---|
| `dbo.E1_Prod` | E1 order-line details, including requested and scheduled-pick dates. Order/line/branch identifiers support matching to backlog; a reliable historical effective date is not established for all records. |
| `dbo.MIDB_Total_Inventory` | Available, in-transit, and other inventory quantities by SKU, branch, and inventory-location/lot context. It has no snapshot-date column, and its quantities are not exclusive allocations to individual customer-order lines. |
| `dbo.APJ_ATP_TY_Main` | Order-line extract containing `Stop Code`, `Stop Description`, hold information, and order/shipment-related attributes. Useful for investigating restrictions, but its historical coverage and active status for a requested date require validation. |

## Essential field roles in weekly backlog

The following names refer to `dbo.WoWBacklogRawData` fields; equivalent fields in other sources may use different names.

| Role | Fields and distinction |
|---|---|
| **Selling entity** | `company code`, `company name`, and `hfm entity` identify the Thermo Fisher legal/selling entity, **not** the customer. Validate company and order type when matching order numbers across sources. |
| **Customer vs delivery site** | `customer name` represents the customer; `customer po number` is the customer's external PO reference. `ship to name` and `ship to number` identify the receiving/delivery site and need not identify the same entity as the buyer. |
| **Destination geography** | `country code`, `country name`, and `region` organize the destination/reporting geography; do not infer it from the selling company's name. Consult **Low-Cardinality Values** for exact stored region codes. |
| **Product classification** | `product class` is a broad product type; `dsr product summary`, `dsr level 1`, `dsr level 2`, `dsr level 5`, and `dsrProductSubGrouping` provide different sales/product grouping levels. `hfm custom 2` is a finance classification. Do not treat these as synonyms. |
| **Supply and manufacturing** | `branch code` denotes the order-processing branch, whereas `New_Branch_Code` is the fulfillment stock-pool branch used for inventory/factory lookup. `MFG` and `MFGSiteDescription` describe manufacturing-site information; a manufacturing site is not necessarily the fulfillment branch. |
| **Processing state** | `current order status` and `next order status` are workflow status fields, distinct from stock availability (`N1`/`N2`) and hold codes. A status label alone does not prove a shipment or invoice event; see **Customer Order-to-Revenue Lifecycle**. |

## Logical relationships

| Sources | Relationship and limitation |
|---|---|
| Daily feed ↔ daily repository | Share the underlying daily backlog structure; the repository additionally records snapshot dates. The exact archive/refresh mechanism has not been verified. |
| Daily repository ↔ weekly backlog | Selected daily populations reproduce the **base** weekly order-line records after filtering and normalization, with some duplicate exceptions. Weekly data also has enrichments, and its `as_of_date` need not equal the underlying daily capture date. Direct ETL lineage is unconfirmed. |
| Backlog ↔ hold history | Match by sales order, order type, and **normalized company code** (and validate country). Hold history can be one-to-many and is order-level; a historical match does not establish an active restriction or identify every affected line. |
| Backlog ↔ E1 / ATP order lines | Order number and line number are candidate identifiers; validate company, order type, branch, and SKU as applicable. Check uniqueness before joining to avoid multiplying backlog value. |
| Backlog ↔ inventory | SKU and the **relevant fulfillment-stock branch** link order demand to inventory context; this may differ from the order's processing branch. Inventory may span multiple locations/lots and must not be summed across customer-order lines. |
| Hold codes ↔ descriptions | `HoldCodeMapping` provides descriptions only when the code domains correspond. **Hold Code** and **Stop Code** are different attributes and must not be used interchangeably. |

**Data-model boundary:** These are observed or candidate logical relationships, not declared foreign keys. Physical schemas did not expose enforced primary-key or foreign-key relationships for these sources.
