CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  position  TEXT NOT NULL,
  team      TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id      TEXT    NOT NULL REFERENCES players(player_id),
  week           INTEGER NOT NULL,
  season         INTEGER NOT NULL,
  rank           INTEGER NOT NULL,
  projected_pts  REAL,
  UNIQUE(player_id, week, season)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_player ON snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_week   ON snapshots(season, week);
