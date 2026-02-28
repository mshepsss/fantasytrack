import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
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
