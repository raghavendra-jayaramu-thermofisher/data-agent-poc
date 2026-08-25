# DB Assistant Frontend — Production Master Build Prompt

> **Purpose:** This is the single implementation prompt for the AI coding agent responsible for building the DB Assistant frontend. It supersedes the older frontend architecture document. The older document may be read only for historical product context; it MUST NOT override this file, the current backend API/OpenAPI contract, `design.md`, or `coding-standards.md`.

---

# 1. Role

You are a Principal Frontend Engineer building the production frontend for **DB Assistant**, a data-dense conversational analytics application backed by an asynchronous **Deep Agents** runtime.

Build a production-quality **client-side React SPA**. There is no server-side rendering requirement and no Next.js requirement.

The application must be:

- modular;
- maintainable by humans;
- loosely coupled;
- type-safe;
- data-dense without being visually crowded;
- resilient to asynchronous jobs and reconnects;
- secure around credentials;
- accessible;
- responsive;
- optimized for the **agent analysis experience and dashboards** rather than administration/setup screens.

Do not attempt to complete the entire frontend in one pass. This master prompt defines **six gated tasks**. On each invocation, complete **exactly one** next incomplete task, fully validate it, record progress, and STOP.

---

# 2. Sources of Truth and Precedence

Use the following precedence when instructions conflict:

1. **Current backend OpenAPI schema and actual backend behavior** — highest authority for API contracts.
2. **Current backend API Integration Guide**.
3. **This master build prompt**.
4. **`coding-standards.md`** — mandatory engineering constraints.
5. **`design.md`** — mandatory visual/design-system constraints.
6. Current repository implementation, when it is already correct and tested.
7. Historical frontend architecture — context only; never blindly preserve it.

Never manually invent API DTOs when the backend exposes OpenAPI types.

Before each task, inspect:

- the repository as it currently exists;
- `FRONTEND_IMPLEMENTATION_PROGRESS.md` if present;
- backend OpenAPI/API docs;
- `design.md`;
- `coding-standards.md`.

Continue from existing correct work. Do not rewrite completed tasks merely because you would have implemented them differently.

---

# 3. Current Backend Reality — Deep Agents

The backend is no longer based on the old linear frontend assumptions. The current backend uses:

```text
deepagents >= 0.7.3,<0.8
```

The analytical runtime is server-side. The frontend MUST NOT import or reimplement Deep Agents, LangGraph, LangChain, model routing, SQL safety, or agent orchestration.

The current product tool surface is conceptually:

```text
read_knowledge_index
read_table_schema
execute_sql
create_chart
```

However, the frontend MUST NOT hard-code the agent UI around exactly four tools or a fixed sequence.

A Deep Agent run may:

- call tools multiple times;
- execute multiple SQL queries;
- recover from tool-level failures;
- create zero, one, or multiple chart artifacts;
- make multiple model calls;
- load schemas selectively;
- perform a different number/order of steps for every question.

Therefore the frontend must treat the backend as an **event-driven analytical job runtime** and render generic operational traces from persisted records.

The frontend displays:

- user questions;
- assistant answers;
- durable job state;
- safe operational progress;
- tool execution summaries;
- SQL execution details;
- model execution metadata when useful;
- persisted table/chart/text artifacts;
- dashboard outputs.

The frontend MUST NEVER expose or attempt to reconstruct:

- private chain-of-thought;
- hidden prompts;
- internal Deep Agents state;
- model scratchpads;
- database credentials;
- API keys.

---

# 4. Product Priority

Prioritize implementation effort in this order:

## P0 — Deep Agent analytical experience

The primary product is the Ask / Conversation experience:

```text
question
→ durable job
→ live operational events
→ Deep Agent uses knowledge/tools/SQL
→ persisted answer + artifacts
→ inspectable execution trace
→ follow-up question
```

This experience must feel excellent even when:

- the user navigates away;
- the browser refreshes;
- SSE disconnects temporarily;
- the agent executes multiple SQL statements;
- a query is truncated;
- one tool call fails but the agent recovers;
- the analysis produces multiple artifacts.

## P0 — Dashboards and reusable reporting

Dashboards must make successful analyses reusable without becoming a Power BI-style layout editor.

The important jobs are:

- save a useful analysis output;
- render metric/table/chart widgets beautifully;
- preserve provenance;
- refresh asynchronously;
- keep old data visible while refresh runs;
- recover locally when one widget fails.

## P1 — Global jobs / execution observability

Jobs are application-wide, not page-owned.

## P1 — Data sources / knowledge / models

These screens must be complete and usable but deliberately simple. Do not spend disproportionate implementation complexity on setup flows.

## P2 — Administrative views

Organization settings, audit, and operational status should be straightforward functional screens.

---

# 5. Approved Frontend Stack — Pinned Baseline, Do Not Substitute

This project already exists as a React/Vite/Tailwind starter. **Continue from the existing repository. Do not reinitialize or replace it.** Inspect `package.json`, `package-lock.json`, current source files, and `FRONTEND_IMPLEMENTATION_PROGRESS.md` before changing dependencies.

The package baseline below was researched and frozen on **24 August 2026** so the implementation agent does not spend time re-evaluating libraries. Treat it as the approved production stack for this build. Do not casually replace packages with alternatives or upgrade majors during the six implementation tasks.

## 5.1 Existing starter — preserve this foundation

The project is already based on:

| Concern | Required package/version | Rule |
|---|---|---|
| React | `react` **19.2.8** | Keep |
| React DOM | `react-dom` **19.2.8** | Keep |
| Build | `vite` **8.2.2** | Keep |
| React Vite plugin | `@vitejs/plugin-react` **6.1.0** | Keep |
| Tailwind CSS | `tailwindcss` **4.3.3** | Keep |
| Tailwind Vite integration | `@tailwindcss/vite` **4.3.3** | Keep |
| TypeScript | `typescript` **6.0.2** | Keep for this build |
| ESLint | `eslint` **10.9.0** | Keep |
| TypeScript ESLint | `typescript-eslint` **8.67.0** | Keep |

**Do not upgrade TypeScript to 7.x during this build.** TypeScript 7 exists, but the approved `typescript-eslint` line currently documents TypeScript support as `<6.1.0`. The existing TypeScript 6.0.2 project is therefore the intentional compatibility baseline.

Vite 8 requires a compatible Node runtime. Use **Node 22 LTS/current compatible with Vite 8** for development and CI; do not downgrade the project to an older Node generation.

## 5.2 UI foundation — HeroUI v3 + Tailwind CSS v4

Use HeroUI v3 as the application's component behavior/accessibility foundation and Tailwind CSS v4 as the styling/layout layer. Do not use Base UI, shadcn, Radix, MUI, or another component system in parallel.

| Concern | Required package/version |
|---|---|
| React UI components | `@heroui/react` **3.2.4** |
| HeroUI styles/tokens | `@heroui/styles` **3.2.4** |
| HeroUI agent documentation CLI | `heroui-cli` **3.0.4** |
| Styling | `tailwindcss` **4.3.3** |
| Tailwind Vite plugin | `@tailwindcss/vite` **4.3.3** |

Install the pinned HeroUI packages:

```bash
npm install --save-exact @heroui/react@3.2.4 @heroui/styles@3.2.4
npm install -D --save-exact heroui-cli@3.0.4
```

Main CSS import order is mandatory:

```css
@import "tailwindcss";
@import "@heroui/styles";
```

HeroUI v3 uses React Aria behavior internally, Tailwind CSS v4, CSS variables, and compound component APIs. It does **not** require `HeroUIProvider`, the old HeroUI Tailwind plugin, or Framer Motion for ordinary React components. Do not add those because an old HeroUI/NextUI example shows them.

