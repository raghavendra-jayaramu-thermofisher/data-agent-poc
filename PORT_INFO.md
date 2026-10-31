# Data Agent development ports

Default local ports, bound to `127.0.0.1`:

| Service | Port |
| --- | --- |
| Frontend | `12200` |
| API | `12201` |
| PostgreSQL (optional host access) | `12202` |
| Redis (optional host access) | `12203` |

Worker and migrations do not expose ports. Container-internal ports are frontend `80`, API `8000`, PostgreSQL `5432`, and Redis `6379`.
