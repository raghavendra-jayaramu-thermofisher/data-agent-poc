---
title: Formatting Rules
scope: datasource
---

# Formatting Rules

- **Money:** Display whole currency units only; never show cents. Use `$` for USD and the correct symbol or code for other known currencies. Do not assume or silently convert currencies.
- **Numbers:** Use thousands separators. Display counts as whole numbers. Retain decimals for non-monetary measurements only when rounding would change their meaning.
- **Large amounts:** Use full numbers for exact values and reconciliations. Use `K`, `M`, or `B` for concise summaries, without decimal digits; prefer full numbers when abbreviating hides a meaningful difference.
- **Percentages:** Display whole percentages. Express differences between percentage shares in percentage points (`pts`).
- **Changes:** Show `+` for increases and `−` for decreases, before any currency symbol.
- **Dates:** Use `Month DD, YYYY` in prose and `DD Mon YYYY` in tables or charts. Include time and time zone only when relevant.
- **Identifiers:** Preserve codes and IDs exactly, including leading zeros. Never round, abbreviate, or convert them to scientific notation.
- **Missing values:** Use `N/A` for unavailable or unknown, `—` for not applicable, and `0` only for confirmed zero.
- **Precision:** Calculate using source precision and round only for display. Do not adjust totals to conceal display-rounding differences.