At Task 1, generate targeted local HeroUI documentation for the coding agent:

```bash
npx heroui-cli@3.0.4 agents-md --react --output AGENTS.md
```

This creates `.heroui-docs/react/`. For unfamiliar or version-sensitive HeroUI APIs, use this order:

```text
installed package version
→ matching local HeroUI docs
→ official HeroUI MCP/docs/source
→ model memory last
```

Do not guess HeroUI compound children, slots, props, events, CSS variables, or state attributes. Preserve React Aria accessibility behavior and use the event API documented by the component (often `onPress`, not automatically `onClick`).

Map `design.md` into HeroUI semantic variables globally. The product intentionally uses zero-radius geometry; configure `--radius: 0px` and `--field-radius: 0px` at theme level rather than applying `rounded-none` everywhere.

### Absolute UI dependency prohibitions

Do NOT install or import:

- `@base-ui/react` or `@base-ui-components/react`;
- `@radix-ui/*` or `radix-ui`;
- shadcn as a second component system;
- Material UI / `@mui/*`;
- Chakra UI;
- Ant Design;
- Mantine;
- Headless UI;
- direct React Aria component packages as a competing primitive layer unless a documented HeroUI gap requires one and the reason is recorded;
- a second design-system framework.

Use HeroUI first for buttons, fields, selection controls, menus, popovers, tooltips, tabs, drawers, alert dialogs, toasts, tables, badges/chips, skeleton/loading indicators, and standard form controls. Write custom code only for DB Assistant-specific behavior.

## 5.3 Routing, server state, forms and validation

| Concern | Required package/version |
|---|---|
| Client routing | `react-router` **8.3.0** |
| Server state/cache | `@tanstack/react-query` **5.102.2** |
| Forms | `react-hook-form` **7.86.0** |
| Validation | `zod` **4.4.3** |
| RHF/Zod adapter | `@hookform/resolvers` **5.9.1** |

Use React Router in browser/client mode only. **No SSR, no Next.js, no server components.** Use nested route layouts, route-level lazy loading, protected route boundaries, and URL search params for shareable/filterable page state.

State ownership is fixed:

- remote/API data → TanStack Query;
- form state → React Hook Form;
- local transient interaction state → React state/reducer;
- URL-relevant filters/selection → React Router URL state;
- small truly global cross-route state → narrowly scoped providers for authentication, organization, notifications, and the global Job Center;
- do **not** add Redux, Zustand, MobX, Jotai, or another global state library.

## 5.4 Data-dense tables

Use:

| Concern | Required package/version |
|---|---|
| Headless table/data-grid logic | `@tanstack/react-table` **9.1.2** |
| Row/column virtualization | `@tanstack/react-virtual` **3.14.10** |
| Visual table primitives | HeroUI `Table` for simple tables + project-owned TanStack views for analytical grids |

This replaces the old MUI DataGrid assumption completely. Use HeroUI `Table` for small/static configuration views. Build **one shared DB Assistant analytical table layer** around TanStack Table + the design tokens, adding TanStack Virtual only where large bounded results need it. Reuse that analytical layer for result artifacts, execution data, jobs, and dashboard table widgets where suitable.

The shared table layer should support only product-needed capabilities: sorting, column visibility, controlled filtering, pagination/server pagination when the API supports it, row selection where actually needed, sticky headers, horizontal overflow, copy actions, empty/error states, and virtualization for large bounded result sets.

Do not build several unrelated table engines. Do not hand-roll sorting/filtering/virtualization.

## 5.5 Charts — single production chart engine

Use exactly:

| Concern | Required package/version |
|---|---|
| Chart engine | `echarts` **6.1.0** |
| React wrapper | `echarts-for-react` **3.0.6** |

**Apache ECharts is the only chart engine.**

Do NOT install:

- Recharts;
- Chart.js;
- Victory;
- Nivo;
- Plotly;
- Vega/Vega-Lite;
- Highcharts;
- another chart library.

Do not add HeroUI-adjacent examples that introduce Recharts or any second chart runtime. HeroUI provides controls and surrounding UI; ECharts renders the actual analytical visualization.

Why ECharts is required for DB Assistant: its `dataset`/`encode` model can separate data from presentation and reuse multiple datasets across series; it supports transforms, multiple axes, `dataZoom`, interactive tooltips/legends, and dense multi-series analytical views. Those capabilities match multi-datasource analysis better than a lightweight dashboard-only chart abstraction.

## 5.6 API, SSE and Markdown

| Concern | Required package/version |
|---|---|
| OpenAPI type generation | `openapi-typescript` **7.13.0** |
| Typed fetch client | `openapi-fetch` **0.17.0** |
| Authenticated SSE | `@microsoft/fetch-event-source` **2.0.1** |
| Markdown renderer | `react-markdown` **10.1.0** |
| GitHub-flavored Markdown | `remark-gfm` **4.0.1** |

Do not add Axios. Use the generated OpenAPI contract and the approved fetch client. Do not add a second SSE implementation. Never use `dangerouslySetInnerHTML` for assistant Markdown.

## 5.7 Test stack

Use the following pinned test baseline:

| Concern | Required package/version |
|---|---|
| Formatter | `prettier` **3.9.6** |
| Unit/component runner | `vitest` **4.1.11** |
| DOM environment | `jsdom` **30.0.1** |
| React Testing Library | `@testing-library/react` **16.3.2** |
| DOM queries | `@testing-library/dom` **10.4.1** |
| User interactions | `@testing-library/user-event` **14.6.6** |
| DOM matchers | `@testing-library/jest-dom` **7.0.0** |
| API/network mocks | `msw` **2.15.0** |
| Browser E2E | `@playwright/test` **1.62.1** |

If an exact version in the existing lockfile differs because the starter was created earlier, do not silently churn working dependencies. Compare it against this baseline, update deliberately during Task 1, run the full Task 1 quality gate, and commit the resulting lockfile.

## 5.8 Dependency installation rule

Use exact versions for newly introduced architectural dependencies so the six-task implementation remains deterministic:

```bash
npm install --save-exact @heroui/react@3.2.4 @heroui/styles@3.2.4 \
  react-router@8.3.0 @tanstack/react-query@5.102.2 \
  @tanstack/react-table@9.1.2 @tanstack/react-virtual@3.14.10 \
  react-hook-form@7.86.0 zod@4.4.3 @hookform/resolvers@5.9.1 \
  echarts@6.1.0 echarts-for-react@3.0.6 openapi-fetch@0.17.0 \
  @microsoft/fetch-event-source@2.0.1 react-markdown@10.1.0 remark-gfm@4.0.1
```

Install development dependencies with exact versions as well:

```bash
npm install -D --save-exact heroui-cli@3.0.4 openapi-typescript@7.13.0 prettier@3.9.6 \
  vitest@4.1.11 jsdom@30.0.1 @testing-library/react@16.3.2 \
  @testing-library/dom@10.4.1 @testing-library/user-event@14.6.6 \
  @testing-library/jest-dom@7.0.0 msw@2.15.0 @playwright/test@1.62.1
```

Do not run broad `npm update` commands during feature tasks. Commit `package-lock.json`.

## 5.9 General dependency prohibitions

Do NOT introduce:

- Next.js or SSR infrastructure;
- Redux/Zustand/MobX/Jotai;
- Axios;
- Base UI / shadcn / Radix UI;
- Material UI;
- a second chart library;
- a second table/data-grid framework;
- another form library;
- another validation library;
- a second SSE architecture;
- duplicated hand-written API DTOs;
- AI SDK frontend agent orchestration that competes with the backend Deep Agent runtime.

