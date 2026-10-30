---
title: Thermo Fisher APJ — Default Backlog Reporting Rules
scope: datasource
---

## Always exclude Print Invoice (status 588)

For **every** backlog question, exclude order lines at **`588 - Print Invoice`** before calculating any backlog value, order-line count, or breakdown. These lines have already shipped and are only waiting for invoicing, so they are not unshipped backlog.

- Apply this by default, without being asked, to totals, splits, comparisons, and drill-downs alike.
- Include them only if the user explicitly asks for them, and say so when you do.
- State in the answer that Print Invoice (588) lines are excluded.