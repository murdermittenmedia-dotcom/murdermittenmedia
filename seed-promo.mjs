import mysql from 'mysql2/promise';

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'murdermittenmedia',
});

try {
  await db.execute(
    'INSERT INTO promo_codes (code, type, enabled, minimumSubtotal, maximumUses, usageCount, firstTimeOnly) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['FREESHIP', 'free_shipping', true, 0, 999, 0, false]
  );
  console.log('✓ FREESHIP promo code seeded');
} catch (e) {
  console.error('Error seeding promo code:', e.message);
}

await db.end();