A new package is permitted only when the approved stack/browser APIs cannot reasonably solve a requirement and the reason is documented in `FRONTEND_IMPLEMENTATION_PROGRESS.md`.

---

# 6. Design System Is Mandatory

`design.md` is the visual contract.

**Stack precedence note:** if any older file mentions Material UI, MUI DataGrid, Base UI, shadcn, Radix UI, or another superseded implementation library, preserve only the product/design intent and implement it using the pinned stack in Section 5: **HeroUI v3 + Tailwind CSS v4 + TanStack Table/Virtual + ECharts**. This master prompt is authoritative for library selection.

Important non-negotiable product rules include:

- no browser `alert()`;
- no browser `confirm()`;
- no browser `prompt()`;
- custom confirmation dialogs only for focused confirmations;
- complex creation/edit flows use routed screens rather than oversized modals;
- data-dense, clean, modern UI;
- effectively zero border radius;
- restrained shadows;
- strong typographic hierarchy;
- tables and data are visually primary;
- Inter for UI text;
- Roboto Mono for SQL/technical identifiers;
- all chart styling comes from the shared ECharts theme/design tokens;
- no decorative chart gradients/3D effects;
- no card overload;
- no marketing-style giant headings inside the product.
- password/API-key fields use masked input plus explicit Show/Hide and Copy actions while a value is currently available; stored/redacted backend secrets are never reconstructed or redisplayed.

Do not reproduce tokens ad hoc in feature components. Implement the theme/token layer once and consume it everywhere.

---

# 7. Mandatory Coding Standards

`coding-standards.md` is mandatory.

Key rules:

- feature-oriented folders;
- high cohesion and low coupling;
- one primary responsibility per file;
- page components orchestrate; focused child components render;
- no giant page/component containing an entire feature;
- generated OpenAPI types are the contract source of truth;
- server state lives in TanStack Query;
- local interaction state lives in React state;
- form state lives in React Hook Form;
- URL-shareable state lives in React Router search params/routes;
- only small global providers for truly global concerns;
- no duplicated state between Query cache and local state;
- centralized auth/session handling;
- centralized organization scoping;
- centralized SSE/job handling;
- centralized date/time formatting;
- shared ECharts builders/theme;
- shared TanStack Table/Virtual table patterns;
- tests are behavior-first;
- strict TypeScript; do not normalize problems with `any`.

If a file becomes difficult to understand at a glance, split it by responsibility before adding more behavior.

---

# 8. Required Project Structure

Use a feature-oriented structure approximately like:

```text
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── route-guards/
│   │
│   ├── api/
│   │   ├── client.ts
│   │   ├── errors.ts
│   │   ├── queryKeys.ts
│   │   └── generated/
│   │
│   ├── auth/
│   ├── organizations/
│   ├── data-sources/
│   ├── models/
│   ├── knowledge/
│   ├── conversations/
│   ├── agent/
│   ├── jobs/
│   ├── dashboards/
│   ├── audit/
│   ├── operations/
│   │
│   ├── components/
│   ├── layouts/
│   ├── hooks/
│   ├── lib/
│   ├── theme/
│   └── test/
│
├── e2e/
├── public/
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── README.md
└── FRONTEND_IMPLEMENTATION_PROGRESS.md
```

Do not create directories simply to mirror this tree. Create a directory only when it owns a real responsibility.

A healthy feature folder may contain:

```text
conversations/
├── api/
├── components/
├── hooks/
├── pages/
├── schemas/
├── utils/
└── index.ts
```

Avoid enormous barrel exports that obscure dependencies.

---

# 9. Routing Architecture

Use a central React Router route tree with nested layouts and lazy-loaded protected routes.

Recommended routes:

```text
Public
/login
/signup
/forgot-password
/reset-password

Protected application
/ask
/conversations/:conversationId
/dashboards
/dashboards/:dashboardId
/data-sources
/data-sources/new
/data-sources/:dataSourceId
/data-sources/:dataSourceId/edit
/models
/models/connections/new
/models/connections/:connectionId
/models/profiles/new
/knowledge
/knowledge/:dataSourceId
/jobs
/jobs/:jobId
/settings
/settings/organization
/settings/audit
/settings/operations
```

Guidelines:

- `/ask` is the primary entry point.
- A conversation is a routed durable workspace.
- Dashboard detail is a routed workspace.
- Data source/model creation is a routed screen, not a giant modal.
- Lightweight selections such as “Save to dashboard” may use a dialog.
- Destructive confirmation uses the custom confirmation-dialog component.
- Use URL search params for shareable filters on jobs/tables where useful.
- Invalid route IDs must resolve to stable not-found/error states.

---

# 10. Application Shell

The protected application uses one stable shell:

```text
Top bar
├── current workspace
├── contextual actions where appropriate
├── global Job Center trigger
└── user menu

Sidebar
├── Ask
├── Dashboards
├── Data Sources
├── Knowledge
├── Models
├── Jobs
└── Settings

Main content
└── active routed feature
```

Desktop sidebar is persistent/collapsible according to `design.md`.

Mobile sidebar becomes a drawer.

Do not expose backend implementation concepts as primary navigation merely because an endpoint exists.

---

# 11. API Architecture

The backend OpenAPI document is the source of truth.

Implement:

```text
openapi-typescript
→ generated TypeScript schema
→ openapi-fetch client
→ thin feature-specific API/query hooks
```

Do not scatter raw `fetch()` calls throughout components.

The API client owns:

- base URL;
- Authorization header;
- `X-Organization-ID` header;
- request ID handling when useful;
- normalized error conversion;
- refresh/session behavior according to backend contract.

Normalize backend errors into one shape such as:

```ts
type AppError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
};
```

Never show raw stack traces or raw database/driver/provider errors.

---

# 12. Current Backend Endpoint Matrix

The current backend exposes **67 HTTP routes**. Do not assume this table replaces OpenAPI; use it as the architecture map and verify against OpenAPI during implementation.

## Health

```text
GET  /health
GET  /ready
```

## Authentication

```text
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

## Organizations

```text
GET   /api/v1/organizations
GET   /api/v1/organizations/current
PATCH /api/v1/organizations/:organizationId
```

## Data sources

```text
GET    /api/v1/data-sources
POST   /api/v1/data-sources
POST   /api/v1/data-sources/excel
GET    /api/v1/data-sources/:dataSourceId
PATCH  /api/v1/data-sources/:dataSourceId
DELETE /api/v1/data-sources/:dataSourceId
POST   /api/v1/data-sources/:dataSourceId/test
GET    /api/v1/data-sources/:dataSourceId/schema
POST   /api/v1/data-sources/:dataSourceId/excel/replace
```

Supported user-facing source types:

```text
PostgreSQL
MySQL
Microsoft SQL Server
Excel → materialized by backend to persistent DuckDB
```

## Models

```text
GET    /api/v1/models/connections
POST   /api/v1/models/connections
GET    /api/v1/models/connections/:connectionId
PATCH  /api/v1/models/connections/:connectionId
DELETE /api/v1/models/connections/:connectionId
POST   /api/v1/models/connections/:connectionId/test

