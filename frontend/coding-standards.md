# DB Assistant Frontend Coding Standards

**Status:** mandatory AI/human engineering contract.  
**Goal:** minimum custom infrastructure, maximum product quality, modular code a human can understand quickly.

## 1. Source-of-truth order

1. Current backend OpenAPI + runtime behavior.
2. `frontend-master-prompt.md`.
3. `coding-standards.md`.
4. `design.md`.
5. Existing tested code.
6. Old frontend architecture only as historical context.

Never preserve outdated MUI/Base UI/shadcn assumptions when they conflict with this package.

## 2. Approved stack — do not substitute

Continue the existing React/Vite project; do not reinitialize it.

| Concern | Package / pinned baseline |
|---|---|
| React | `react@19.2.8`, `react-dom@19.2.8` |
| Build | `vite@8.2.2`, `@vitejs/plugin-react@6.1.0` |
| TypeScript | `typescript@6.0.2` |
| Styling | `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3` |
| UI/accessibility | `@heroui/react@3.2.4`, `@heroui/styles@3.2.4` |
| HeroUI agent docs | `heroui-cli@3.0.4` |
| Routing | `react-router@8.3.0` |
| Server state | `@tanstack/react-query@5.102.2` |
| Dense tables | `@tanstack/react-table@9.1.2`, `@tanstack/react-virtual@3.14.10` |
| Forms | `react-hook-form@7.86.0` |
| Validation | `zod@4.4.3`, `@hookform/resolvers@5.9.1` |
| Charts | `echarts@6.1.0`, `echarts-for-react@3.0.6` |
| API | `openapi-typescript@7.13.0`, `openapi-fetch@0.17.0` |
| SSE | `@microsoft/fetch-event-source@2.0.1` |
| Markdown | `react-markdown@10.1.0`, `remark-gfm@4.0.1` |
| Tests | `vitest@4.1.11`, RTL, MSW `2.15.0`, Playwright `1.62.1` |

Do not add Radix, MUI, shadcn, Chakra, Ant, Mantine, Redux, Zustand, MobX, Axios, Recharts, Chart.js, another table/grid framework, another form/validation library, another SSE implementation, Next.js, SSR, or frontend AI-agent orchestration.

HeroUI-specific rule: before unfamiliar/version-sensitive HeroUI work, inspect installed package version and targeted docs. Generate local docs once with:

```bash
npx heroui-cli@3.0.4 agents-md --react --output AGENTS.md
```

Prefer `.heroui-docs/react/` or official HeroUI MCP/docs over model memory. HeroUI v3 requires no `HeroUIProvider` and no old Tailwind plugin.

## 3. Architecture

Use feature-oriented modules:

```text
src/
  app/             # router, providers, error boundary
  api/             # generated types, client, errors, query client
  auth/
  organizations/
  conversations/
  jobs/
  dashboards/
  data-sources/
  knowledge/
  models/
  settings/
  components/      # truly shared product primitives
  lib/             # datetime, formatting, storage
  theme/           # tokens, HeroUI mapping, ECharts theme
  test/
e2e/
```

Feature folders own `pages/`, `components/`, `hooks/`, `schemas/`, `lib/`, tests. Export only intentional public APIs. No giant global `utils.ts`, `types.ts`, or generic service layer.

Dependency direction:

```text
pages → feature components → feature hooks/services → shared API/lib/theme
```

Lower layers never import pages. Features do not import another feature's private internals.

## 4. File/component rules

- One primary responsibility per file.
- Pages orchestrate route params, hooks, page states, and composition; they do not contain the whole feature.
- Preferred React component: ~40–150 meaningful lines.
- Review around 200 lines; **split above 250 lines** unless mostly static cohesive configuration.
- Split whenever one component mixes fetching + form + table/chart + SSE + complex transformations.
- Custom hooks normally <150 lines and one purpose.
- Avoid mega-components controlled by dozens of props.
- Do not wrap HeroUI primitives unless the wrapper adds product semantics/behavior (e.g. `StatusBadge`, `SqlBlock`, `DataTable`, `ConfirmationDialog`).
- Extract shared abstractions when reuse is real, not speculative.

## 5. State ownership

Use exactly one owner per state class:

- backend/remote state → **TanStack Query**;
- form state → **React Hook Form**;
- validation → **Zod**;
- transient component interaction → React state/reducer;
- deep-link/shareable state → React Router params/search params;
- truly global cross-route orchestration only → small providers for auth, organization, notifications, global jobs;
- safe browser preferences → one storage module only.

Never copy query results into Context/local state just to make them global. Never access `localStorage` from feature components. Never store passwords, datasource credentials, API keys, private execution data, or refresh secrets in preferences.

## 6. API contract

- Backend OpenAPI is the DTO source of truth; generate types, never hand-copy API DTOs.
- All HTTP uses one `openapi-fetch` client.
- Client owns base URL, auth/session behavior, organization header, request IDs if needed, and normalized errors.
- Components/pages never call raw `fetch`/Axios for API endpoints.
- Expose feature hooks such as `useConversation`, `useDataSources`, `useCancelJob`.
- Central error shape: `code`, `message`, optional `fieldErrors`, optional `requestId`.
- Reads may retry transient failures with bounds. Writes never retry blindly.

## 7. Routing

One React Router tree with nested layouts and lazy-loaded major protected routes. SPA/browser routing only; no SSR.

Core route families:

