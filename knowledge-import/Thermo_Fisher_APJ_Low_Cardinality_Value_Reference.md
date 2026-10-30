---
title: Thermo Fisher APJ — Low-Cardinality Values
scope: datasource
---

This is a **categorical-value reference**, not a closed list of permissible data. Values are exact stored strings unless noted. The weekly lists reflect observed `dbo.WoWBacklogRawData` history through **October 19, 2026**; daily status lists reflect the **October 19, 2026** repository capture; hold/stop codes reflect the queried `APJ_Holds_TY_Main` history. New values and changed codes may occur in later extracts.

## Geography and divisions

| Field in `WoWBacklogRawData` | Observed values |
|---|---|
| `division` (3) | `BID` · `CSD` · `GSD` |
| `region` (7 non-NULL) | `ANZ` · `SEA` · `Japan` · `Singapore` · `SouthAsia` · `SouthKorea` · `Taiwan` |
| `country code` (27) | `19` · `AS` · `AU` · `BD` · `BN` · `BT` · `FJ` · `ID` · `IN` · `JP` · `KH` · `KR` · `LA` · `LK` · `MM` · `MV` · `MY` · `NC` · `NP` · `NZ` · `PG` · `PH` · `SG` · `TH` · `TL` · `TW` · `VN` |

**Regional membership (weekly reporting):**

| Stored `region` | `country code` values |
|---|---|
| `ANZ` | `AU`, `NZ`, `FJ` |
| `SEA` | `VN`, `TH`, `ID`, `MY`, `PH`, `LA`, `KH`, `BN`, `MM`, `TL` |
| `SouthAsia` | `IN`, `BD`, `NP`, `LK`, `MV`, `BT` |
| `Japan` / `SouthKorea` / `Singapore` / `Taiwan` | `JP` / `KR` / `SG` / `TW`, respectively |
| SQL `NULL` region | `AS`, `NC`, `PG`, `19` in observed history |

`country name` (23 non-NULL weekly values): `AUSTRALIA` · `BANGLADESH` · `BHUTAN` · `BRUNEI DARUSSAIAM` · `CAMBODIA` · `FIJI` · `INDIA` · `INDONESIA` · `JAPAN` · `LAO PEOPLE'S DEMOCRAT REP` · `MALAYSIA` · `MALDIVES` · `MYANMAR` · `NEPAL` · `NEW ZEALAND` · `PHILIPPINES` · `SINGAPORE` · `SOUTH KOREA` · `SRI LANKA` · `TAIWAN` · `THAILAND` · `TIMOR LISTE` · `VIETNAM`.

The daily repository has different region fields (e.g., `hfm region group`); these must not be treated as identical to the weekly `region` strings.

## Backlog, stock, and date classifications

| Weekly field | Exact non-NULL values |
|---|---|
| `CRD_Status` | `Current Quarter` · `Future Quarter` |
| `order type` | `Current Order` · `Future Order` |
| `N1` | `Stock Available` · `Stock NOT Available` |
| `Stock_Common` | `Stock Available` · `In Transit Available` · `Partial Stock` · `No Stock Available` · `No Info` |
| `Order Hold Type` | `Credit Hold` · `Customer Hold` (also NULL) |
| `back order flag` | `Y` · `N` · `?` |
| `aging week` | `Nil` · `1 Week` · `2 Weeks` · `3 Weeks` · `4 Weeks` · `5-8 Weeks` · `9-12 Weeks` · `More than 3 months` |
| `Aging week CRD` | `Not Aged` · `1 Week` · `2 Weeks` · `3 Weeks` · `4 Weeks` · `5-8 Weeks` · `9-12 Weeks` · `More than 3 months` |
| `TypeGroup` | `Core` (observed constant) |
| `NAE_Priority` | `Record New` (observed constant in recent history) |

### `N2` — detailed stock classification (30 historically observed values)

**Stock-coverage / restriction labels (6):**  
`Clean Full Stock` · `Clean Partial Stock` · `Clean Transit` · `Unclean - Credit Hold` · `Unclean - Customer Hold` · `Unclean Transit`