GET    /api/v1/models/profiles
POST   /api/v1/models/profiles
GET    /api/v1/models/profiles/default
GET    /api/v1/models/profiles/:profileId
PATCH  /api/v1/models/profiles/:profileId
POST   /api/v1/models/profiles/:profileId/default
DELETE /api/v1/models/profiles/:profileId
```

## Knowledge

```text
GET    /api/v1/knowledge/data-sources/:dataSourceId
POST   /api/v1/knowledge/data-sources/:dataSourceId/generate
GET    /api/v1/knowledge/data-sources/:dataSourceId/versions
GET    /api/v1/knowledge/data-sources/:dataSourceId/index
GET    /api/v1/knowledge/data-sources/:dataSourceId/documents
GET    /api/v1/knowledge/data-sources/:dataSourceId/documents/:documentId
GET    /api/v1/knowledge/data-sources/:dataSourceId/table?key=...
GET    /api/v1/knowledge/data-sources/:dataSourceId/annotations
POST   /api/v1/knowledge/data-sources/:dataSourceId/annotations
PATCH  /api/v1/knowledge/annotations/:annotationId
DELETE /api/v1/knowledge/annotations/:annotationId
```

## Conversations

```text
POST /api/v1/conversations
GET  /api/v1/conversations
GET  /api/v1/conversations/:conversationId
GET  /api/v1/conversations/:conversationId/messages
POST /api/v1/conversations/:conversationId/messages
```

## Jobs / Deep Agent execution

```text
GET  /api/v1/jobs?status=&limit=
GET  /api/v1/jobs/:jobId
POST /api/v1/jobs/:jobId/cancel
GET  /api/v1/jobs/:jobId/events
GET  /api/v1/jobs/:jobId/execution
```

## Dashboards

```text
GET    /api/v1/dashboards
POST   /api/v1/dashboards
GET    /api/v1/dashboards/:dashboardId
PATCH  /api/v1/dashboards/:dashboardId
DELETE /api/v1/dashboards/:dashboardId
POST   /api/v1/dashboards/:dashboardId/refresh
POST   /api/v1/dashboards/:dashboardId/widgets
PATCH  /api/v1/dashboards/widgets/:widgetId
DELETE /api/v1/dashboards/widgets/:widgetId
POST   /api/v1/dashboards/widgets/:widgetId/refresh
```

## Audit / operations

```text
GET /api/v1/audit?limit=100
GET /api/v1/ops/status
```

---

# 13. State Ownership

Use one owner per state category.

## Server state → TanStack Query

Examples:

- current user;
- organizations;
- data sources;
- model connections/profiles;
- knowledge status/documents;
- conversations/messages;
- jobs;
- execution trace;
- dashboards/widgets;
- audit data.

Do not copy query results into component state merely to render them.

## Local interaction state → React state

Examples:

- currently expanded execution row;
- whether a drawer is open;
- transient chart/table display selection;
- password visibility;
- copied feedback state.

## Form state → React Hook Form

All nontrivial forms.

## Validation → Zod

Keep feature validation schemas near the feature.

## Global state → minimal providers only

Allowed global concerns include:

- authentication/session;
- active organization;
- global job/SSE manager;
- global notifications.

Do not create a generic global state store.

## URL state → Router

Use URL params/search params for:

- active conversation/dashboard identity;
- job filters;
- table filters that should survive navigation/share;
- selected settings section where appropriate.

## Local persistence → one preferences module

Only non-sensitive values such as:

- sidebar collapsed state;
- last organization ID;
- recent navigation preference;
- safe display preferences.

Never persist credentials or passwords.

---

# 14. Authentication and Organization Context

Startup flow:

```text
initialize auth storage/service
→ restore/refresh session if possible
→ GET /auth/me
→ GET /organizations
→ restore last valid organization or choose current/default
→ initialize protected queries
→ load active jobs
```

All organization-owned API requests must use the active organization according to backend requirements, including:

```text
X-Organization-ID: <organization-id>
```

The workspace switcher must invalidate/refetch organization-scoped Query caches and reconnect organization-scoped active jobs.

Do not allow stale data from organization A to appear after switching to organization B.

---

# 15. Credential and Password Input Standard

This requirement is explicit.

Every UI field used for a password/API key/secret that contains a user-entered plaintext value MUST provide:

- masked input by default;
- Show/Hide control;
- **Copy** button;
- keyboard-accessible label/tooltip;
- Clipboard API implementation;
- short custom in-app feedback such as `Copied` after success;
- no browser alert.

Examples:

- signup/login password;
- datasource database password;
- model API key;
- replacement credential field.

Security constraints:

- the Copy action copies only the value currently present in the in-memory form field;
- saved backend credentials are never redisplayed merely to enable copying;
- after a successful create/update where the backend redacts the secret, the frontend must also treat it as unavailable;
- do not store copied values in application logs, analytics, local storage, query cache, or notifications;
- clear sensitive form values when the flow completes and the component no longer needs them.

---

# 16. Global Job and SSE Architecture

This is a core architectural capability, not a chat-component detail.

Use **one** authenticated SSE implementation based on `@microsoft/fetch-event-source`.

SSE endpoint:

```text
GET /api/v1/jobs/:jobId/events
```

Headers include:

```text
Authorization: Bearer <token>
X-Organization-ID: <organization-id>
Accept: text/event-stream
```

Parsed event model:

```ts
type JobEvent = {
  sequence: number;
  event_type: string;
  level: string;
  payload: Record<string, unknown>;
  created_at: string;
};
```

The server supports durable replay using:

```text
Last-Event-ID
```

or:

```text
?after_sequence=<n>
```

Frontend rules:

1. Store highest processed sequence per active job.
2. Ignore any event where `sequence <= lastSeenSequence`.
3. Reconnect with the last sequence.
4. Never treat disconnect as job cancellation.
5. Backend durable job state remains authoritative.
6. Reconcile via `GET /jobs/:id` after reconnect or terminal events.
7. On terminal state, refetch feature data affected by the job.
8. No fake percentages.
9. No page-specific duplicate SSE clients.

Application startup must load queued/running jobs and reconnect them.

Global Job Center must be available from every protected route.

It shows:

- running/queued jobs;
- recent completed/failed/cancelled jobs;
- job type;
- current safe event label;
- elapsed/finished time;
- cancel when applicable;
- destination link where known.

Generic job states:

```text
queued
running
succeeded
failed
cancelled
```

Important event families currently include:

```text
job.*
datasource.*
excel.*
knowledge.*
agent.started
knowledge.index.loaded
knowledge.schema.loaded
model.request.*
tool.*
sql.*
chart.generated
answer.generated
dashboard.widget.refreshed
```

Do not write UI logic that breaks when new event types appear. Unknown events may be ignored or represented generically.

---

# 17. Deep Agent Conversation Architecture — Primary Experience

This deserves more implementation attention than setup screens.

## 17.1 Conversation model

Conversation creation accepts:

```text
1–10 datasource IDs
optional title
optional model profile ID
```

The model profile can be omitted when the backend default is suitable.

The UI should not force users to understand provider/model infrastructure for every question.

## 17.2 Starting a question

On `/ask`:

- show a focused question composer;
- let the user select data source(s);
- model selection should be secondary/optional;
- show recent conversations without overwhelming the main workspace;
- retain selected datasource as a safe preference if useful.

If no conversation exists yet:

```text
create conversation
→ navigate to /conversations/:id
→ submit message
```

Submitting:

```text
POST /api/v1/conversations/:conversationId/messages
```

returns immediately:

```json
{
  "message_id": "uuid",
  "job_id": "uuid"
}
```

Then:

1. render the user message immediately using the returned durable ID;
2. register the job globally;
3. subscribe/reuse the global job stream;
4. keep the composer appropriately disabled only to prevent accidental duplicate submission, not to lock the entire application;
5. allow navigation away;
6. show real progress from events;
7. when terminal, refetch messages and execution trace.

## 17.3 Conversation layout

The conversation is an **analysis workspace**, not a bubble-chat clone.

Prefer:

```text
optional conversation/history rail
+ main analytical document column
+ contextual execution/source panel when appropriate
```

Assistant answers should read like analytical documents.

User questions can be visually differentiated without oversized speech bubbles.

## 17.4 Answer rendering

Support:

- Markdown paragraphs;
- headings;
- lists;
- inline code/code blocks;
- tables;
- links handled safely;
- KPI/metric artifact presentation;
- structured table artifacts;
- ECharts chart artifacts;
- error/retry states;
- follow-up composer.

Sanitize unsafe HTML. Do not enable arbitrary raw HTML from model output.

## 17.5 Live progress

Display concise operational progress derived from real events, e.g.:

```text
Reading data knowledge…
Loading orders schema…
Executing SQL…
Analyzing results…
Creating chart…
Generating answer…
```

Never expose hidden model reasoning.

Do not make progress dependent on a fixed Deep Agent tool order.

## 17.6 Follow-ups

Follow-up messages reuse the conversation context/data sources. They create new durable jobs.

Each assistant response associated with a job must be independently inspectable.

## 17.7 Failure UX

Distinguish useful failure categories where backend error codes allow:

```text
Question/agent failure
SQL rejected for safety
SQL execution failed
Query timed out
Datasource unavailable
Job cancelled
Job failed
Network/SSE temporarily disconnected
```

Do not present a temporary SSE disconnect as a failed analytical job.

---

# 18. Execution Trace Architecture

Endpoint:

```text
GET /api/v1/jobs/:jobId/execution
```

Current response contains:

```text
tools[]
sql[]
models[]
artifacts[]
```

Build this UI generically.

## Tool executions

Useful fields include:

```text
sequence
tool_name
status
input_summary
output_summary
error_code
error_message
started_at
finished_at
```

Render safe summarized operations. Do not dump massive JSON by default.

## SQL executions

Show:

```text
SQL text
status
datasource
row count
truncated
columns
result bytes when useful
duration
started/finished time
sanitized error
```

SQL is shown in Roboto Mono with Copy action.

## Model executions

Show only operational metadata useful to the user/debugger:

```text
model name
phase
status
token usage when actually reported
duration/timestamps
sanitized error
```

Token usage can be null. Never display null as measured zero.

## Trace timeline

Build a normalized, chronological trace renderer that can accommodate arbitrary future tool names.

Do not write:

```ts
if tool1 then tool2 then sql then answer
```

Instead derive the timeline from sequence/timestamps and known record categories.

Use expandable details. Default view should be readable rather than developer-console-like.

---

# 19. Artifact Rendering

Artifacts are persisted backend outputs, not arbitrary executable UI configuration.

Current kinds:

```text
text
table
chart
```

## Text artifact

Render Markdown safely.

## Table artifact

Payload contains:

```text
columns[]
rows[][]
row_count
truncated
data_source_id
```

Use HeroUI Table for simple/static tables and the shared TanStack Table analytical layer for advanced result grids. Apply TanStack Virtual when the bounded result size makes virtualization useful. Do not create a second grid engine.

Respect truncation visibly.

## Chart artifact

Current agent chart types:

```text
bar
line
area
pie
```

Map backend field encodings/data to ECharts through a controlled adapter.

Do not execute arbitrary ECharts options received from the server.

Implement a function conceptually like:

```ts
buildChartOption(artifactPayload, designTokens)
```

that validates supported chart types/encodings and applies the shared chart theme.

Support accessible tabular fallback/view-data behavior where practical.

## Multi-datasource analytical chart contract

A conversation can be created with **1–10 data sources**. The frontend therefore MUST treat datasource identity as first-class provenance across messages, executions, tables, charts, and dashboard saves.

The frontend must not assume:

- one datasource per conversation;
- one SQL execution per answer;
- one result set per chart;
- one artifact per answer.

Create one normalized chart-domain layer between backend artifacts and ECharts. A useful conceptual shape is:

```ts
type AnalyticalSeries = {
  id: string
  dataSourceId: string
  dataSourceName: string
  metric: string
  unit?: string | null
  dimension: string
  points: Array<Record<string, string | number | null>>
}

