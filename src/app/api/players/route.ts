import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

  const { season, week } = latestRow.rows[0] as unknown as { season: number; week: number }
  const prevWeek   = week > 1 ? week - 1 : null
  const prevSeason = week > 1 ? season : season - 1

  let sql: string
  let args: (string | number)[]

  if (prevWeek !== null) {
    sql = `
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
    args = [season, week, prevSeason, prevWeek]
  } else {
    sql = `
      SELECT
        p.player_id,
        p.name,
        p.position,
        p.team,
        s.rank,
        s.projected_pts,
        s.week,
        s.season,
        NULL AS prev_rank
      FROM players p
      JOIN snapshots s
        ON s.player_id = p.player_id
       AND s.season = ?
       AND s.week = ?
      WHERE 1=1
    `
    args = [season, week]
  }

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
