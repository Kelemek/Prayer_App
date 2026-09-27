# Local RLS full sweep acceptance (plan §7)

**Hosted Supabase:** not used. Database is Docker Postgres on `127.0.0.1:54322` only.

## Run

```bash
./local-db-recreate.sh   # migrations through 20260927140000 + seed
./run-rls-acceptance.sh  # writes rls-acceptance-results.log
```

Seed uses synthetic `@example.com` addresses only (no production credentials).

## Plan mapping

| ID | Plan section |
|----|----------------|
| 7.1.1–7.1.7 | §7.1 structure |
| 7.2.1–7.2.5c | §7.2 anon |
| 7.3.1–7.3.5 | §7.3 tenant-A member |
| 7.4.1–7.4.4 | §7.4 tenant-A admin |
| 7.5.1–7.5.8 | §7.5 write probes (`begin` / `rollback`) |

SQL text matches `uploads/rls-full-sweep-plan.md` §7 with placeholders replaced in `run-rls-acceptance.sh`.