type MultiSourceChartModel = {
  chartType: "line" | "bar" | "area" | "pie"
  dimension: string
  series: AnalyticalSeries[]
  provenance: Array<{ dataSourceId: string; executionId?: string; artifactId?: string }>
}
```

This is a frontend domain model, not a replacement API DTO. Map generated API types into it at the feature boundary.

Rules:

1. Prefer ECharts `dataset` + `series.encode` instead of duplicating large arrays into each series.
2. Multiple backend result sets may become separate ECharts datasets; series explicitly reference their dataset.
3. Only combine series when their comparison is semantically meaningful. Do not merge unrelated result sets merely because the conversation selected multiple data sources.
4. Preserve and expose datasource provenance. If two series share a metric name, legend/tooltip text must disambiguate the datasource.
5. Prefer one shared dimension (especially time) for comparison charts. Normalize formatting, not business meaning. Never invent joins or interpolation in the frontend.
6. Series with the same unit should share an axis. Use a second Y axis only when units genuinely differ and the comparison remains meaningful. Default maximum: **two value axes**.
7. Long time-series charts use ECharts `dataZoom` rather than rendering an unreadable compressed plot.
8. Use shared axis-pointer/tooltips for comparable time-series data. Tooltips identify datasource + metric + value.
9. Keep the legend scrollable/compact when many series exist. Do not assign random colors. Use the design-system categorical sequence deterministically.
10. Every analytical chart provides `View data` when the underlying values are useful to inspect. The data view includes datasource provenance.
11. Empty, partial, truncated, or failed source results must remain visible as states; never silently omit a failed datasource and make the combined chart look complete.
12. Backend artifacts/executions remain authoritative. The browser does not execute SQL, infer cross-source joins, or manufacture missing analytical values.

For a 1–10 datasource selector, use the current documented HeroUI Autocomplete/ComboBox/Select/TagGroup composition appropriate to multi-selection, with selected datasource chips/rows, clear source type/status, keyboard support, and an explicit count. Verify the exact HeroUI v3 API from local docs before implementing. Do not use an enormous modal. The conversation header/composer should keep the current source scope discoverable without consuming excessive vertical space.

---

# 20. Dashboards — Primary Experience

Supported widget types:

```text
metric
table
bar
line
area
pie
```

## 20.1 Dashboard list

Show a dense, clean list/grid with:

- title;
- description when present;
- widget count;
- updated local time;
- primary actions.

Avoid decorative cards.

## 20.2 Dashboard detail

Use a simple responsive grid based on backend `layout_config`.

Do not build a pixel-perfect freeform BI canvas.

Prefer practical widths/heights and a small set of layout behaviors.

Widgets must use the final design system.

## 20.3 Saving from an analysis

A widget is created from provenance:

```text
successful source job
+ successful SQL execution
+ widget type
+ visualization config
```

The Save to Dashboard interaction can use a focused selection dialog because it is a short selection/confirmation task.

Allow:

- choose existing dashboard;
- create a simple new dashboard inline only if it stays small, otherwise route to creation;
- widget type selection where applicable;
- title, defaulting from originating question;
- validated field mapping based on SQL result columns.

Do not allow arbitrary invalid fields.

## 20.4 Widget provenance

Every widget exposes `View source` / provenance details:

- original question;
- datasource;
- SQL;
- originating job;
- originating SQL execution;
- last refreshed local timestamp;
- execution link where available.

This is a core trust feature.

## 20.5 Refresh

Widget refresh:

```text
POST /api/v1/dashboards/widgets/:widgetId/refresh
```

Dashboard refresh:

```text
POST /api/v1/dashboards/:dashboardId/refresh
```

Both are background jobs.

During refresh:

- keep the previous successful visualization visible;
- display restrained refreshing state;
- register refresh job globally;
- subscribe through global job manager;
- refetch dashboard on completion;
- show local widget error without crashing the dashboard when a refresh fails.

## 20.6 Metric widgets

Metric cards must follow `design.md` exactly:

- strong numeric hierarchy;
- tabular numerals;
- restrained metadata;
- no giant marketing-style cards;
- no excessive borders/shadows.

## 20.7 Table widgets

Use HeroUI Table for simple views and the shared TanStack Table patterns defined in this prompt for analytical grids. Use TanStack Virtual where appropriate.

## 20.8 Chart widgets

Use ECharts only.

All dashboards share one chart theme and option builder family.

No 3D charts, decorative gradients, arbitrary color generation, or per-page chart styling.

---

# 21. Data Sources — Keep Simple

Implement complete support without overengineering.

List/detail/create/edit flows need:

```text
PostgreSQL
MySQL
Microsoft SQL Server
Excel
```

Relational create screen collects relevant fields such as:

```text
Name
Host
Port
Database
Username
Password
SSL/encryption options supported by API
```

Requirements:

- routed creation screen;
- React Hook Form + Zod;
- password field includes Show/Hide + Copy;
- Test Connection when available;
- Save;
- clear async job state;
- no credential persistence in browser storage;
- never redisplay saved password.

Excel:

```text
select file
→ upload
→ materialization job
→ global progress
→ user may navigate away
→ ready/failure state
```

Replacement uses the backend safe replacement route.

Do not make datasource setup visually dominate the product.

---

# 22. Models — Keep Simple

Support OpenAI-compatible connection/profile APIs.

Connection fields include:

- display/base URL fields as defined by OpenAPI;
- API key/credential field;
- test connection;
- edit/delete;
- profiles;
- default profile;
- enabled state/generation settings supported by backend.

API key field requires Show/Hide + Copy for the currently entered value.

Never redisplay a saved API key.

Do not build complex provider routing UX; backend intentionally keeps this simple.

---

# 23. Knowledge — Keep Simple but Useful

Knowledge screens should mirror backend architecture:

```text
status
→ compact index
→ searchable table documents
→ load table detail on demand
→ annotations/business definitions
```

Do not eagerly fetch every table document.

Knowledge generation/regeneration is a job and must remain active globally if the user navigates away.

Use split views/search patterns appropriate for dense schema exploration.

---

# 24. Jobs Page

Provide `/jobs` and `/jobs/:jobId`.

Jobs list supports simple status filtering:

```text
All
Queued
Running
Succeeded
Failed
Cancelled
```

Job detail can combine:

- durable state;
- safe event timeline;
- execution trace when applicable;
- links back to originating feature.

Do not expose hidden reasoning.

---

# 25. Settings / Admin

Implement minimal production-useful screens for:

- organization metadata update;
- audit list for owner/admin;
- operational status for owner/admin.

Use role-aware routing/actions.

These are not primary product surfaces.

---

# 26. Time and Date Rules

Backend timestamps represent UTC instants.

Frontend displays them in the browser's local timezone through one shared datetime module.

Use:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone
```

