const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kitchen'
});

async function main() {
  // Create demo customer  
  const { rows: custRows } = await pool.query(
    `INSERT INTO customers (name, phone, email, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Demo User', '+919999999999', 'demo@kitchen.app']
  );
  const customerId = custRows[0].id;
  console.log('Customer ID:', customerId);

  // Create delivery address
  const { rows: addrRows } = await pool.query(
    `INSERT INTO customer_addresses (customer_id, label, address_line1, city, latitude, longitude, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     ON CONFLICT DO NOTHING RETURNING id`,
    [customerId, 'Home', 'H.No: 1-2-3, Patel Nagar, Hanamkonda', 'Warangal', 17.9912, 79.5882]
  );
  const addressId = addrRows.length > 0 ? addrRows[0].id : null;

  // Create order
  const { rows: orderRows } = await pool.query(
    `INSERT INTO orders (customer_id, status, total_amount, delivery_address_id, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id`,
    [customerId, 'OUT_FOR_DELIVERY', '527.00', addressId, 'Demo order for live rider tracking video']
  );
  const orderId = orderRows[0].id;

  // Add order items
  await pool.query(
    `INSERT INTO order_items (order_id, dish_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
    [orderId, 189, 2, '149.00']
  );
  await pool.query(
    `INSERT INTO order_items (order_id, dish_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
    [orderId, 195, 1, '229.00']
  );

  // Status history
  for (const s of ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']) {
    await pool.query(
      `INSERT INTO order_status_history (order_id, to_status, changed_by) VALUES ($1, $2, 'system')`,
      [orderId, s]
    );
  }

  console.log(`ORDER_ID=${orderId}`);
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
