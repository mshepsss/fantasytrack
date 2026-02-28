import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { db } from '@/lib/db'
import {
  fetchAllPlayers,
  fetchProjections,
  fetchStats,
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

    // Check if projections have actual data
    const hasProjections = Object.values(projections).some(p => (p.pts_ppr ?? 0) > 0)

    // Fall back to stats (actual points scored) when projections are unavailable
    const stats = hasProjections ? null : await fetchStats(targetSeason, targetWeek)

    // Group players by position with rank info
    const byPosition: Record<Position, Array<{ id: string; pts: number | null; rank: number }>> = {
      QB: [], RB: [], WR: [], TE: [], K: [],
    }

    if (hasProjections) {
      const tempByPos: Record<Position, Array<{ id: string; pts: number }>> = {
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
        tempByPos[pos].push({ id: playerId, pts })
      }
      for (const pos of TRACKED_POSITIONS) {
        tempByPos[pos].sort((a, b) => b.pts - a.pts).forEach(({ id, pts }, i) => {
          byPosition[pos].push({ id, pts, rank: i + 1 })
        })
      }
    } else if (stats) {
      for (const [playerId, stat] of Object.entries(stats)) {
        if (!stat.pos_rank_ppr) continue
        const player = allPlayers[playerId]
        if (!player) continue
        const pos = (player.fantasy_positions?.[0] ?? player.position) as Position
        if (!TRACKED_POSITIONS.includes(pos)) continue
        byPosition[pos].push({ id: playerId, pts: stat.pts_ppr ?? null, rank: stat.pos_rank_ppr })
      }
    }

    // Collect all rows to batch insert
    const playerStatements = []
    const snapshotStatements = []

    for (const pos of TRACKED_POSITIONS) {
      for (const { id, pts, rank } of byPosition[pos]) {
        const player = allPlayers[id]
        const name = player.full_name
          ?? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()
          ?? id

        playerStatements.push({
          sql: `INSERT INTO players (player_id, name, position, team)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(player_id) DO UPDATE SET
                  name     = excluded.name,
                  position = excluded.position,
                  team     = excluded.team`,
          args: [id, name, pos, player.team ?? null] as (string | null)[],
        })

        snapshotStatements.push({
          sql: `INSERT INTO snapshots (player_id, week, season, rank, projected_pts)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(player_id, week, season) DO NOTHING`,
          args: [id, targetWeek, targetSeason, rank, pts] as (string | number | null)[],
        })
      }
    }

    // Execute all inserts in two batches (players first, then snapshots for FK integrity)
    await db.batch(playerStatements)
    await db.batch(snapshotStatements)

    return NextResponse.json({
      ok: true,
      season: targetSeason,
      week: targetWeek,
      upsertedPlayers: playerStatements.length,
      insertedSnapshots: snapshotStatements.length,
    })
  } catch (err) {
    console.error('Snapshot failed:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