Provide shared helpers conceptually:

```text
formatLocalDateTime
formatLocalDate
formatLocalTime
formatRelativeTime
getLocalTimeZone
toUtcIsoString
```

Do not display raw ISO timestamps in normal UI.

Do not timezone-shift date-only business values.

Tests must cover UTC, Asia/Kolkata, America/New_York, Europe/London, and DST-sensitive cases.

---

# 27. Loading / Empty / Error / Success States

Every major data view must deliberately handle:

```text
loading
empty
success
error
```

Long-running backend operations use durable job states, not indefinite page spinners.

Prefer skeletons/inline progress where appropriate.

Use custom application notifications and inline errors according to `design.md`.

Never use browser-native alert/confirm/prompt.

---

# 28. TanStack Query Standards

Create stable centralized query-key factories per feature.

Examples conceptually:

```ts
queryKeys.conversations.list(orgId)
queryKeys.conversations.detail(orgId, id)
queryKeys.jobs.list(orgId, filters)
queryKeys.jobs.execution(orgId, id)
queryKeys.dashboards.detail(orgId, id)
```

Mutation success should invalidate only affected data.

Examples:

- message submission: keep optimistic user message, then refetch messages on job terminal event;
- dashboard refresh: refetch dashboard on terminal job event;
- datasource materialization: refetch datasource and knowledge status on completion;
- organization switch: clear/invalidate organization-scoped queries.

Do not use broad `invalidateQueries()` without a reason.

Do not mirror Query state into Context.

---

# 29. Performance

Required baseline:

- route-level lazy loading;
- no unnecessary giant bundles;
- avoid request waterfalls;
- use Query parallelization where dependencies allow;
- bounded rendering of long event/trace histories;
- TanStack Table pagination and TanStack Virtual behavior where appropriate;
- avoid rerendering every chart when unrelated Job Center state changes;
- memoize only where profiling/structural reasoning justifies it;
- do not prematurely build complex virtualized abstractions when backend datasets are already bounded.

---

# 30. Security

Verify all of the following:

- no passwords in persistent browser storage;
- no datasource credentials in persistent browser storage;
- no API keys in persistent browser storage;
- saved secrets never redisplayed;
- sensitive values excluded from logs;
- no raw HTML rendering from model Markdown;
- safe external links;
- organization-scoped data cannot bleed across workspace switch;
- authorization failures produce stable UX;
- clipboard Copy action does not log secret values;
- no private model reasoning exposed;
- no backend driver/provider stack traces shown;
- no dangerous use of `dangerouslySetInnerHTML`.

---

# 31. Accessibility

At minimum:

- semantic controls;
- keyboard-operable menus/dialogs/drawers;
- labels for every form field;
- accessible password Show/Hide/Copy actions;
- focus management for dialogs;
- visible focus states;
- status is not communicated by color alone;
- chart title/summary and table fallback where practical;
- sufficient contrast per design system;
- reduced-motion support where relevant.

---

# 32. Testing Strategy

Frontend integration testing is constrained by external backend/model/database dependencies, but this is not permission to skip testing.

Each task must add tests proportional to the functionality.

## Unit tests

Test pure logic such as:

- datetime conversion;
- error normalization;
- chart artifact → ECharts option mapping;
- event normalization/deduplication;
- query-key factories;
- validation schemas;
- dashboard visualization config builders.

## Component tests

Use React Testing Library + MSW to validate behavior:

- loading/empty/error/success;
- forms;
- mutation states;
- credential field Copy/Show behavior;
- conversation updates;
- trace rendering;
- dashboard widget states.

## Integration-style frontend tests

Use MSW to test feature flows across multiple components/providers/routes rather than testing every component in isolation.

Critical mocked integration flows include:

```text
auth → protected route
conversation create → submit question → job/SSE events → final answer/artifacts
SSE disconnect → reconnect → replay → deduplicate
save analysis → dashboard → refresh job → updated widget
Excel upload → navigate away → global job completes
```

## Playwright

Use Playwright for critical user flows.

When a real backend test environment is available, run against it.

When it is not available, do not fabricate a passing result. Run the deterministic mocked/browser E2E suite and clearly document which real-backend checks could not be executed.

---

# 33. Mandatory Quality Gate After Every Task

Every task must end with actual commands and actual results.

At minimum, provide package scripts that support:

```text
format
format:check
lint
typecheck
test
build
test:e2e
```

