# FantasyTrack Design

**Date:** 2026-02-28
**Stack:** Next.js + Turso (libSQL) + Vercel

## Problem

An easy-to-use web tool to track fantasy football player rankings week over week, using free and open data.

## Data Source

Sleeper API — free, no authentication required. ADP (Average Draft Position) is used as the ranking signal. Lower ADP = ranked higher.

## Architecture

```
Sleeper API (free, no auth)
       │
       ▼
Vercel Cron Job (weekly)
       │  fetches player ADP, stores snapshot
       ▼
Turso (hosted libSQL)
       │
       ▼
Next.js API Routes  ──►  Next.js UI (React)
                              │
                         Player table
                         Position/team filters
                         Rank trend chart (per player)
```

## Data Model

### `players`
| column    | type    | notes                  |
|-----------|---------|------------------------|
| player_id | text PK | Sleeper's player ID    |
| name      | text    | full name              |
| position  | text    | QB, RB, WR, TE, K, DEF|
| team      | text    | NFL team abbreviation  |

### `snapshots`
| column     | type       | notes                                          |
|------------|------------|------------------------------------------------|
| id         | integer PK | auto-increment                                 |
| player_id  | text FK    | references players                             |
| week       | integer    | NFL week number                                |
| season     | integer    | year (e.g. 2025)                               |
| adp        | real       | Average Draft Position from Sleeper            |
| rank_change| real       | previous week ADP minus this week ADP          |

Positive `rank_change` = improved ranking. Negative = fell.

## UI Components

- **Player table** — all players; columns: name, position, team, current ADP, rank change (up/down indicator)
- **Filters** — position (All, QB, RB, WR, TE, K, DEF) and team dropdown
- **Player detail** — click a row to see a line chart of ADP over all stored weeks
- **Last updated** — timestamp of most recent snapshot

## Data Flow

### Weekly snapshot (write path)
1. Vercel cron hits `POST /api/cron/snapshot` once per week
2. Fetch all players from Sleeper: `GET https://api.sleeper.app/v1/players/nfl`
3. Fetch ADP data from Sleeper stats endpoint
4. Upsert player records; insert snapshot rows into Turso
5. Route protected by `CRON_SECRET` env var (set automatically by Vercel)

### Page load (read path)
1. `GET /api/players?position=RB&team=KC` — latest snapshot per player + rank_change
2. React renders filterable player table
3. Click a player → `GET /api/players/[id]/history` → all snapshots → line chart

## Error Handling

- Sleeper API down during cron: log error, skip — do not wipe existing data
- Turso write failure mid-batch: partial snapshot discarded, no partial state shown to users
- UI shows empty state until first snapshot runs

## Testing

- No automated tests for v1
- Manual seed: hit `POST /api/cron/snapshot` directly to populate data without waiting for the cron schedule

## Environment Variables

| variable          | notes                              |
|-------------------|------------------------------------|
| TURSO_DATABASE_URL| Turso database connection URL      |
| TURSO_AUTH_TOKEN  | Turso auth token                   |
| CRON_SECRET       | Set automatically by Vercel        |
