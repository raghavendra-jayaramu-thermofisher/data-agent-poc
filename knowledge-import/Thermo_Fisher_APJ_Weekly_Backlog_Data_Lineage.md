---
title: Thermo Fisher APJ — Weekly Backlog Data Lineage
scope: datasource
---

## Source relationship

`dbo.WoWBacklogRawData` stores dated, enriched **weekly** backlog observations (`as_of_date`). `dbo.LSG_BACKLOG_SPOT_DAILY_REPOSITORY` stores historical **daily** backlog captures (`as of date`); `dbo.LSG_BACKLOG_SPOT_DAILY` is the daily feed without a stored snapshot-date field.

A filtered daily repository population reproduces the **base order-line observations** in four tested weekly snapshots. The weekly table is **not a literal subset or column-for-column copy** of the daily table: it adds classifications and other enrichments, transforms source values, and has a documented duplicate exception. The physical process loading the weekly table from upstream systems has **not been confirmed**. A Power BI query referencing the daily feed does not establish that this query writes the weekly table.

## Observed base-population selection

The supplied Power BI `Backlog_Main` definition and read-only row comparisons support the following *reconstruction* logic:

1. Start from a selected historical daily snapshot.
2. Retain `order type code` in `Direct Factory`, `SO`, `SE`, `SR`, `ZIOR`, `ZSDO`, `ZRWC`, `ZSP`, `TC` (the model's Core scope). `Direct Factory` did not occur in the tested extracts.
3. Exclude **only** `TC` records with `next order status = 588 - Print Invoice`. Other order types at status `588` remain eligible.
4. Exclude records whose `next order status` begins with `620`.
5. Apply the model's explicit order-number exclusions and `country code = 19` exclusion. These are source-model exceptions, not universal business-policy rules.

**Reason for the `TC`/`588` selection:** In the earlier backlog conventions, `588 - Print Invoice` represents an invoicing-stage order treated as already shipped or no longer awaiting fulfillment. Excluding `TC` rows at that stage prevents those rows from entering the reconstructed weekly **base population**, consistent with the supplied Power BI source filter. **The precise business reason for limiting this exclusion to `TC` is not documented**; this explanation is an interpretation of the status and model behavior, not a confirmed policy. Importantly, other types—including `SO` and `SR` at `588`—can remain in the weekly source population. A separate *standard backlog report* may exclude **all** `588` rows, while the aged-order view retains them; those are downstream reporting decisions, not source-lineage rules. Status `588` alone does not prove an invoice was posted or revenue was recognized.

The 16 source-model excluded order numbers are: `10256576`, `7736016`, `1859330`, `1855187`, `1843611`, `1842918`, `1830085`, `73945151`, `74029823`, `10304225`, `10304280`, `10305534`, `10305516`, `10305014`, `10298232`, `10304510`. Only eight of these affected the four compared snapshots; country `19` removed no further tested records. **Revalidate exceptions if the Power BI model changes.**

No additional NZ-only, division-only, quarter, positive-amount, backorder-flag, or stock-availability filter was needed for this four-snapshot **base-population** match.

## Verified weekly-to-daily snapshot correspondence

| Weekly `as_of_date` | Compatible repository `as of date` | Weekly rows | Matched daily occurrences | Exception |
|---|---|---:|---:|---|
| 2026-09-28 | 2026-09-28 **or** 2026-09-25 | 24,645 | 24,645 | None observed |
| 2026-10-05 | 2026-10-05 | 22,410 | 22,408 | Two extra weekly occurrences |
| 2026-10-12 | 2026-10-12 | 21,805 | 21,805 | None observed |
| 2026-10-19 | 2026-10-17 **or** 2026-10-18 | 22,176 | 22,176 | None observed |

The paired September and October daily alternatives above produced equivalent filtered base records. This **does not establish which daily capture the actual load selected**. October 19 daily data would instead yield 22,306 filtered rows, so **a weekly Monday label cannot be assumed to refer to Monday's daily capture**. Do not infer a fixed weekend, lag, or refresh schedule from these four observations.

Across the four weekly snapshots, 91,034 row occurrences match one-to-one; the other two are extra copies in the October 5 weekly extract. These are observational reconciliation results, **not reusable backlog totals**.

## Missing and repeated weekly snapshots (2026)

The weekly `as_of_date` is generally a Monday snapshot label; **2026-01-01 is a non-Monday exception**. Historical source notes identify these **repeated base-data snapshots**, where order lines and amounts reflect the preceding available snapshot even though derived fields may have refreshed:

| Weekly label with repeated base data | Earlier snapshot it repeats |
|---|---|
| `2026-02-02` | `2026-01-26` |
| `2026-03-02` | `2026-02-23` |
| `2026-04-27` | `2026-04-20` |
| `2026-07-13` | `2026-07-06` |

**Missing weekly snapshot labels:** `2026-02-09` and `2026-05-25`. These dates have **no weekly rows**; this does not mean backlog was zero.

**Evidence:** The earlier full-history study describes the four base-data repeats. A current read-only check confirmed that each listed pair has the **same row count and summed `amount p$`**, and that the two missing dates are absent from available 2026 snapshot labels. Equal aggregates corroborate the findings but **do not independently establish row-by-row equality** or why an extract was repeated.

**Analytical effect:** Do not interpret a repeated week as proof of zero bookings, zero shipments, or unchanged underlying operations. Avoid repeat-data snapshot pairs when deriving new-versus-closed line flows; if comparing the next genuinely refreshed extract to an earlier one, state the **actual interval**. Use the preceding *available* snapshot for ordinary date navigation, but do not automatically treat that pair as a valid seven-day operational change. A missing snapshot is a data gap, not a business event.

## Granularity, matching, and transformations

- **Grain:** Backlog order-line observation per snapshot, potentially with repeated order-line keys. The combination of snapshot, order, item, SKU, company, order type, and branch is a useful matching candidate, **not a guaranteed unique key**. Source rows can contain legitimate positive/negative adjustments sharing the same order-line identifiers.
- **Matching:** Compare order number, order item, SKU, company, order type, and branch, then validate quantity and amount. Numeric-looking source identifiers may be zero-padded or formatted differently; normalize **for comparison only** and retain original identifier text in outputs.
- **Row multiplicity:** Count matched occurrences rather than using a raw many-to-many join or indiscriminate `DISTINCT`. On 2026-10-05, order `1133082`, items `1000` and `5000`, appears twice per item in weekly data versus once each in daily data. The reason remains unknown.
- **Observed field normalization:** Weekly representations differ in company-code formatting, punctuation in selected names, blank-versus-`?` hold codes, blank product class, and some SKU, customer PO, and ship-to identifiers. These are observed correspondences, **not a verified specification of every transformation**.
- **Amount caveat:** Some daily `amount p$` strings use scientific notation; direct decimal conversion reproduces NULL values seen in the weekly extracts. The 4-snapshot counts were 17, 27, 19, and 17 respectively. Raw source amounts should be preserved for independent validation; this apparent conversion loss is **not** a recommended calculation rule.

## Weekly-only enrichment

The weekly table contains saved or derived fields such as `region`, `CRD_Status`, `Final_CRD`, `N1`, `N2`, `Stock_Common`, `FinalOrderReleaseDate`, `ScheduledPickDate`, `New_Branch_Code`, `Inv_available_Qty`, and `Inv_intransit_Qty`. The daily repository does **not** supply all of these values. Power BI definitions reference additional order, inventory, product, and planner sources, but the complete historic enrichment pipeline is not verified.

For historic weekly reporting, prefer the **stored weekly classifications** instead of claiming that daily raw records can recreate them exactly. Refer to **Backlog & Stock Classification Logic** for classification definitions, and **Core Data Sources & Relationships** for cross-source joining limitations.

## Evidence and interpretation

**Validated:** Four weekly/daily filtered populations; matching order-line observations, selected field transformations, date-pair equivalence, and the October 5 duplicate anomaly. Separately, read-only historical snapshot aggregates corroborate the four repeat-date pairs and two missing 2026 snapshot labels. Evidence: `Weekly_Daily_Backlog_Audit.md`, `Weekly_Backlog_Source_Reconstruction.sql`, and supplied `Backlog_Main.tmdl`.

**Not verified:** Actual scheduled ETL lineage or timing, all enrichment formulas and historical lookup states, the cause of duplicate or repeated data, the precise business rationale for the `TC`-only invoice-status exclusion, and whether the same reconstruction rules cover earlier/future periods. Treat the steps above as **tested reconstruction logic**, not as a confirmed production ETL specification.