**Committed labels (11, historical and current):**  
`Cons-Committed in Current Qtr Q1` · `Cons-Committed in Current Qtr Q2` · `Cons-Committed in Current Qtr Q3` · `Cons-Committed in Current Qtr Q4` · `Cons-Committed in Future Qtr` · `Cons-To Be Committed - Non Credit Hold` · `Instruments Committed in Current Qtr Q1` · `Instruments Committed in Current Qtr Q2` · `Instruments Committed in Current Qtr Q3` · `Instruments Committed in Current Qtr Q4` · `Instruments Committed in Future Qtr`

**Older Allocated-era labels (13):**  
`Cons-Allocated in Current Qtr Q1` · `Cons-Allocated in Current Qtr Q2` · `Cons-Allocated in Current Qtr Q3` · `Cons-Allocated in Current Qtr Q4` · `Cons-Allocated in Future Qtr` · `Cons-To Be Allocated - Credit Hold` · `Cons-To Be Allocated - Non Credit Hold` · `Instruments Allocated in Current Qtr Q1` · `Instruments Allocated in Current Qtr Q2` · `Instruments Allocated in Current Qtr Q3` · `Instruments Allocated in Current Qtr Q4` · `Instruments Allocated in Future Qtr` · `Instruments To Be Allocated`

`Allocated` labels are historical; `Committed` replaced them in December 2025. `N1`, `N2`, and `Stock_Common` are **different categorical fields**, not interchangeable value sets.

## Order processing and stocking

| Weekly field | Observed values |
|---|---|
| `order type code` (8) | `SE` · `SO` · `SR` · `TC` · `ZIOR` · `ZRWC` · `ZSDO` · `ZSP` |
| `line type` (4 nonblank) | `DS` · `DX` · `IS` · `S` (also NULL/empty) |
| `stocking type flag` (5 non-NULL) | `?` · `MTO` · `MTS` · `TS` · `Unknown` |
| `New Stocking Strategy` (9 non-NULL) | `Combo` · `Discon` · `MTO` · `MTS` · `Oligo` · `Others` · `Service` · `TS` · `Unknown` |
| `stocking type code` (24 non-NULL) | `H` · `L` · `T` · `K` · `1` · `Z` · `7` · `?` · `6` · `P` · `4` · `2` · `F` · `D` · `5` · `C` · `V` · `M` · `A` · `S` · `Y` · `9` · `3` · `G` (also NULL) |

**`next order status` — observed literal values (30):**

`000 - Unknown` · `521 - Review EDI/Uploaded Order` · `522 - Compliance Failed` · `523 - Compliance Check` · `525 - Print Acknowledgement / Send E` · `526 - Genomic: MFG Site Selection` · `527 - Genomic: Ready for MFG` · `528 - Genomic: Sent to MFG` · `529 - Genomic: In Synthesis or Retry` · `532 - Freight & Text Waiting status` · `534 - Service Waiting Status` · `536 - Genomic: Pickslip 1` · `537 - Print Control Pick` · `538 - Genomic: Clone Pickslip 2` · `548 - Trf to WMS` · `550 - Print Shipping Documents` · `557 - Intermediate for Dual Brand IS` · `565 - Pack Confirmation` · `568 - Pre-Pack Orders` · `570 - Print Dispatch Note` · `572 - Wait Status - Drop Ship` · `574 - Waiting stage` · `575 - Transfer Price Update` · `584 - INVENTORY UPDATE` · `586 - Cycle Billing` · `588 - Print Invoice` · `620 - Sales Update` · `831 - Invoice Error` · `?` · `? - Unknown`

Historical-only reported statuses include `532 - Freight & Text Waiting status`, `568 - Pre-Pack Orders`, `620 - Sales Update`, and `831 - Invoice Error`. `current order status` uses codes without descriptions in recent snapshots; observed backorder codes include `900`, `902`, `904`, `912`, `914`.

## Product categorization

