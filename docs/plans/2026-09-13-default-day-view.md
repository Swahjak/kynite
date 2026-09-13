# Default calendar view = day — tracking

Goal: hub calendar (and app calendar if same code path) opens in `day` view by default, identical to `/nl/calendar?view=day`. Explicit `?view=` still wins; persisted user preference (localStorage) still wins if it exists.

## Steps

- [x] S1 — find where the default view is resolved (hub + app), switch to `day`, adjust tests (sonnet)
- [x] R — review diff (sonnet) → fix → merge → deploy

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| s1 | S1 default day view | sonnet | 80k | 31 | done `fb4fa33` — hub already `hubDefaultView ?? 'day'`; only app fallback changed |
| r | review | main thread | — | — | 2-line diff, 0 findings |
