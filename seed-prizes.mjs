import { createConnection } from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(dbUrl);

const prizes = [
  ['20% Off Next Order', 'Get 20% off your next Murder Mitten Media order', 300, 1, 'stripe_coupon', '20', null, null, 90],
  ['10% Off Next Order', 'Get 10% off your next order', 400, 1, 'stripe_coupon', '10', null, null, 60],
  ['Free Murder Mitten Tee', 'Win a free Classic Logo Tee (your choice of size)', 50, 1, 'physical_item', 'Classic Logo Tee', 5, 5, null],
  ['Free Promo Post', 'Get a free promotional post on Murder Mitten Media Instagram', 100, 1, 'promo_service', 'Instagram Promo Post', 10, 10, null],
  ['30% Off Next Order', 'Biggest discount — 30% off your next order', 100, 1, 'stripe_coupon', '30', null, null, 90],
  ['Better Luck Next Time', 'Keep shopping — more drops coming soon!', 500, 1, 'physical_item', 'none', null, null, null],
];

// Check if prizes already exist
const [existing] = await conn.execute('SELECT COUNT(*) as cnt FROM wheel_prizes');
const count = existing[0].cnt;

if (count > 0) {
  console.log(`wheel_prizes already has ${count} rows — skipping seed.`);
} else {
  for (const [name, desc, weight, enabled, rewardType, rewardValue, inventoryLimit, remainingInventory, couponExpiryDays] of prizes) {
    await conn.execute(
      `INSERT INTO wheel_prizes (name, description, weight, enabled, rewardType, rewardValue, inventoryLimit, remainingInventory, couponExpiryDays, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, desc, weight, enabled, rewardType, rewardValue, inventoryLimit, remainingInventory, couponExpiryDays]
    );
    console.log('✓ Inserted:', name);
  }
  console.log('Seeded', prizes.length, 'prizes!');
}

await conn.end();
