---
version: alpha
name: DB Assistant
description: Dense, precise analytical workspace for conversational BI, SQL inspection, jobs, and dashboards.
colors:
  primary: "#4F46E5"
  on-primary: "#FFFFFF"
  primary-hover: "#4338CA"
  background: "#F8FAFC"
  surface: "#FFFFFF"
  surface-muted: "#F1F5F9"
  foreground: "#0F172A"
  muted: "#64748B"
  border: "#E2E8F0"
  border-strong: "#CBD5E1"
  success: "#059669"
  warning: "#D97706"
  danger: "#DC2626"
  info: "#2563EB"
  chart-1: "#4F46E5"
  chart-2: "#2563EB"
  chart-3: "#14B8A6"
  chart-4: "#F97316"
  chart-5: "#8B5CF6"
  chart-6: "#06B6D4"
  chart-7: "#EC4899"
  chart-8: "#64748B"
typography:
  page-title:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: -0.01em
  section-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 18px
  meta:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
  metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 34px
  code:
    fontFamily: Roboto Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
rounded:
  none: 0px
  xs: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: 36px
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: 36px
    padding: 12px
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: 36px
    padding: 10px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 16px
  table-header:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.muted}"
    typography: "{typography.meta}"
    height: 36px
  metric-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 16px
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 20px
  status-success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
    rounded: "{rounded.xs}"
    height: 22px
  status-warning:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
    rounded: "{rounded.xs}"
    height: 22px
  status-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.xs}"
    height: 22px
  chart-series-1:
    backgroundColor: "{colors.chart-1}"
  chart-series-2:
    backgroundColor: "{colors.chart-2}"
  chart-series-3:
    backgroundColor: "{colors.chart-3}"
  chart-series-4:
    backgroundColor: "{colors.chart-4}"
  chart-series-5:
    backgroundColor: "{colors.chart-5}"
  chart-series-6:
    backgroundColor: "{colors.chart-6}"
  chart-series-7:
    backgroundColor: "{colors.chart-7}"
  chart-series-8:
    backgroundColor: "{colors.chart-8}"
---

## Overview

DB Assistant is a data-first analytical workspace, not a consumer chat app or marketing site. The visual hierarchy prioritizes answers, values, tables, charts, SQL, provenance, timestamps, and job state. Use HeroUI v3 for accessible interaction behavior, Tailwind CSS v4 for layout/theme expression, TanStack Table/Virtual for advanced dense tables, and ECharts for charts.

## Colors

Neutral surfaces dominate. Indigo is reserved for primary action, focus, and selection. Green/amber/red/blue are semantic, not decorative. Charts use the eight chart tokens in order and never use rainbow palettes when fewer series are sufficient. Never use color as the only status signal.

## Typography

Use Google Font **Inter** for all UI/data text and **Roboto Mono** only for SQL, identifiers, schema names, and code. Enable tabular numerals for metrics, currency, percentages, durations, row counts, and numeric table columns. Product page titles stay at 24px; do not use marketing-scale typography inside the app.

## Layout

4px spacing foundation. Desktop shell: 48px top bar, ~224px sidebar, fluid main area. Default page padding 24px desktop / 16px tablet / 12px mobile. Analytical pages may use full width; forms should stay ~720–840px. Tables scroll horizontally on narrow screens instead of becoming unrelated cards. Dashboard uses a responsive 12-column grid with 16px gaps.

## Elevation & Depth

Prefer borders and surface changes over shadows. Core panels, tables, fields, metric cards, and dashboard widgets have no shadow. Use one restrained shadow only for floating overlays such as menus, drawers, dialogs, tooltips, and Job Center.

## Shapes

Default radius is **0px**. `2px` is allowed only for tiny status/focus rendering. No pill buttons, rounded cards, rounded tables, rounded dialogs, or capsule chat inputs. Borders are 1px; focus indicators may use 2px.

## Components

- **HeroUI v3 is the UI behavior/accessibility layer.** Map project tokens into HeroUI semantic CSS variables. Do not use HeroUI default styling as the brand.
- Import CSS in this order: `@import "tailwindcss";` then `@import "@heroui/styles";`.
- Set HeroUI theme radius globally (`--radius: 0px; --field-radius: 0px`). Do not scatter `rounded-none` everywhere.
- Use HeroUI Button, TextField/Input, Select/Autocomplete/ComboBox, Dropdown, Popover, Tooltip, Tabs, Drawer, AlertDialog, Toast, Skeleton, Badge/Chip, Table, and form controls before writing custom accessible primitives.
- Complex creation/editing is a routed screen, not a modal: data source, model connection/profile, knowledge/business definitions, complex dashboard setup.
- Dialogs are only for short confirmations/selections: delete, disconnect, cancel job, discard, rename, save-to-dashboard target.
- Never use `window.alert`, `window.confirm`, or `window.prompt`.
- **Ask experience:** document-like stream, not rounded chat bubbles. User question → answer → metric/table/chart → concise explanation → collapsed `View execution` → follow-up composer.
- **Execution trace:** generic event-driven timeline; never assume a fixed Deep Agent tool order. SQL blocks use Roboto Mono, copy action, horizontal scroll, and show status/duration/rows/truncation.
- **Jobs:** global Job Center persists across navigation/reload; show real semantic events, never fake percentages.
- **Tables:** HeroUI Table for small/static configuration views. Use one shared TanStack Table + TanStack Virtual implementation for analytical results or advanced sorting/filtering/virtualization. Numeric columns right-align.
- **Metrics:** one dominant value, short label, optional delta/sparkline; flat 1px border; provenance remains discoverable.
- **Charts:** ECharts only. Initial types: bar, line, area, pie plus metric/table outputs. Prefer `dataset` + `encode`; use `dataZoom` for long series; no 3D; no decorative gradients; preserve datasource provenance in legends/tooltips. Only combine multiple datasource series when dimensions and units are semantically compatible.
- **Password/API-key fields:** masked by default with explicit Show/Hide and Copy controls when the value is currently available in the form. Never redisplay stored secrets returned as redacted/absent by the backend.
- **Feedback:** Toast for short completion feedback, inline notice for contextual warning/error, Job Center for long-running progress, page state for blocking errors.
- Every data surface has loading, empty, success, and error states.

## Do's and Don'ts

**Do:** keep data visually primary; use flat surfaces; use one primary action per region; preserve provenance; show local timezone timestamps; retain previous chart/widget data during refresh when possible; use real backend job state; use HeroUI docs/source for version-sensitive APIs.

**Don't:** use Radix UI, Material UI, shadcn as a second component system, Recharts, native browser dialogs, custom chart engines, custom accessibility behavior already solved by HeroUI, decorative card grids, large radii, 3D charts, fake agent progress, raw stack traces, private model reasoning, secrets, or hard-coded one-off design values.
