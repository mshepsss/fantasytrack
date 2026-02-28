# FantasyTrack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js web app that fetches weekly NFL player projections from the Sleeper API, stores snapshots in Turso, and displays week-over-week rank trends in a filterable table with per-player charts.

**Architecture:** Next.js App Router handles both the React UI and API routes. A Vercel cron job hits `/api/cron/snapshot` weekly to pull Sleeper projections and upsert into Turso (hosted libSQL). The UI queries `/api/players` for the ranked table and `/api/players/[id]/history` for per-player trend charts.

**Tech Stack:** Next.js 15, TypeScript, Turso (@libsql/client), Sleeper API (free, no auth), Recharts (line charts), Vercel (hosting + cron), Tailwind CSS (styling)

**Ranking signal:** Players are ranked by projected PPR fantasy points for the week (from Sleeper projections). Rank 1 = highest projected scorer at that position. Rank change = previous week rank minus current week rank (positive = improved, negative = fell).

**No automated tests for v1** — manual verification steps are provided instead.

---

### Task 1: Convert scaffold to Next.js

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `next.config.ts`

**Step 1: Install Next.js and UI dependencies**

```bash
npm install next@15 react react-dom recharts
npm install --save-dev @types/react @types/react-dom eslint eslint-config-next
npm install @libsql/client
```

**Step 2: Update `package.json` scripts**

Replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```

**Step 3: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

**Step 5: Create `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FantasyTrack',
  description: 'Track NFL fantasy football player ranking trends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

**Step 6: Create `src/app/globals.css`**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f8fafc;
  color: #1e293b;
}
```

**Step 7: Create `src/app/page.tsx` (placeholder)**

```typescript
export default function Home() {
  return <main style={{ padding: '2rem' }}><h1>FantasyTrack</h1></main>
}
```

**Step 8: Verify the dev server starts**

```bash
npm run dev
```

Expected: Server running at `http://localhost:3000`. Visit in browser — see "FantasyTrack" heading.

**Step 9: Commit**

```bash
git add -A
git commit -m "scaffold next.js app with turso and recharts dependencies"
```

---

### Task 2: Set up database schema

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/schema.sql`
- Create: `src/scripts/init-db.ts`

**Step 1: Create `src/lib/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  position  TEXT NOT NULL,
  team      TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id      TEXT    NOT NULL REFERENCES players(player_id),
  week           INTEGER NOT NULL,
  season         INTEGER NOT NULL,
  rank           INTEGER NOT NULL,
  projected_pts  REAL,
  UNIQUE(player_id, week, season)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_player ON snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_week   ON snapshots(season, week);
```

**Step 2: Create `src/lib/db.ts`**

```typescript
import { createClient } from '@libsql/client'

if (!process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL is not set')
if (!process.env.TURSO_AUTH_TOKEN)   throw new Error('TURSO_AUTH_TOKEN is not set')

export const db = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})
```

**Step 3: Create `src/scripts/init-db.ts`**

This script reads the schema SQL and runs it against Turso.

```typescript
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const sql = readFileSync(join(process.cwd(), 'src/lib/schema.sql'), 'utf-8')
const statements = sql.split(';').map(s => s.trim()).filter(Boolean)

for (const statement of statements) {
  await db.execute(statement)
}

console.log('Database initialized.')
```

**Step 4: Add init script to `package.json`**

Add to the `scripts` block:

```json
"db:init": "node --import tsx/esm src/scripts/init-db.ts"
```

Then install tsx:

```bash
npm install --save-dev tsx
```

**Step 5: Set up Turso locally**

Create a Turso account at https://turso.tech (free tier). Then:

```bash
# Install Turso CLI
npm install -g @turso/cli

# Log in
turso auth login

# Create the database
turso db create fantasytrack

