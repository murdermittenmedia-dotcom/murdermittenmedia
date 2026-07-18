import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}

const conn = await createConnection(dbUrl);

const sql = readFileSync(resolve(__dirname, 'drizzle/0028_small_mandroid.sql'), 'utf8');
const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

console.log(`Running ${statements.length} statements...`);
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('✓', stmt.slice(0, 60).replace(/\n/g, ' '));
  } catch (e) {
    if (e.code === 'ER_TABLE_EXISTS_ERROR' || e.message?.includes('already exists')) {
      console.log('⚠ Already exists, skipping:', stmt.slice(0, 60).replace(/\n/g, ' '));
    } else {
      console.error('✗ Error:', e.message);
      console.error('Statement:', stmt.slice(0, 200));
    }
  }
}

await conn.end();
console.log('Migration complete!');
