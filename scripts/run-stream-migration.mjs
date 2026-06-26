import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { config } from "dotenv";

config();

const sql = readFileSync(new URL("../drizzle/0024_stream_features.sql", import.meta.url), "utf-8");

const db = await createConnection(process.env.DATABASE_URL);

// Split on semicolons, filter blanks and comment-only blocks
const statements = sql
  .split(";")
  .map(s => {
    return s.split("\n").filter(l => !l.trim().startsWith("--")).join("\n").trim();
  })
  .filter(s => s.length > 0);

let ok = 0, skipped = 0, failed = 0;
for (const stmt of statements) {
  try {
    await db.execute(stmt);
    ok++;
  } catch (err) {
    const msg = err.message ?? "";
    if (
      msg.includes("already exists") ||
      msg.includes("Duplicate column") ||
      msg.includes("Can't DROP") ||
      (msg.includes("Table") && msg.includes("already exists"))
    ) {
      skipped++;
    } else {
      console.error("FAILED:", stmt.slice(0, 120), "\n  →", msg);
      failed++;
    }
  }
}

await db.end();
console.log(`Migration complete: ${ok} ok, ${skipped} skipped (already exists), ${failed} failed`);
if (failed > 0) process.exit(1);