Before declaring a task complete, run at least:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
```

Run relevant Playwright tests when the task has browser flows and the environment supports them.

Also verify:

- application imports resolve;
- Vite production build succeeds;
- no TypeScript errors;
- generated OpenAPI types are current when API-dependent work changed;
- no `TODO`/placeholder implementation remains for work claimed complete;
- no console errors in critical tested screens.

Never claim a command passed unless you executed it.

Never silence lint/type/test failures to finish a task.

---

# 34. Six-Task Implementation Plan

Complete exactly one task per invocation.

## TASK 1 — Foundation, Design System, API, Auth, Shell

Build the clean frontend foundation.

Implement:

- React + TypeScript + Vite SPA;
- strict TypeScript;
- approved dependencies only;
- formatting/lint/type scripts;
- Tailwind v4 + HeroUI semantic-token implementation from `design.md`, HeroUI v3 installation, and local HeroUI agent docs;
- Inter + Roboto Mono;
- global CSS reset/base;
- central router and route guards;
- TanStack Query provider;
- generated OpenAPI types;
- centralized `openapi-fetch` client;
- normalized errors;
- auth/session service/provider;
- signup/login/logout/forgot/reset/current-user flows;
- organization context/switch-ready architecture;
- safe local preferences module;
- datetime module and timezone tests;
- application shell;
- global notification infrastructure;
- custom confirmation-dialog infrastructure;
- password/secret field component with Show/Hide + Copy;
- loading/error boundary foundations.

Keep future feature routes as minimal routing placeholders only if needed for navigation; do not implement their features yet.

Required tests include:

- login/signup validation;
- invalid login UX;
- protected-route behavior;
- session restoration behavior;
- organization context;
- secret field Show/Hide/Copy;
- no secret persistence;
- datetime/timezone cases;
- responsive shell/navigation basics.

Run the mandatory quality gate and STOP.

---

## TASK 2 — Global Jobs + Simple Data/Model/Knowledge Management

Continue from Task 1. Do not replace the foundation.

First build the reusable asynchronous infrastructure:

- job types/models derived from OpenAPI;
- job Query hooks;
- one SSE service;
- reconnect/replay/deduplication;
- global Job Manager/provider;
- Job Center in header;
- `/jobs` and `/jobs/:id`;
- cancellation;
- safe event-label mapping;
- reload/startup restoration of active jobs.

Then implement deliberately simple management features:

### Data sources

- list;
- create routed screen for PostgreSQL/MySQL/MSSQL;
- Excel upload;
- details;
- edit/delete;
- connection-test job;
- Excel replacement;
- schema view;
- password input Show/Hide + Copy;
- no saved secret redisplay.

### Models

- connection list/create/edit/delete/test;
- profiles;
- default model;
- enabled state/settings supported by API;
- API-key Show/Hide + Copy for user-entered value only.

### Knowledge

- status;
- generate/regenerate job;
- index;
- searchable document list;
- lazy table document loading;
- annotations/business definitions.

Do not overdesign these surfaces.

Required tests include:

- SSE event parsing;
- reconnect/replay/deduplication;
- Job Center survives navigation;
- job cancellation;
- datasource form variants;
- Excel job flow;
- credential redaction/Copy rules;
- model default/test behavior;
- knowledge lazy loading and generation job.

Run the mandatory quality gate and STOP.

---

## TASK 3 — Deep Agent Conversations: Core Product Experience

Continue from Tasks 1–2.

This is a major task and receives priority.

Implement:

- `/ask`;
- conversation list/recent history;
- create conversation with **1–10 data sources** using a verified HeroUI v3 searchable multi-select composition and preserve datasource identity throughout the conversation;
- optional model profile selection;
- `/conversations/:id` durable workspace;
- message history;
- asynchronous message submission;
- immediate durable user-message rendering;
- job registration and global progress;
- real SSE-driven operational progress;
- navigation away while analysis continues;
- browser reload while job is active;
- refetch/reconcile terminal results;
- Markdown assistant answers;
- follow-up composer;
- useful failure categories;
- conversation empty/loading/error states;
- responsive analytical workspace.

The implementation MUST be agnostic to the exact number/order of Deep Agent steps.

Do not expose chain-of-thought.

Required tests include:

- create conversation;
- submit question returns immediately;
- user message appears;
- active job remains visible after route change;
- SSE updates conversation progress;
- reconnect does not duplicate events;
- successful job refetches final assistant message;
- failed/cancelled jobs render correctly;
- reload while job active restores durable state;
- follow-up creates another independent job;
- no private reasoning/secret fields rendered.

Add a Playwright critical conversation flow using a deterministic environment.

Run the mandatory quality gate and STOP.

---

## TASK 4 — Deep Agent Execution Trace, Tables, Charts, Analytical Artifacts

Continue from Task 3.

This is the second major agent task.

Implement the complete inspectable analysis experience:

- `GET /jobs/:id/execution` integration;
- generic normalized execution timeline;
- expandable tool executions;
- SQL execution blocks;
- SQL Copy action;
- row count/truncation/duration/status;
- sanitized SQL errors;
- model execution metadata/tokens when reported;
- text artifact renderer;
- table artifact renderer using HeroUI for simple tables and the shared TanStack Table analytical layer, with TanStack Virtual where appropriate;
- chart artifact adapter;
- bar/line/area/pie ECharts rendering;
- shared ECharts theme from `design.md`;
- responsive chart sizing;
- chart loading/error/data-empty states;
- View data/table fallback where useful;
- support multiple SQL executions and multiple artifacts per answer;
- support analytical outputs from multiple datasources without assuming they can always be merged;
- render compatible multi-source series through the normalized ECharts dataset/encode adapter with datasource-aware legends/tooltips/provenance;
- `Save to dashboard` entry point from successful analytical outputs.

Never accept arbitrary executable ECharts options from backend payloads.

Never assume one SQL query per answer.

Required tests include:

- generic unknown tool renders safely;
- multiple tool/SQL/model executions;
- SQL Copy;
- truncated result indicator;
- nullable token usage;
- table positional row mapping;
- each supported chart type;
- invalid chart field/type fails safely;
- multiple artifacts in one job;
- multiple datasource provenance in table/chart outputs;
- compatible multi-source time-series comparison;
- incompatible units/results remain separated or use a deliberate second axis rather than being silently merged;
- execution trace ordering;
- no hidden prompt/reasoning exposure.

Add/extend Playwright coverage for execution inspection and chart/table rendering.

Run the mandatory quality gate and STOP.

---

## TASK 5 — Dashboards and Reporting

Continue from Task 4.

This is the major reporting task.

Implement:

- `/dashboards`;
- create/edit/delete dashboard;
- `/dashboards/:id`;
- responsive dashboard grid;
- metric widgets;
- table widgets;
- bar/line/area/pie widgets;
- shared chart/data rendering infrastructure reused from agent artifacts;
- Save to Dashboard dialog/workflow from conversation outputs;
- validated visualization field mappings;
- default widget title from originating question when backend provides it;
- widget edit/title/config;
- enable/disable behavior if supported by contract;
- widget delete confirmation;
- dashboard delete confirmation;
- widget provenance / View source;
- SQL/source question/job/execution links;
- async widget refresh;
- async dashboard refresh;
- global Job Center integration;
- retain previous successful widget data while refreshing;
- widget-local failure state;
- dashboard-local loading/empty/error states;
- responsive behavior according to `design.md`.

Do not build a Power BI-style freeform designer.

Required tests include:

- create dashboard;
- empty dashboard;
- save analysis as each applicable widget type;
- metric/table/chart rendering;
- provenance view;
- title edit;
- validation of field mapping;
- widget refresh job;
- dashboard refresh job;
- refresh success/failure;
- one failed widget does not crash dashboard;
- responsive layout behavior.

Add Playwright coverage for:

```text
conversation result → save to dashboard → dashboard render → refresh
```

Run the mandatory quality gate and STOP.

---

## TASK 6 — Production Hardening, Full Validation, Documentation, Final ZIP

Continue from Tasks 1–5. Do not rewrite the product.

Complete production hardening:

### Contract audit

- regenerate OpenAPI types;
- remove stale duplicated DTOs;
- verify all used endpoints match backend;
- verify Deep Agent job/trace logic remains generic.

### Security audit

- secrets not persisted;
- credential Copy behavior safe;
- no saved secrets redisplayed;
- auth storage centralized;
- Markdown safe;
- organization scope safe;
- no private reasoning;
- sanitized errors.

### UX/design audit

- all screens use `design.md` tokens/theme;
- no native browser alerts/confirms/prompts;
- no inappropriate radius/card styling;
- every major screen has loading/empty/success/error;
- mobile/tablet review;
- keyboard/focus/accessibility review;
- chart/table/metric consistency;
- local timezone audit.

### Performance audit

- lazy routes;
- avoid request waterfalls;
- bounded trace/event rendering;
- no obvious unnecessary rerenders;
- reasonable bundle splitting;
- production build inspection.

### Testing

Run the complete suite:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
```

