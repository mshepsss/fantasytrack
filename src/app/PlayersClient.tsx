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
    <div style={{
      display: 'grid',
      gridTemplateColumns: selected ? '1fr 420px' : '1fr',
      gap: '2rem',
      alignItems: 'start',
    }}>
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