| Weekly field | Observed values |
|---|---|
| `product class` (13 non-NULL/nonblank) | `ACCESSORY` · `CONSUMABLE` · `INSTRUMENT` · `OEM` · `OTHER` · `SERVICE` · `SERVICE BILLABLE LABOR` · `SERVICE CONTRACT` · `SERVICE PART` · `SERVICE QUALIFICATION` · `SERVICE TRAINING` · `SOFTWARE` · `Unknown` |
| `dsr product summary` (6) | `BID PRODUCTS` · `CSD PRODUCTS` · `FREIGHT+` · `GSD PRODUCTS` · `OEM` · `SERVICE` |
| `dsr level 1` (7 nonblank) | `BID NON-PRODUCTS` · `BID PRODUCTS` · `CSD NON-PRODUCTS` · `CSD PRODUCTS` · `GSD NON-PRODUCTS` · `GSD PRODUCTS` · `OTHERS` (also NULL/empty) |

## Daily backlog status vocabulary

The following are **October 19, 2026 observations** in `dbo.LSG_BACKLOG_SPOT_DAILY_REPOSITORY`, not asserted full-history enumerations.

| Field | Values |
|---|---|
| `backlog status` | `Waiting for stock` · `Waiting for shipment` · `Customer Service Hold` · `Credit Block` · `?` · `Unknown` · empty string |
| `apj backlog status` | `Waiting for stock` · `Waiting for shipment` · `Customer Hold` · `Logistics Hold` · `IT Hold` · `Customer Service Hold` · `Credit Block` · `Pricing Hold` · `?` · `Unknown` · empty string |
| `typeso` / `source system` / `record type` | `BACKLOG` / `EDW` / `A` respectively in this snapshot |

## Historical hold and stop-code vocabulary

Observed distinct codes across `dbo.APJ_Holds_TY_Main` (historical events; **not** current active restrictions):

| Field | Values |
|---|---|
| `Hold Code Type` | `Auto` · `Manual` |
| `Hold Code Category` | `OCT` · `non-OCT` |
| `Hold Code` (46) | `C1` · `C2` · `C3` · `CC` · `CE` · `CF` · `CM` · `CP` · `CR` · `CS` · `CX` · `DA` · `DK` · `ED` · `EI` · `EP` · `ER` · `HP` · `HS` · `IC` · `IN` · `IR` · `KC` · `KD` · `KE` · `KH` · `KK` · `KM` · `KP` · `LH` · `NT` · `PA` · `PX` · `QR` · `RH` · `RR` · `S2` · `SC` · `SE` · `SP` · `SQ` · `TX` · `WA` · `WI` · `WS` · `ZP` |
| `Stop Code` (82) | `020` · `022` · `024` · `039` · `045` · `053` · `055` · `061` · `062` · `065` · `067` · `069` · `100` · `102` · `103` · `?` · `BP1` · `C01` · `C02` · `C03` · `C04` · `C05` · `C06` · `C07` · `C09` · `C12` · `C14` · `C16` · `C20` · `C21` · `C23` · `C25` · `C26` · `C27` · `C28` · `C29` · `C31` · `C38` · `C42` · `C43` · `C44` · `C46` · `C49` · `DCI` · `DIV` · `IHC` · `K21` · `KBS` · `KDJ` · `KGJ` · `KHN` · `KIM` · `KJJ` · `KKP` · `KSE` · `KSI` · `KSO` · `MSH` · `N01` · `N02` · `N03` · `N04` · `N05` · `N23` · `N29` · `N30` · `N99` · `RIM` · `S01` · `S02` · `S04` · `S05` · `S08` · `S11` · `S12` · `S15` · `S17` · `SCH` · `TW1` · `TW2` · `TW3` · `URG` |

`Hold Code` and `Stop Code` are different fields and must not be conflated. `dbo.HoldCodeMapping` contains **104 observed `CS Hold Code` description entries**; its code domain is not identical to the hold-history domain. The code-description lookup is the appropriate source for detailed label meanings.

## Profile interpretation

- SQL `NULL` and an empty string are missing-value forms; literal `?`, `Unknown`, `No Info`, `000 - Unknown` and `? - Unknown` are **not** NULL. Empty strings occur in some older weekly snapshots.
- Counts describe **observed distinct values in the specified source and time range**, not global constraints, legal values, or guaranteed current coverage.
- High-change or higher-cardinality attributes (customers, orders, SKUs, company identifiers, branches, manufacturing/planner labels, and detailed product hierarchies) are intentionally not enumerated here; their actual values depend on the selected dataset and date.
