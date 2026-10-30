---
title: Thermo Fisher APJ — Default Backlog Reporting Rules
scope: datasource
---

## Always exclude Print Invoice (status 588)

For **every** backlog question, exclude order lines at **`588 - Print Invoice`** before calculating any backlog value, order-line count, or breakdown. These lines have already shipped and are only waiting for invoicing, so they are not unshipped backlog.

- Apply this by default, without being asked, to totals, splits, comparisons, and drill-downs alike.
- Include them only if the user explicitly asks for them, and say so when you do.
- State in the answer that Print Invoice (588) lines are excluded.

## Default scope is the current quarter

Unless the user names a different period, report **current-quarter backlog**, and always show **future-quarter backlog separately**. Never mix the two in one number.

- **Current quarter** means `CRD_Status = Current Quarter`: lines whose customer requested date (CRD) falls in the current fiscal quarter **or earlier**. This includes **overdue** orders.
- **Future quarter** means `CRD_Status = Future Quarter`: lines whose CRD is later than the current fiscal quarter.
- Use the stored `CRD_Status` of the weekly snapshot being reported. Fiscal quarter boundaries follow the Fiscal Calendar.
- "Due this quarter" and "due in a future quarter" refer to this same current-quarter and future-quarter split.
- State the quarter being reported (for example, "Q4 FY2026") in the answer.
