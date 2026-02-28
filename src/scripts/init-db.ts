import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'

const db = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const sql = readFileSync(join(process.cwd(), 'src/lib/schema.sql'), 'utf-8')
const statements = sql.split(';').map(s => s.trim()).filter(Boolean)

for (const statement of statements) {
  await db.execute(statement)
}

console.log('Database initialized.')
