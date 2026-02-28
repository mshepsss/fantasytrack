import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchAllPlayers, TRACKED_POSITIONS, type Position } from '@/lib/sleeper'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Realistic PPR point ranges by position: [rank1_pts, lastRank_pts]
const PTS_RANGE: Record<Position, [number, number]> = {
  QB: [34, 12],
  RB: [28, 4],
  WR: [26, 4],
  TE: [20, 3],
  K:  [14, 6],
}

// How many players to include per position
const POOL_SIZE: Record<Position, number> = {
  QB: 32,
  RB: 80,
  WR: 80,
  TE: 36,
  K:  28,
}

const MOCK_WEEKS = [14, 15, 16, 17, 18]
const MOCK_SEASON = 2025

/** Shuffle ranks slightly each week: each player drifts +/- up to maxDrift */
function driftRanks(ranks: string[], maxDrift = 4): string[] {
  const n = ranks.length
  const result = [...ranks]
  for (let i = 0; i < n; i++) {
    const drift = Math.floor(Math.random() * (maxDrift * 2 + 1)) - maxDrift
    const newIdx = Math.min(Math.max(i + drift, 0), n - 1)
    // Swap
    ;[result[i], result[newIdx]] = [result[newIdx], result[i]]
  }
  return result
}

/** Generate projected pts for a given rank (1-indexed), with slight noise */
function ptsForRank(rank: number, total: number, pos: Position): number {
  const [top, bottom] = PTS_RANGE[pos]
  const base = top - ((top - bottom) * (rank - 1)) / Math.max(total - 1, 1)
  const noise = (Math.random() - 0.5) * 2.5
  return Math.max(0.5, parseFloat((base + noise).toFixed(1)))
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const allPlayers = await fetchAllPlayers()

    // Group active players with a team by position
    const pools: Record<Position, Array<{ id: string; name: string; team: string }>> = {
      QB: [], RB: [], WR: [], TE: [], K: [],
    }

    for (const [id, player] of Object.entries(allPlayers)) {
      if (!player.active || !player.team) continue
      const pos = (player.fantasy_positions?.[0] ?? player.position) as Position
      if (!TRACKED_POSITIONS.includes(pos)) continue
      const name = player.full_name
        ?? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()
        ?? id
      pools[pos].push({ id, name, team: player.team })
    }

    // Trim each position pool to POOL_SIZE
    for (const pos of TRACKED_POSITIONS) {
      pools[pos] = pools[pos].slice(0, POOL_SIZE[pos])
    }

    // Clear existing data
    await db.batch([
      { sql: 'DELETE FROM snapshots', args: [] },
      { sql: 'DELETE FROM players', args: [] },
    ])

    // Upsert all players
    const playerStmts = TRACKED_POSITIONS.flatMap(pos =>
      pools[pos].map(({ id, name, team }) => ({
        sql: `INSERT INTO players (player_id, name, position, team)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(player_id) DO UPDATE SET
                name = excluded.name, position = excluded.position, team = excluded.team`,
        args: [id, name, pos, team] as string[],
      }))
    )
    await db.batch(playerStmts)

    // Generate week-over-week snapshots
    // Start with initial rank order, drift each subsequent week
    const weeklyOrder: Record<Position, string[][]> = {
      QB: [], RB: [], WR: [], TE: [], K: [],
    }

    for (const pos of TRACKED_POSITIONS) {
      const initial = pools[pos].map(p => p.id)
      weeklyOrder[pos].push(initial)
      for (let w = 1; w < MOCK_WEEKS.length; w++) {
        weeklyOrder[pos].push(driftRanks(weeklyOrder[pos][w - 1]))
      }
    }

    const snapshotStmts = []
    for (let wi = 0; wi < MOCK_WEEKS.length; wi++) {
      const week = MOCK_WEEKS[wi]
      for (const pos of TRACKED_POSITIONS) {
        const order = weeklyOrder[pos][wi]
        const total = order.length
        for (let ri = 0; ri < total; ri++) {
          const playerId = order[ri]
          const rank = ri + 1
          const pts = ptsForRank(rank, total, pos)
          snapshotStmts.push({
            sql: `INSERT INTO snapshots (player_id, week, season, rank, projected_pts)
                  VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(player_id, week, season) DO NOTHING`,
            args: [playerId, week, MOCK_SEASON, rank, pts] as (string | number)[],
          })
        }
      }
    }

    await db.batch(snapshotStmts)

    return NextResponse.json({
      ok: true,
      season: MOCK_SEASON,
      weeks: MOCK_WEEKS,
      players: playerStmts.length,
      snapshots: snapshotStmts.length,
    })
  } catch (err) {
    console.error('Mock seed failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