# Get the URL and token
turso db show fantasytrack --url
turso db tokens create fantasytrack
```

**Step 6: Add env vars to `.env`**

```
TURSO_DATABASE_URL=libsql://fantasytrack-<your-org>.turso.io
TURSO_AUTH_TOKEN=<token from above>
```

Also update `.env.example`:

```
ANTHROPIC_API_KEY=your_key_here
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
```

**Step 7: Run the init script**

```bash
npm run db:init
```

Expected: `Database initialized.` with no errors.

**Step 8: Commit**

```bash
git add src/lib/db.ts src/lib/schema.sql src/scripts/init-db.ts package.json package-lock.json .env.example
git commit -m "add turso db client and schema init script"
```

---

### Task 3: Build Sleeper API client

**Files:**
- Create: `src/lib/sleeper.ts`

**Step 1: Create `src/lib/sleeper.ts`**

```typescript
const SLEEPER_BASE = 'https://api.sleeper.app/v1'

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K'

export interface SleeperPlayer {
  player_id:       string
  full_name?:      string
  first_name?:     string
  last_name?:      string
  position?:       string
  fantasy_positions?: string[]
  team?:           string
  active?:         boolean
}

export interface SleeperProjection {
  pts_ppr?:        number
  pts_half_ppr?:   number
  pts_std?:        number
}

export const TRACKED_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K']

