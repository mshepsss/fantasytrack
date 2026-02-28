import type { PlayerRow } from '@/app/api/players/route'
import PlayersClient from './PlayersClient'

async function fetchPlayers(): Promise<PlayerRow[]> {
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
  const teams = [...new Set(players.map(p => p.team).filter((t): t is string => t !== null))].sort()

  return (
    <>
      <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Data from Season {latestSeason}, Week {latestWeek}
      </p>
      <PlayersClient players={players} teams={teams} />
    </>
  )
}
