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
