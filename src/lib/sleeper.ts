const SLEEPER_BASE = 'https://api.sleeper.app/v1'

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K'

export interface SleeperPlayer {
  player_id:          string
  full_name?:         string
  first_name?:        string
  last_name?:         string
  position?:          string
  fantasy_positions?: string[]
  team?:              string
  active?:            boolean
}

export interface SleeperProjection {
  pts_ppr?:      number
  pts_half_ppr?: number
  pts_std?:      number
}

export interface SleeperStats {
  pos_rank_ppr?: number
  pts_ppr?:      number
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

export async function fetchStats(
  season: number,
  week: number,
): Promise<Record<string, SleeperStats>> {
  const res = await fetch(
    `${SLEEPER_BASE}/stats/nfl/${season}/${week}?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K`,
    { next: { revalidate: 0 } },
  )
  if (!res.ok) throw new Error(`Sleeper stats failed: ${res.status}`)
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
