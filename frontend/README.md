# DB Assistant Frontend

Production client for **DB Assistant**, a data-dense conversational analytics application backed by durable asynchronous Deep Agent jobs.

The frontend is a **client-side React SPA**. The backend owns analytical reasoning, SQL safety, durable jobs, model execution, datasource access, and persisted analytical truth. The browser owns a trustworthy human interface around those capabilities: authentication, workspace scoping, live job observability, conversations, inspectable execution traces, analytical tables/charts, and reusable dashboards.

## Stack

The implementation uses the pinned project baseline:

- React `19.2.8` + React DOM `19.2.8`
- Vite `8.2.2` + TypeScript `6.0.2`
- Tailwind CSS `4.3.3`
- HeroUI v3 `3.2.4`
- React Router `8.3.0`
- TanStack Query `5.102.2`
- TanStack Table `9.1.2` + TanStack Virtual `3.14.10`
- React Hook Form `7.86.0` + Zod `4.4.3`
- Apache ECharts `6.1.0` + `echarts-for-react` `3.0.6`
- `openapi-typescript` `7.13.0` + `openapi-fetch` `0.17.0`
- `@microsoft/fetch-event-source` `2.0.1`
- `react-markdown` + `remark-gfm`
- Vitest + React Testing Library + MSW
- Playwright

Do not add a competing component system, state store, table/grid engine, chart library, API client, form library, validation library, or SSE implementation without an explicit architecture decision.

## Architecture

The source tree is feature-oriented:

```text
src/
  app/               router, providers, error boundary, route guards
  api/               OpenAPI contract, typed client, normalized errors, query keys
  auth/              session lifecycle and authentication screens
  organizations/     active workspace selection and request scoping
  jobs/              global durable jobs, SSE, Job Center, job pages
  data-sources/      PostgreSQL/MySQL/MSSQL/Excel management
  models/            OpenAI-compatible connections and model profiles
  knowledge/         knowledge generation, index/documents, annotations
  conversations/     Ask and durable analytical conversation workspaces
  agent/             execution trace and persisted artifact inspection
  analytics/         shared analytical table layer
  charts/            normalized analytical chart domain + ECharts builders
  dashboards/        reusable reporting and refresh workflows
  settings/          organization, audit, operational status
  components/        product-owned shared UI behavior
  layouts/           protected application shell
  lib/               datetime, preferences, security display helpers
  theme/             design tokens and ECharts theme
  test/              shared MSW/test setup

e2e/                 deterministic browser flows
```

Pages orchestrate route state and feature hooks. API calls, validation, analytical transforms, and reusable UI behavior live in focused modules rather than giant page components.

## Local requirements

Use **Node 22.22.2 or newer** (or a newer current/LTS release compatible with the pinned stack). Several pinned packages, including React Router 8.3 and jsdom 30.0.1, require a recent Node 22 patch level.

The backend normally runs at:

```text
http://localhost:8000
```

The frontend expects the current DB Assistant backend OpenAPI contract at `/openapi.json`.

## Setup

```bash
npm ci --legacy-peer-deps
cp .env.example .env.local
npm run api:generate
npm run dev
```

The project is then available at the URL printed by Vite.

`package-lock.json` is committed. Do not run broad `npm update` commands during feature work.

### Environment variables

`.env.example` defines the only required frontend environment value today:

```text
VITE_API_BASE_URL=http://localhost:8000
```

`VITE_API_BASE_URL` is the backend origin only; do **not** include `/api/v1`.

Never place database passwords, model API keys, refresh tokens, or other secrets in Vite environment variables. Vite client variables are browser-visible.

## OpenAPI contract generation

The backend OpenAPI document is the API DTO source of truth.

Normal generation:

```bash
npm run api:generate
```

The generator reads:

```text
src/api/generated/openapi.json
```

and writes:

```text
src/api/generated/schema.ts
```

When the backend contract changes, replace the checked-in OpenAPI snapshot with the current backend `/openapi.json`, regenerate types, and commit both the snapshot and generated schema according to repository policy.

`scripts/generate-fallback-api-types.py` exists only as an offline recovery tool for restricted environments. Normal development should use the pinned `openapi-typescript` workflow.

## API client and errors

All application HTTP requests use the single `openapi-fetch` client in `src/api/client.ts`.

The client owns:

- backend base URL;
- access-token Authorization header;
- active `X-Organization-ID` header;
- serialized refresh-token rotation;
- one safe retry after a successful refresh;
- normalized application errors.

Feature components do not issue raw API `fetch()` calls.

Normalized failures use the shared `AppError` contract rather than rendering provider/database stack traces.

## Authentication and session model

The current backend returns access and rotating refresh tokens in JSON rather than using an HTTP-only refresh cookie.

