import { readFileSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'
import { db } from '../lib/db.js'

const sql = readFileSync(join(process.cwd(), 'src/lib/schema.sql'), 'utf-8')
const statements = sql.split(';').map(s => s.trim()).filter(Boolean)

for (const statement of statements) {
  try {
    await db.execute(statement)
  } catch (err) {
    console.error(`Failed to execute statement:\n${statement}\n`, err)
    process.exit(1)
  }
}

console.log('Database initialized.')
