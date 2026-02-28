'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { PlayerRow } from '@/app/api/players/route'
import type { HistoryRow } from '@/app/api/players/[id]/history/route'

interface Props {
  player: PlayerRow
}

export default function PlayerChart({ player }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

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
              formatter={(value: number | undefined, name: string | undefined) =>
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