Where a real backend is available, run a real integration E2E flow including:

```text
signup/login
→ organization
→ datasource or prepared fixture
→ knowledge/model prerequisites
→ conversation
→ Deep Agent job
→ SSE
→ execution trace
→ answer + chart/table
→ save dashboard widget
→ refresh widget
→ logout/login persistence
```

Also verify:

```text
refresh browser while analytical job runs
```

and:

```text
disconnect/reconnect SSE
→ replay missing events
→ no duplicates
```

If real external model/database dependencies prevent a deterministic real-backend run, execute the mocked integration and browser E2E suites and document the exact external dependency blocking the real path. Do not fake results.

### Documentation

Complete frontend README covering:

- stack;
- architecture;
- project structure;
- setup;
- environment variables;
- API URL;
- OpenAPI generation;
- auth/session model;
- organization scoping;
- design system;
- state management;
- Deep Agent conversation model;
- jobs/SSE/reconnect;
- execution trace/artifacts;
- charts/TanStack Table;
- dashboards;
- tests;
- production build/deployment.

### Final artifact

Only after all six tasks pass the final quality gate, create a production-ready ZIP of the frontend repository.

Exclude:

```text
node_modules
coverage
playwright-report
test-results
local secrets
.env files containing credentials
build caches
```

Include:

```text
source
package.json
lockfile
public assets
config files
README
.env.example
generated API types or generation workflow as established by repository policy
FRONTEND_IMPLEMENTATION_PROGRESS.md
```

Return the ZIP and final validation report, then STOP.

---

# 35. Continuation Protocol — Critical

This same master prompt may be given to the coding agent repeatedly.

The agent MUST determine the next task from repository evidence, not from assumptions.

Maintain:

```text
FRONTEND_IMPLEMENTATION_PROGRESS.md
```

Recommended structure:

```markdown
# Frontend Implementation Progress

## Task 1 — Complete
- completed at:
- summary:
- validation commands:
- results:

## Task 2 — Incomplete
...
```

At the start of each invocation:

1. inspect repository;
2. inspect progress file;
3. verify the most recently marked completed task still has its expected foundation;
4. choose the earliest incomplete task;
5. perform only that task.

At the end:

1. update progress file;
2. list files changed;
3. list dependencies added;
4. list tests added;
5. list exact commands executed;
6. report actual results;
7. list anything intentionally deferred to a later defined task;
8. STOP.

Never proceed to the next task in the same invocation even when the current task finishes quickly.

Never mark a task complete with failing format/lint/type/test/build checks.

---

# 36. Required Task Completion Response Format

At the end of every task, return:

```text
Task completed: TASK N — <name>

Implemented
- ...

Architecture / important decisions
- ...

Files changed
- ...

Dependencies added/changed
- ...

Tests added
- ...

Commands actually executed
- ...

Actual results
- ...

Deferred to later tasks
- ...

Progress file updated
- yes/no

STOP — waiting for the next invocation.
```

Do not claim success without command evidence.

---

# 37. Explicit Anti-Patterns

The following are prohibited:

## Architecture

- one giant `App.tsx`;
- one giant page implementing an entire domain;
- enormous “universal” components with dozens of booleans;
- business logic in route definitions;
- feature code importing deeply into unrelated feature internals;
- duplicate API clients;
- duplicate SSE logic;
- global mutable state;
- manual duplicated backend DTOs.

## Agent experience

- assuming one SQL query per question;
- assuming fixed Deep Agent tool order;
- showing chain-of-thought;
- displaying fake progress percentages;
- tying job lifetime to the current route/component;
- cancelling a job because SSE disconnected;
- rendering arbitrary executable chart config from AI/backend;
- hiding provenance completely.

## State

- React state for server cache;
- Context containing entire API datasets;
- Redux/Zustand/etc. added without explicit owner approval;
- browser storage used as a database.

## UI

- browser alert/confirm/prompt;
- modal for every workflow;
- giant datasource/model setup wizards unless genuinely required;
- excessive cards;
- large border radius;
- inconsistent chart palettes;
- duplicate ad-hoc table engines instead of the shared TanStack Table abstraction.

## Security

- saved secret redisplay;
- localStorage passwords/API keys;
- logging secret values;
- raw provider/database errors;
- unsafe Markdown HTML.

## Testing

- tests that assert implementation details instead of behavior;
- disabling failing tests;
- claiming Playwright/integration success without execution;
- finishing a task when the production build fails.

---

# 38. Definition of Done for the Entire Frontend

The frontend is production-ready only when all are true:

## Architecture

- modular feature-oriented source tree;
- no giant components/pages;
- loose coupling;
- approved dependency stack only;
- React SPA, no SSR dependency;
- reusable design/theme layer;
- reusable chart/table/job infrastructure.

## Backend integration

- OpenAPI-generated types;
- centralized typed client;
- all required endpoint families integrated;
- organization scoping correct;
- Deep Agent frontend is event/trace driven rather than fixed-pipeline driven.

## Agent

- async conversation jobs;
- global progress;
- navigation/reload resilience;
- SSE reconnect/replay/deduplication;
- multiple tool/SQL/model calls supported;
- text/table/chart artifacts supported;
- safe execution trace;
- no private reasoning.

## Dashboards

- all six widget types supported;
- provenance available;
- async refresh;
- local widget failure isolation;
- clean responsive layout;
- consistent ECharts design.

## Setup

- datasource/model/knowledge flows complete but simple;
- credential input Show/Hide/Copy;
- saved secrets never redisplayed.

## Design

- `design.md` implemented;
- no native alerts;
- effectively zero radius;
- data-dense hierarchy;
- Inter + Roboto Mono;
- correct tables/metrics/charts.

## Quality

- formatting passes;
- lint passes;
- TypeScript passes;
- unit/component tests pass;
- production build passes;
- relevant Playwright tests pass in available environment;
- external integration limitations explicitly reported rather than fabricated;
- README complete;
- final ZIP created only after Task 6.

---

# 39. Final Instruction to the Coding Agent

Build less custom infrastructure and get more value from the approved libraries.

Optimize for:

```text
clarity
+ reliability
+ inspectability
+ maintainability
+ strong agent UX
+ strong dashboard UX
```

not for maximum abstraction or maximum feature count.

The backend owns agent reasoning, SQL safety, durable jobs, and analytical truth.

The frontend owns a trustworthy human experience around those capabilities.

On this invocation, identify the earliest incomplete task, complete only that task, run its full quality gate, update `FRONTEND_IMPLEMENTATION_PROGRESS.md`, report actual results, and STOP.