```text
/login /signup /forgot-password /reset-password
/ask /conversations/:id
/dashboards /dashboards/:id
/data-sources /data-sources/new /data-sources/:id
/knowledge/:dataSourceId
/models
/jobs /jobs/:id
/settings
```

Complex creation/edit flows are routed screens, not oversized modals. Modals/dialogs are short confirmations/selections only.

## 8. HeroUI + styling

- Import `tailwindcss` before `@heroui/styles`.
- `design.md` tokens are authoritative; map them into HeroUI semantic CSS variables globally.
- Set zero-radius globally; do not repeat `rounded-none` on every component.
- Use HeroUI components before custom implementations for Button, fields, select/autocomplete/combobox, dropdown, popover, tooltip, modal/drawer/alert-dialog, tabs, toast, table, badge/chip, skeleton, progress, checkbox/switch/radio, date/time controls.
- Preserve React Aria accessibility and HeroUI's documented `onPress`/compound APIs; never invent props/slots.
- Do not mix default HeroUI appearance with random Tailwind overrides. Global token/component styling first, local overrides last.
- No native `alert/confirm/prompt`.

Password/API-key inputs: when a secret is presently entered/available in the form, provide Show/Hide and Copy. A stored backend secret must remain redacted and must never be reconstructed or redisplayed.

## 9. Tables and charts

### Tables

Use HeroUI Table for small/static configuration tables. Use **one shared TanStack Table + Virtual layer** for analytical results/large interactive datasets. Do not build multiple table engines.

Advanced table layer may support only needed capabilities: sorting, filtering, column visibility, sticky header, pagination/server pagination, horizontal overflow, copy, selection where required, virtualization, loading/empty/error states. Numeric columns right-align; formatting is locale-aware.

### Charts

ECharts is the only chart engine. Centralize theme + option builders. Components never build huge ECharts option objects inline.

Initial outputs: metric, table, bar, line, area, pie. Use `dataset` + `encode` where possible. Use `dataZoom` for long series. No 3D/decorative gradients. Preserve datasource/SQL/job provenance.

Multi-source rule: a conversation may select **1–10 data sources**. Never silently merge unrelated result sets. Combine series only when the analytical dimension and unit are semantically compatible; otherwise render separate chart/table outputs. Legends/tooltips/source panels must retain datasource identity.

Never execute arbitrary ECharts configuration supplied as executable code. Map backend visualization metadata through a controlled adapter.

## 10. Deep Agent + jobs/SSE

The backend Deep Agent runtime is authoritative. Frontend must remain generic: do not hard-code a fixed tool sequence or number of SQL/model calls.

One global Job Manager owns:

- active/recent jobs;
- authenticated SSE connection lifecycle;
- reconnect/backoff;
- event cursor/replay;
- duplicate-event suppression;
- generic job state;
- completion/failure notifications.

Features may interpret events but never create their own SSE transport. Closing a page/stream never means cancel. On reload: fetch active jobs → reconnect → replay missed events.

Render safe operational trace only: tool names/status, SQL text, row count, truncation, durations, model usage when provided, artifacts. Never expose chain-of-thought, hidden prompts, scratchpads, credentials, or private Deep Agent state. Never invent progress percentages/events.

## 11. Forms, security, time, accessibility

- Meaningful forms use RHF + Zod; no parallel `useState` field copies.
- Map server field errors into RHF.
- Prevent duplicate submits and retain safe values after recoverable errors.
- Never persist/log secrets; clear secret fields after successful save when appropriate.
- Markdown uses `react-markdown`; no raw untrusted HTML.
- All timestamp instants use one `Intl`-based datetime module and browser timezone. Date-only values are never timezone shifted.
- Every screen/region supports loading, empty, success, error.
- Keyboard/focus/labels/accessible names/status text are mandatory. Never use clickable `div` when semantic control exists.

## 12. Performance

Prefer architecture before micro-optimization: route lazy loading, Query caching, backend row limits, pagination, table virtualization, bounded event/timeline rendering, independent parallel queries where safe. Use memoization only for expensive work or required referential stability.

## 13. Testing and quality gate

Every task must run and report actual results for:

```text
format
lint
tsc/typecheck
relevant Vitest + RTL + MSW tests
production build
relevant Playwright tests when available
```

Do not claim success without executing the command. Do not silence type/lint failures. Every bug fix should add a regression test at the lowest useful level.

Test especially: auth/session, organization scoping, routing, forms/errors, SSE reconnect/replay/deduplication, navigation while job runs, agent final answer, SQL trace, table/chart artifacts, 1–10 datasource selection/provenance, dashboard save/refresh/failure, timezone formatting, secret non-persistence.

## 14. Explicit rejection list

Reject during review:

- 500–1000 line pages/components;
- duplicate API DTOs;
- raw API calls in components;
- generic global store;
- page-specific SSE;
- custom accessible primitives HeroUI already solves;
- competing UI/chart/table/form libraries;
- fixed assumptions about Deep Agent reasoning sequence;
- fake progress;
- raw server stack traces;
- native dialogs;
- modal-heavy setup flows;
- arbitrary hard-coded design values;
- premature generic abstractions;
- disabling types/lint to pass.

## 15. Definition of done

A task is done only when: architecture remains modular; generated API types/client are used; correct state owner is used; `design.md` is followed; HeroUI APIs are verified rather than guessed; tables/charts use approved engines; jobs use shared SSE manager; secrets/private reasoning are absent; loading/empty/error/accessibility are handled; format/lint/typecheck/tests/build pass; progress file records files changed, commands, actual results, and deferred items; then the agent **stops**.
