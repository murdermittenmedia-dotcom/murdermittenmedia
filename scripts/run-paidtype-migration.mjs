import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

try {
  // Modify the paidSubmissionType enum to include reentry5 and reentry10
  await conn.execute(`
    ALTER TABLE review_submissions
    MODIFY COLUMN paidSubmissionType ENUM('reentry5', 'reentry10', 'skip') NULL
  `);
  console.log("✅ paidSubmissionType enum updated to reentry5/reentry10/skip");
} catch (err) {
  console.error("Migration error:", err.message);
} finally {
  await conn.end();
}
