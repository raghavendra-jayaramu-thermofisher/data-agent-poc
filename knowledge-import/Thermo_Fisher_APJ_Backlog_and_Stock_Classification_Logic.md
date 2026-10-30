---
title: Thermo Fisher APJ — Backlog & Stock Classification Logic
scope: table
key: dbo.WoWBacklogRawData
---

## Classification layers

| Field / classification | Role |
|---|---|
| `Stock_Common` | Source-level stock-coverage indicator, with values such as `Stock Available`, `Partial Stock`, `In Transit Available`, `No Stock Available`, and `No Info`. It is an input to detailed classification, **not** the final reporting group. |
| `N1` | Broad, upstream-supplied classification: `Stock Available` or `Stock NOT Available`. `N1 = Stock Available` can include lines later reported as **In Transit**; it does not establish immediate warehouse availability. Its upstream calculation has **not** been verified. |
| `N2` | Detailed classification calculated in the supplied Power BI `Backlog_Main` model using `N1`, order hold code, stock indicators, order-processing status, product attributes, and planned dates. Weekly data also stores historical `N2` values. |
| `N2 (groups)` | Reporting-level grouping of detailed `N2` labels into **Stock Available**, **In-Transit**, and **Stock NOT Available**; blank values remain separate. |

## Line-level stock coverage (`Stock_Common`)

`quantity` is the open demand of an order line. `Inv_available_Qty` and `Inv_intransit_Qty` are inventory coverage inputs in that line's fulfillment context; **in-transit** supply is not yet locally available until the relevant goods receipt is recorded. The older knowledge describes these **provisional upstream interpretations**:

| Stored `Stock_Common` value | Coverage interpretation |
|---|---|
| `Stock Available` | Available inventory **or the combination of available and in-transit inventory** covers the line's open quantity. This label can therefore include transit-dependent coverage; it does **not** independently establish immediate shippability. |
| `In Transit Available` | No on-hand coverage, but in-transit inventory covers the open quantity. |
| `Partial Stock` | Some, but not all, of the open quantity is covered by the inventory inputs. |
| `No Stock Available` | Neither available nor in-transit inventory provides identified coverage. |
| `No Info` | No usable inventory record or coverage information is available; **unknown is not zero**. |

These descriptions explain the historical business interpretation; the **exact upstream formula and precedence when conditions overlap have not been independently verified**. Prefer the stored `Stock_Common` value over reconstructing it. This section does not change the separate saved `N1` or Power BI-defined `N2` classifications.

## Shortage indicators

The earlier core-rules knowledge defines the line-context difference:

`InvMapdiff = quantity - Inv_available_Qty - Inv_intransit_Qty`

For an ordinary positive-demand line, a **positive** result indicates demand not covered by the *combined* available and in-transit quantities; **zero** indicates exact combined coverage; and a **negative** result indicates combined inputs exceeding that line's demand. Because the formula includes in-transit inventory, a nonpositive result **does not imply immediately shippable stock**.

`InvMapdiffK` is identified in the earlier knowledge as a **kit-specific shortage indicator** associated with `stocking type code = K`. Its exact upstream expression, kit-component handling, and applicability are **not independently verified**; do not assume it is identical to `InvMapdiff` or compute it from an invented formula.

**Calculation safeguards:** The stored quantity and difference columns are text. Check numeric validity before arithmetic and preserve missing or nonnumeric values as unknown rather than treating them as zero. Available/in-transit quantities may be repeated across lines for the same SKU/branch context; they must **not** be summed as independent inventory balances or interpreted as reservations. A shortage signal alone does not establish a purchasing requirement, shipment status, or allocation priority.

## Detailed `N2` logic (Power BI model-defined)

### When `N1 = Stock Available`

The model treats `order hold code` **blank, `A`, `C`, or `D`** as its *clean* branch:

- **Clean Full Stock:** The normalized next order status is at least `588`, is within `538–570` or `575–587`; **or** `Stock_Common` is `No Info` or `Stock Available`; **or** the model's specified GSD-instrument condition applies.
- **Clean Partial Stock:** If none of the preceding full-stock conditions applies and `Stock_Common = Partial Stock`.
- **Clean Transit:** Otherwise. This is a **fallback classification**, so its label alone does not prove a physically tracked transfer shipment.

