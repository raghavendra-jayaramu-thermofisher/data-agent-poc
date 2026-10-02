# Data Agent development ports

All ports below are local host TCP ports, bound to `127.0.0.1`.

## Main project — 12100–12199

- Location: `backend/`, `frontend/` (currently empty).
- Range reserved; assign service ports when implemented.

## POC — 12200–12299

- Location: `space/poc/`.
- Frontend: `12200`.
- API: `12201`.
- PostgreSQL: `12202` (optional host access).
- Redis: `12203` (optional host access).
- MySQL script generator Streamlit UI: `12204` (optional standalone tool).
- Worker and migrations: no host port.

## Legacy code — 12300–12399

- Location: `space/old/code/`.
- API: `12301`.
- Static `index.html`: no dedicated frontend server port assigned.

## Future new codebase — 12400–12499

- Codebase does not exist yet; range reserved with no service assignments.

- POC and legacy configuration updated; restart manually to apply.
- Publish PostgreSQL/Redis only when host access is needed. Docker-internal ports stay API `8000`, PostgreSQL `5432`, Redis `6379`.
- Assign additional services any unused port within their codebase's range; no fixed service order is required.
- Checked on 2026-10-02: no listeners or Windows TCP exclusions in these ranges. Check again before use.