Frontend behavior is therefore isolated in `src/auth/session-storage.ts` and `src/api/client.ts`:

```text
login/signup
→ store token pair in centralized session storage
→ GET /auth/me
→ load organizations
→ enter protected application
```

On an authenticated `401`:

```text
one serialized refresh rotation
→ atomically replace access + refresh tokens
→ retry original request once
→ clear session if refresh fails
```

Passwords are never stored. Refresh/access tokens are not placed in the preferences/local-storage module.

Public routes:

```text
/login
/signup
/forgot-password
/reset-password
```

All application routes are protected by the central route guard.

## Organization/workspace scoping

Most backend resources are organization-owned. Once an active workspace is resolved, all organization-scoped requests include:

```http
X-Organization-ID: <organization-id>
```

The active organization is owned by `OrganizationProvider`.

On workspace switch, organization-owned TanStack Query state is reset/refetched so data from the previous workspace is not allowed to remain visible under the new workspace.

Only safe workspace preferences, such as the last selected organization ID, are stored locally.

## Design system

`design.md` is the visual contract.

Important implementation rules:

- HeroUI v3 provides interaction/accessibility behavior.
- Tailwind CSS v4 provides layout/theme expression.
- CSS import order is `tailwindcss` then `@heroui/styles`.
- `--radius: 0px` and `--field-radius: 0px` are global.
- Inter is used for product/UI text.
- Roboto Mono is used for SQL and technical identifiers.
- flat surfaces and borders are preferred over shadows;
- no native `alert()`, `confirm()`, or `prompt()`;
- complex create/edit workflows are routed screens;
- short destructive confirmations use the shared confirmation dialog;
- ECharts is the only chart runtime;
- no arbitrary server-provided ECharts option object is executed.

## State ownership

State has one owner:

- API/remote state → TanStack Query
- forms → React Hook Form
- validation → Zod
- local interaction state → React state
- shareable filters/identity → React Router params/search params
- global auth/workspace/jobs/notifications → narrow providers
- safe display preferences → `src/lib/preferences.ts`

There is no Redux/Zustand-style application store.

## Global jobs and SSE

Long-running work is a backend job, not a page spinner.

The global Job Manager owns:

- queued/running/recent jobs;
- active authenticated SSE streams;
- durable event sequence cursors;
- replay after reconnect;
- duplicate-event suppression;
- reconciliation with `GET /jobs/:id`;
- terminal Query invalidation;
- global completion/failure notifications.

SSE endpoint:

```text
GET /api/v1/jobs/:jobId/events
```

Connections send Authorization and organization headers and resume with the highest processed sequence using `Last-Event-ID`/`after_sequence` semantics.

A disconnected stream never means the analytical job was cancelled or failed.

At application startup, queued/running jobs are restored and active streams reconnect. The Job Center remains available from every protected route.

## Deep Agent conversations

Primary routes:

```text
/ask
/conversations/:conversationId
```

The Ask flow supports 1–10 data sources and an optional model profile.

A question is asynchronous:

```text
create/reuse conversation
→ POST message
→ receive durable message_id + job_id
→ render user question immediately
→ register global job
→ display safe operational events
→ allow navigation/reload
→ refetch persisted messages and execution on terminal state
```

The frontend makes no assumption about a fixed Deep Agent tool sequence or one SQL statement per question.

Assistant Markdown uses `react-markdown` + GFM with raw HTML disabled. Unsafe link protocols are rejected.

Private chain-of-thought, hidden prompts, scratchpads, credentials, and arbitrary job payload dumps are never rendered.

## Execution trace and analytical artifacts

`GET /api/v1/jobs/:jobId/execution` supplies persisted:

```text
tools[]
sql[]
models[]
artifacts[]
```

The UI normalizes them into a generic chronological trace.

SQL inspection includes SQL text, datasource provenance, status, rows, truncation, duration, result size when available, local timestamp, sanitized error, and Copy SQL.

Model usage is displayed only when the backend actually reports it; null usage is shown as “Not reported,” never fabricated as zero.

Persisted artifact kinds:

```text
text
table
chart
```

### Analytical tables

Small configuration tables use HeroUI Table.

Analytical result sets use the shared TanStack Table layer and TanStack Virtual for larger bounded rows. It supports the product-required behaviors without introducing a second grid engine.

### Charts

ECharts is the sole chart engine.

The normalized chart layer supports:

```text
bar
line
area
pie
```

It validates the backend artifact and constructs frontend-controlled ECharts options using the shared design tokens.

Where practical it uses ECharts `dataset` + `series.encode`, reuses datasets for series that share a result set, uses `dataZoom` for long time series, and provides View Data.

Datasource provenance remains first class. The browser never invents joins, interpolation, or analytical values across unrelated sources.

