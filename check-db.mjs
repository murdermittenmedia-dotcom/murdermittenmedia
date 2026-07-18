import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// Raw query to check products
const [products] = await conn.execute('SELECT id, name, price, status, featured, badge, slug FROM shop_products ORDER BY id');
console.log('PRODUCTS:', JSON.stringify(products, null, 2));

const [images] = await conn.execute('SELECT id, productId, url, imageType, sortOrder FROM shop_product_images ORDER BY productId, sortOrder');
console.log('IMAGES:', JSON.stringify(images, null, 2));

const [variants] = await conn.execute('SELECT id, productId, color, size, inventoryQty FROM shop_variants ORDER BY productId, color, size LIMIT 20');
console.log('VARIANTS:', JSON.stringify(variants, null, 2));

await conn.end();
