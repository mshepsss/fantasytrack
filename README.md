# FantasyTrack

A web app that tracks NFL fantasy football player rankings week-over-week using free data from the [Sleeper API](https://docs.sleeper.com/). Monitor how players' projected points and positional rankings change throughout an NFL season.

**Live site:** Deployed on [Vercel](https://vercel.com/)

## Features

- **Filterable player table** — browse all tracked players with rank, position, team, projected points, and trend indicators
- **Rank trend badges** — color-coded arrows (▲ green = improved, ▼ red = declined) showing week-over-week rank changes
- **Player history charts** — click any player to view a line chart of their rank movement across all tracked weeks
- **Position & team filters** — narrow results by position (QB, RB, WR, TE, K) or NFL team
- **Automated weekly snapshots** — Vercel cron job fetches fresh projections every Tuesday after Monday Night Football
- **Mock data seeder** — built-in endpoint to generate realistic test data for development

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | TypeScript (strict mode) |
| UI | React 19 |
| Charts | [Recharts](https://recharts.org/) |
| Database | [Turso](https://turso.tech/) (hosted libSQL / SQLite) |
| Data source | [Sleeper API](https://docs.sleeper.com/) (free, no auth required) |
| Deployment | [Vercel](https://vercel.com/) with cron scheduling |

## How it works

### Data pipeline

1. **Vercel cron** triggers `POST /api/cron/snapshot` every Tuesday at noon UTC
2. The endpoint fetches all NFL players and their weekly projections from Sleeper
3. Players are grouped by position and ranked 1–N by projected PPR points
4. Rankings are stored as snapshots in Turso (one row per player per week)
5. If projections aren't available yet, it falls back to actual stats

### Read path

1. `PlayersPage` (server component) fetches the latest player rankings from the database
2. `PlayersClient` renders the filterable table and manages selected player state
3. Clicking a player fetches their full history and renders a rank-over-time chart

### Database schema

**`players`** — player metadata (ID, name, position, team)

**`snapshots`** — weekly ranking data (player ID, week, season, rank, projected points), with a unique constraint on `(player_id, week, season)`

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/snapshot/        # Weekly data sync (Vercel cron)
│   │   ├── players/              # All players with latest snapshot
│   │   ├── players/[id]/history/ # Player trend data
│   │   └── seed-mock/            # Mock data generator
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   ├── PlayersPage.tsx           # Server component — initial data fetch
│   └── PlayersClient.tsx         # Client component — table + chart state
├── components/
│   ├── PlayerTable.tsx           # Filterable table with trend badges
│   └── PlayerChart.tsx           # Recharts line chart for rank history
├── lib/
│   ├── db.ts                     # Turso client
│   ├── schema.sql                # Database schema
│   └── sleeper.ts                # Sleeper API client + NFL week calculator
└── scripts/
    └── init-db.ts                # Database initialization
```

## Getting started

### Prerequisites

- Node.js 18+
- A [Turso](https://turso.tech/) database (free tier works)

### Setup

```bash
git clone https://github.com/mshepsss/fantasytrack.git
cd fantasytrack
npm install
```

Create a `.env` file (see `.env.example`):

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
CRON_SECRET=dev-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Initialize the database and start the dev server:

```bash
npm run db:init
npm run dev
```

### Seed data for development

Generate mock data (5 weeks of realistic rankings):

```bash
curl -X POST http://localhost:3000/api/seed-mock \
  -H "Authorization: Bearer dev-secret"
```

Or trigger a real snapshot manually:

```bash
curl -X POST http://localhost:3000/api/cron/snapshot \
  -H "Authorization: Bearer dev-secret"
```

## Deployment

1. Push to GitHub and connect the repo to [Vercel](https://vercel.com/)
2. Add environment variables in Vercel project settings:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `NEXT_PUBLIC_BASE_URL` (your production URL)
3. The cron job (`vercel.json`) runs automatically every Tuesday at noon UTC

## Built with

This project was built with [Claude Code](https://claude.ai/claude-code).