## Dashboards

Routes:

```text
/dashboards
/dashboards/:dashboardId
```

Dashboard widget types:

```text
metric
table
bar
line
area
pie
```

A widget is created from persisted analytical provenance:

```text
successful source job
+ successful SQL execution
+ validated visualization mapping
```

Every widget exposes source/provenance including the original question, datasource, SQL, source job/execution, and refresh timestamp.

Widget and dashboard refresh operations are background jobs. Existing successful visualization remains visible while refresh runs, and one failed widget does not crash the dashboard.

The layout is a bounded responsive grid rather than a pixel-perfect BI canvas.

## Data sources

Supported user-facing data source types:

```text
PostgreSQL
MySQL
Microsoft SQL Server
Excel
```

Excel upload/replacement creates durable backend materialization jobs and can continue while the user navigates elsewhere.

Stored datasource passwords are never returned or redisplayed. Credential edit uses explicit replacement fields only.

## Models

The frontend supports OpenAI-compatible model connections and profiles:

- connection create/edit/delete;
- optional API-key replacement/clear;
- direct connection test;
- profiles and default profile;
- enabled state and supported generation settings.

Stored API keys are never redisplayed.

## Knowledge

Knowledge follows the backend’s selective-loading architecture:

```text
status
→ compact index
→ searchable document summaries
→ one document/table detail on demand
```

Knowledge generation/regeneration runs as a durable background job.

Business annotations support datasource, table, column, and metric scopes.

## Settings and administration

Routes:

```text
/settings/organization
/settings/audit
/settings/operations
```

Organization metadata is always readable; rename is owner/admin only.

Audit and operational-status requests are owner/admin-only and are not issued for member roles.

Arbitrary audit/operations metadata is recursively filtered for credential/token-like keys before being displayed.

## Local date/time rules

Backend timestamps are UTC instants. All user-facing timestamp formatting goes through `src/lib/datetime.ts` and displays the browser’s local timezone.

Helpers include local date/time, date, time, relative time, timezone detection, and UTC ISO conversion.

Date-only business values are not timezone shifted.

Timezone tests cover UTC, Asia/Kolkata, America/New_York, Europe/London, and DST-sensitive behavior.

## Security model

Frontend security constraints include:

- no passwords/API keys/database credentials in local preferences;
- stored backend secrets are never reconstructed or redisplayed;
- auth storage is centralized;
- secret values are not logged;
- Copy actions copy only current in-memory form values;
- no raw untrusted HTML from assistant Markdown;
- safe external-link handling;
- active organization is centrally scoped;
- organization-owned Query data is reset on workspace switch;
- execution trace suppresses private reasoning/prompt/credential-shaped fields;
- audit/ops arbitrary JSON is recursively redacted before display;
- no native browser dialogs;
- no raw backend/provider/database stack traces shown to users.

## Accessibility

The application uses HeroUI/React Aria behavior for standard controls and overlays. Product-owned components use semantic elements and accessible names.

Key rules include keyboard-operable navigation/dialogs/drawers, visible focus states, labels for fields, status text beyond color, reduced-motion CSS, table fallback for analytical charts where practical, and responsive mobile navigation.

## Testing

Available scripts:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
```

Unit/component/integration-style tests use Vitest, React Testing Library, and MSW.

Browser E2E tests use Playwright and deterministic API/SSE route mocks for critical flows including:

- protected shell/navigation;
- datasource/Excel/model/knowledge management;
- conversation → durable job → navigation/reload → final answer;
- execution trace/table/chart inspection;
- conversation result → save dashboard → refresh.

A real-backend E2E environment additionally requires the backend, PostgreSQL, Redis, at least one prepared datasource or fixture, and a usable configured model provider. Do not report a real-backend run as passing unless those external dependencies were actually available.

## Production build and deployment

Create a production build with:

```bash
npm run build
```

Vite outputs the static SPA to `dist/`.

Deploy `dist/` behind any static web server/CDN that supports SPA history fallback: unknown frontend paths such as `/conversations/<id>` must serve `index.html`, while `/api` remains handled by the backend origin configured through `VITE_API_BASE_URL`.

Recommended deployment checks:

1. provide the production backend origin at build time;
2. configure backend CORS for the frontend origin;
3. configure SPA history fallback;
4. serve over HTTPS;
5. avoid injecting secrets into frontend environment variables;
6. run the complete quality gate before promotion.

The application is intentionally client-side only. There is no Next.js, SSR, server-components, or Node application server requirement for the built frontend.

## Project implementation progress

`FRONTEND_IMPLEMENTATION_PROGRESS.md` records the six gated implementation tasks, commands actually executed, validation results, and any environment limitations. It must remain truthful: do not mark a command passed unless it was actually executed successfully.
