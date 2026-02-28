import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