For other hold codes (the *unclean* branch):

- **Unclean Transit:** Hold code `B`, `C1`, `C2`, or `C3`, **and** either `Stock_Common = In Transit Available` or `IntransitStatus = True`.
- **Unclean - Credit Hold:** Hold code `B`, `C1`, `C2`, or `C3`, without the transit condition above.
- **Unclean - Customer Hold:** All remaining non-clean hold codes.

Here, **Clean/Unclean describes the hold-code logic of this reporting model**, not a comprehensive compliance-clearance or ship-readiness decision. A stock-available order can still be blocked by credit or customer restrictions. `Order Hold Type` uses the same broad grouping: credit (`B`, `C1`, `C2`, `C3`), no classified hold (blank, `A`, `C`, `D`), or customer hold (other codes).

### When `N1 = Stock NOT Available`

The model first distinguishes **instrument** versus **consumables/other** orders. Instrument identification uses a combination of product class, product hierarchy, selected order types, SKU prefixes, and product-name patterns; it is **not limited** to `product class = INSTRUMENT`.

- **Valid planned date:** `Final_OrderReleaseDate` (derived planned delivery/release date, or *PDD*) determines the **Current Quarter** or **Future Quarter** commitment label, such as `Cons-Committed in Current Qtr Q4` or `Instruments Committed in Future Qtr`.
- **Missing/placeholder PDD:** Consumable orders generally receive a *To Be Committed* label, distinguished by credit versus non-credit hold. Instrument orders with a non-clean hold and no valid PDD may receive `Instruments To Be Committed`.
- **Quarter basis:** The model uses fiscal-quarter lookups, with calendar-quarter fallback where the fiscal date is absent. Its calculated columns reference `TODAY()`; they are **not inherently anchored to a historical backlog snapshot**.

A *Committed* label describes the model's planning/date classification, **not** proof that inventory is physically available, received, allocated exclusively to the order, or shipped. The source DAX contains a one-off order-number exception; that exception is **not** a general business classification rule.

## Three-group reporting map (`N2 (groups)`)

| Report group | Exact detailed `N2` labels included |
|---|---|
| **Stock Available** | `Clean Full Stock`; `Clean Partial Stock`; `Unclean - Credit Hold`; `Unclean - Customer Hold` |
| **In-Transit** | `Clean Transit`; `Unclean Transit` |
| **Stock NOT Available** | All other nonblank `N2` labels, including committed/to-be-committed supply categories |
| **(Blank)** | Missing `N2`; keep separate rather than silently allocating to a stock group |

In one Power BI trend table, the fallback label is `Stock NOT Available (Other)` instead of `Stock NOT Available`; the underlying grouping is the same.

**Physical availability distinction:** In-transit supply has not yet been recorded as received by the destination distribution center. For **three-way reporting**, keep In-Transit separate; when assessing **stock physically available for immediate local fulfillment**, treat in-transit as **not yet locally available**. Do not count the same line in both In-Transit and Stock Available in a three-way total.

## Usage and evidence boundaries

- For weekly historical reporting, **use the saved snapshot's `N1`/`N2` classifications** when available. Recomputing the current Power BI DAX on a past snapshot can change quarter-relative labels because it uses `TODAY()`.
- `dbo.LSG_BACKLOG_SPOT_DAILY_REPOSITORY` holds historical raw daily backlog; it does **not** carry all weekly enriched `N1`/`N2` classifications. Do not claim to recreate them exactly from raw daily columns alone.
- Stock/availability quantities may be repeated across order lines for the same SKU and branch; they are **not necessarily order-specific reservations**. Classification does not prove how many lines can all ship simultaneously.
- For the complete stored categorical vocabulary (including historical `Allocated` labels), use the **Low-Cardinality Value Reference**. That vocabulary is not an alternative classification formula.

**Evidence:** `Backlog_Main.tmdl` calculated columns (`N2`, `Order Hold Type`, `N2 (groups)`) and weekly trend-model grouping definitions from the supplied Power BI export. `N1`, `Stock_Common`, and `IntransitStatus` are source columns in that model; their upstream ETL derivations and the formula's applicability to every historical extract remain **unverified**.