export async function fetchAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  const res = await fetch(`${SLEEPER_BASE}/players/nfl`, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Sleeper /players/nfl failed: ${res.status}`)
  return res.json()
}

export async function fetchProjections(
  season: number,
  week: number,
): Promise<Record<string, SleeperProjection>> {
  const res = await fetch(
    `${SLEEPER_BASE}/projections/nfl/${season}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K`,
    { next: { revalidate: 0 } },
  )
  if (!res.ok) throw new Error(`Sleeper projections failed: ${res.status}`)
  return res.json()
}

/** Returns the current NFL season year and week based on the 2025 season calendar. */
export function getCurrentNFLWeek(): { season: number; week: number } {
  // 2025 NFL regular season: Week 1 starts September 4, 2025 (Thursday)
  const seasonStart = new Date('2025-09-04T00:00:00Z')
  const now = new Date()

  if (now < seasonStart) {
    // Offseason — return last week of previous season
    return { season: 2024, week: 18 }
  }

  const daysSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  const week = Math.min(Math.max(Math.floor(daysSinceStart / 7) + 1, 1), 18)
  return { season: 2025, week }
}
```

**Step 2: Verify the API is reachable**

Create a quick one-off test script `src/scripts/test-sleeper.ts`:

```typescript
import { fetchAllPlayers, fetchProjections, getCurrentNFLWeek } from '../lib/sleeper.js'

const { season, week } = getCurrentNFLWeek()
console.log(`Current NFL week: Season ${season}, Week ${week}`)

const players = await fetchAllPlayers()
console.log(`Fetched ${Object.keys(players).length} players`)

const projections = await fetchProjections(season, week)
console.log(`Fetched projections for ${Object.keys(projections).length} players`)

// Show top 5 by pts_ppr
const top5 = Object.entries(projections)
  .filter(([, p]) => (p.pts_ppr ?? 0) > 0)
  .sort(([, a], [, b]) => (b.pts_ppr ?? 0) - (a.pts_ppr ?? 0))
  .slice(0, 5)

for (const [id, proj] of top5) {
  const player = players[id]
  console.log(`${player?.full_name ?? id}: ${proj.pts_ppr?.toFixed(1)} pts`)
}
```

Run it:

```bash
npx tsx src/scripts/test-sleeper.ts
```

Expected: Player count > 5000, projection count > 0, top 5 names printed with points.

**Step 3: Delete the test script**

```bash
rm src/scripts/test-sleeper.ts
```

**Step 4: Commit**

```bash
git add src/lib/sleeper.ts
git commit -m "add sleeper api client with player and projection fetching"
```

---

### Task 4: Build snapshot cron route

**Files:**
- Create: `src/app/api/cron/snapshot/route.ts`

This route fetches current Sleeper projections, ranks players by projected points per position, and upserts into Turso.

**Step 1: Create `src/app/api/cron/snapshot/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  fetchAllPlayers,
  fetchProjections,
  getCurrentNFLWeek,
  TRACKED_POSITIONS,
  type Position,
} from '@/lib/sleeper'

export async function POST(req: NextRequest) {
  // Verify cron secret (Vercel sets Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Allow manual override via query params
  const url = new URL(req.url)
  const { season, week } = getCurrentNFLWeek()
  const targetSeason = parseInt(url.searchParams.get('season') ?? String(season))
  const targetWeek   = parseInt(url.searchParams.get('week')   ?? String(week))

  try {
    const [allPlayers, projections] = await Promise.all([
      fetchAllPlayers(),
      fetchProjections(targetSeason, targetWeek),
    ])

    // Group players with projections by position
    const byPosition: Record<Position, Array<{ id: string; pts: number }>> = {
      QB: [], RB: [], WR: [], TE: [], K: [],
    }

    for (const [playerId, proj] of Object.entries(projections)) {
      const player = allPlayers[playerId]
      if (!player) continue

      const pos = (player.fantasy_positions?.[0] ?? player.position) as Position
      if (!TRACKED_POSITIONS.includes(pos)) continue
      if (!player.active) continue

      const pts = proj.pts_ppr ?? 0
      if (pts <= 0) continue

      byPosition[pos].push({ id: playerId, pts })
    }

    // Sort each position group by pts descending → rank = index + 1
    let upsertedPlayers = 0
    let insertedSnapshots = 0

    for (const pos of TRACKED_POSITIONS) {
      const ranked = byPosition[pos].sort((a, b) => b.pts - a.pts)

      for (let i = 0; i < ranked.length; i++) {
        const { id, pts } = ranked[i]
        const rank = i + 1
        const player = allPlayers[id]
        const name = player.full_name
          ?? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()
          ?? id

        // Upsert player
        await db.execute({
          sql: `INSERT INTO players (player_id, name, position, team)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(player_id) DO UPDATE SET
                  name     = excluded.name,
                  position = excluded.position,
                  team     = excluded.team`,
          args: [id, name, pos, player.team ?? null],
        })
        upsertedPlayers++

        // Insert snapshot (ignore duplicate week/season)
        await db.execute({
          sql: `INSERT INTO snapshots (player_id, week, season, rank, projected_pts)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(player_id, week, season) DO NOTHING`,
          args: [id, targetWeek, targetSeason, rank, pts],
        })
        insertedSnapshots++
      }
    }

    return NextResponse.json({
      ok: true,
      season: targetSeason,
      week: targetWeek,
      upsertedPlayers,
      insertedSnapshots,
    })
  } catch (err) {
    console.error('Snapshot failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

**Step 2: Add `CRON_SECRET` to `.env`**

```
CRON_SECRET=dev-secret
```

**Step 3: Seed the database manually**

Start the dev server (`npm run dev`) and in a separate terminal:

```bash
curl -X POST http://localhost:3000/api/cron/snapshot \
  -H "Authorization: Bearer dev-secret"
```

Expected response:

```json
{ "ok": true, "season": 2025, "week": ..., "upsertedPlayers": ..., "insertedSnapshots": ... }
```

Counts should be > 0. If week is in the offseason, try passing explicit params:

```bash
curl -X POST "http://localhost:3000/api/cron/snapshot?season=2025&week=10" \
  -H "Authorization: Bearer dev-secret"
```

**Step 4: Commit**

```bash
git add src/app/api/cron/snapshot/route.ts
git commit -m "add weekly snapshot cron route with sleeper projection ranking"
```

---

### Task 5: Build players list API route

**Files:**
- Create: `src/app/api/players/route.ts`

Returns all players with their latest snapshot rank and rank change vs. previous week.

**Step 1: Create `src/app/api/players/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface PlayerRow {
  player_id:     string
  name:          string
  position:      string
  team:          string | null
  rank:          number
  rank_change:   number | null  // positive = improved, negative = fell
  projected_pts: number | null
  week:          number
  season:        number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const position = searchParams.get('position')
  const team     = searchParams.get('team')

  // Get the most recent snapshot week/season available
  const latestRow = await db.execute(
    `SELECT season, week FROM snapshots ORDER BY season DESC, week DESC LIMIT 1`,
  )

  if (latestRow.rows.length === 0) {
    return NextResponse.json([])
  }

  const { season, week } = latestRow.rows[0] as { season: number; week: number }
  const prevWeek   = week > 1 ? week - 1 : null
  const prevSeason = week > 1 ? season : season - 1

  let sql = `
    SELECT
      p.player_id,
      p.name,
      p.position,
      p.team,
      s.rank,
      s.projected_pts,
      s.week,
      s.season,
      prev.rank AS prev_rank
    FROM players p
    JOIN snapshots s
      ON s.player_id = p.player_id
     AND s.season = ?
     AND s.week = ?
    LEFT JOIN snapshots prev
      ON prev.player_id = p.player_id
     AND prev.season = ?
     AND prev.week = ?
    WHERE 1=1
  `
  const args: (string | number)[] = [season, week, prevSeason, prevWeek ?? 0]

  if (position && position !== 'ALL') {
    sql += ` AND p.position = ?`
    args.push(position)
  }
  if (team) {
    sql += ` AND p.team = ?`
    args.push(team)
  }

  sql += ` ORDER BY p.position, s.rank ASC`

  const result = await db.execute({ sql, args })

  const rows: PlayerRow[] = result.rows.map(r => ({
    player_id:     r.player_id as string,
    name:          r.name as string,
    position:      r.position as string,
    team:          r.team as string | null,
    rank:          r.rank as number,
    projected_pts: r.projected_pts as number | null,
    week:          r.week as number,
    season:        r.season as number,
    rank_change:   r.prev_rank != null
      ? (r.prev_rank as number) - (r.rank as number)
      : null,
  }))

  return NextResponse.json(rows)
}
```

**Step 2: Verify the endpoint**

With dev server running and data seeded from Task 4:

```bash
curl "http://localhost:3000/api/players?position=QB" | npx jq '.[0:3]'
```

Expected: Array of QB objects with `rank`, `rank_change`, `projected_pts` fields.

**Step 3: Commit**

```bash
git add src/app/api/players/route.ts
git commit -m "add players list api route with rank change computation"
```

---

### Task 6: Build player history API route

**Files:**
- Create: `src/app/api/players/[id]/history/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface HistoryRow {
  week:          number
  season:        number
  rank:          number
  projected_pts: number | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const result = await db.execute({
    sql: `SELECT week, season, rank, projected_pts
          FROM snapshots
          WHERE player_id = ?
          ORDER BY season ASC, week ASC`,
    args: [id],
  })

  const rows: HistoryRow[] = result.rows.map(r => ({
    week:          r.week as number,
    season:        r.season as number,
    rank:          r.rank as number,
    projected_pts: r.projected_pts as number | null,
  }))

  return NextResponse.json(rows)
}
```

**Step 2: Verify**

```bash
# Get a player_id from the players list first
curl "http://localhost:3000/api/players?position=QB" | npx jq '.[0].player_id'

# Then fetch their history (replace <id> with the actual id)
curl "http://localhost:3000/api/players/<id>/history"
```

Expected: Array of snapshot objects for that player.

**Step 3: Commit**

```bash
git add src/app/api/players/[id]/history/route.ts
git commit -m "add player history api route"
```

---

### Task 7: Build PlayerTable component

**Files:**
- Create: `src/components/PlayerTable.tsx`

**Step 1: Create `src/components/PlayerTable.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { PlayerRow } from '@/app/api/players/route'

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K']

interface Props {
  players:          PlayerRow[]
  teams:            string[]
  onSelectPlayer:   (player: PlayerRow) => void
  selectedPlayerId: string | null
}

export default function PlayerTable({ players, teams, onSelectPlayer, selectedPlayerId }: Props) {
  const [position, setPosition] = useState('ALL')
  const [team, setTeam]         = useState('ALL')

  const filtered = players.filter(p =>
    (position === 'ALL' || p.position === position) &&
    (team === 'ALL'     || p.team === team),
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <label>
          Position:{' '}
          <select value={position} onChange={e => setPosition(e.target.value)}>
            {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
          </select>
        </label>
        <label>
          Team:{' '}
          <select value={team} onChange={e => setTeam(e.target.value)}>
            <option>ALL</option>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ background: '#e2e8f0', textAlign: 'left' }}>
            <th style={th}>Rank</th>
            <th style={th}>Name</th>
            <th style={th}>Pos</th>
            <th style={th}>Team</th>
            <th style={th}>Proj Pts</th>
            <th style={th}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr
              key={p.player_id}
              onClick={() => onSelectPlayer(p)}
              style={{
                cursor: 'pointer',
                background: selectedPlayerId === p.player_id ? '#dbeafe' : 'white',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <td style={td}>{p.rank}</td>
              <td style={td}>{p.name}</td>
              <td style={td}>{p.position}</td>
              <td style={td}>{p.team ?? '—'}</td>
              <td style={td}>{p.projected_pts?.toFixed(1) ?? '—'}</td>
              <td style={td}><TrendBadge change={p.rank_change} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrendBadge({ change }: { change: number | null }) {
  if (change === null) return <span style={{ color: '#94a3b8' }}>—</span>
  if (change > 0) return <span style={{ color: '#16a34a' }}>▲ {change}</span>
  if (change < 0) return <span style={{ color: '#dc2626' }}>▼ {Math.abs(change)}</span>
  return <span style={{ color: '#94a3b8' }}>—</span>
}

const th: React.CSSProperties = { padding: '0.5rem 0.75rem' }
const td: React.CSSProperties = { padding: '0.4rem 0.75rem' }
```

**Step 2: Commit**

```bash
git add src/components/PlayerTable.tsx
git commit -m "add filterable player table component with rank trend indicator"
```

---

### Task 8: Build PlayerChart component

**Files:**
- Create: `src/components/PlayerChart.tsx`

**Step 1: Create `src/components/PlayerChart.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { PlayerRow } from '@/app/api/players/route'
import type { HistoryRow } from '@/app/api/players/[id]/history/route'

interface Props {
  player: PlayerRow
}

export default function PlayerChart({ player }: Props) {
  const [history, setHistory]   = useState<HistoryRow[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/players/${player.player_id}/history`)
      .then(r => r.json())
      .then((data: HistoryRow[]) => {
        setHistory(data)
        setLoading(false)
      })
  }, [player.player_id])

  const chartData = history.map(h => ({
    label: `Wk ${h.week}`,
    rank:  h.rank,
    pts:   h.projected_pts,
  }))

  return (
    <div style={{ padding: '1.5rem', background: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginBottom: '0.25rem' }}>{player.name}</h2>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        {player.position} · {player.team ?? 'FA'} · Current rank: #{player.rank}
      </p>

      {loading && <p>Loading...</p>}

      {!loading && chartData.length < 2 && (
        <p style={{ color: '#94a3b8' }}>Not enough data yet — need at least 2 weeks of snapshots to show a trend.</p>
      )}

      {!loading && chartData.length >= 2 && (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            {/* Reversed Y axis: lower rank = better, so rank 1 is at top */}
            <YAxis reversed domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'rank' ? [`#${value}`, 'Rank'] : [`${value?.toFixed(1)} pts`, 'Proj Pts']
              }
            />
            <Line type="monotone" dataKey="rank" stroke="#3b82f6" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/PlayerChart.tsx
git commit -m "add player rank trend line chart component"
```

---

### Task 9: Build the main page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace `src/app/page.tsx`**

```typescript
import { Suspense } from 'react'
import PlayersPage from './PlayersPage'

export default function Home() {
  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>FantasyTrack</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Week-over-week NFL fantasy player ranking trends
        </p>
      </header>
      <Suspense fallback={<p>Loading players...</p>}>
        <PlayersPage />
      </Suspense>
    </main>
  )
}
```

**Step 2: Create `src/app/PlayersPage.tsx`**

This is a server component that fetches initial data, keeping data fetching out of the client.

```typescript
import type { PlayerRow } from '@/app/api/players/route'
import PlayersClient from './PlayersClient'

async function fetchPlayers(): Promise<PlayerRow[]> {
  // Absolute URL required in server components
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/players`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export default async function PlayersPage() {
  const players = await fetchPlayers()

  if (players.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        No data yet. Seed the database by calling POST /api/cron/snapshot.
      </div>
    )
  }

  const latestWeek   = players[0]?.week
  const latestSeason = players[0]?.season
  const teams = [...new Set(players.map(p => p.team).filter(Boolean) as string[])].sort()

  return (
    <>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Data from Season {latestSeason}, Week {latestWeek}
      </p>
      <PlayersClient players={players} teams={teams} />
    </>
  )
}
```

**Step 3: Create `src/app/PlayersClient.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { PlayerRow } from '@/app/api/players/route'
import PlayerTable from '@/components/PlayerTable'
import PlayerChart from '@/components/PlayerChart'

interface Props {
  players: PlayerRow[]
  teams:   string[]
}

export default function PlayersClient({ players, teams }: Props) {
  const [selected, setSelected] = useState<PlayerRow | null>(null)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: '2rem', alignItems: 'start' }}>
      <PlayerTable
        players={players}
        teams={teams}
        onSelectPlayer={setSelected}
        selectedPlayerId={selected?.player_id ?? null}
      />
      {selected && <PlayerChart player={selected} />}
    </div>
  )
}
```

**Step 4: Add `NEXT_PUBLIC_BASE_URL` to `.env`**

```
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

And `.env.example`:

```
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

**Step 5: Verify the full UI**

Start dev server (`npm run dev`), visit `http://localhost:3000`.
- Table should show all players with rank, projected pts, and trend indicator.
- Clicking a player should show the chart panel on the right.
- Position and team filters should narrow the table.

**Step 6: Commit**

```bash
git add src/app/page.tsx src/app/PlayersPage.tsx src/app/PlayersClient.tsx
git commit -m "add main page with server-rendered player table and client chart panel"
```

---

### Task 10: Configure Vercel cron and deploy

**Files:**
- Create: `vercel.json`
- Update: `.env.example`

**Step 1: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/snapshot",
      "schedule": "0 12 * * 2"
    }
  ]
}
```

This runs every Tuesday at noon UTC — after Monday Night Football, so Week N data is complete.

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "add vercel cron config for weekly snapshot"
```

**Step 3: Push to GitHub**

```bash
git push
```

**Step 4: Deploy to Vercel**

1. Go to https://vercel.com/new
2. Import the `fantasytrack` GitHub repo
3. Add environment variables in the Vercel dashboard:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `NEXT_PUBLIC_BASE_URL` → set to your Vercel deployment URL (e.g. `https://fantasytrack.vercel.app`)
   - `CRON_SECRET` → Vercel sets this automatically for cron routes
4. Deploy

**Step 5: Seed production data**

After deploy, hit the snapshot endpoint manually to populate the first week:

```bash
# Get your CRON_SECRET from Vercel dashboard → Settings → Environment Variables
curl -X POST "https://your-app.vercel.app/api/cron/snapshot?season=2025&week=10" \
  -H "Authorization: Bearer <your-cron-secret>"
```

**Step 6: Verify production**

Visit your Vercel URL. Table should load with player data.

---

## Summary

| Task | What it builds |
|------|----------------|
| 1    | Next.js scaffold with dependencies |
| 2    | Turso DB schema + init script |
| 3    | Sleeper API client |
| 4    | Weekly snapshot cron route |
| 5    | Players list API route |
| 6    | Player history API route |
| 7    | Filterable player table component |
| 8    | Per-player rank trend chart |
| 9    | Main page wiring everything together |
| 10   | Vercel cron config + deployment |
