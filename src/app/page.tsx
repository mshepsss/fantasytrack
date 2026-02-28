import { Suspense } from 'react'
import PlayersPage from './PlayersPage'

export default function Home() {
  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>FantasyTrack</h1>
        <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
          Week-over-week NFL fantasy player ranking trends
        </p>
      </header>
      <Suspense fallback={<p>Loading players...</p>}>
        <PlayersPage />
      </Suspense>
    </main>
  )
}
