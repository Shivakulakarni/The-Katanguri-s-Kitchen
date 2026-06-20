import { queryClient } from '../../db/connection.js';

/**
 * Production seed — populates real data into the Render PostgreSQL database.
 * Called via POST /api/v1/admin/seed-production (admin only, idempotent).
 */
export async function seedProductionData(): Promise<{ success: boolean; summary: string[] }> {
  const summary: string[] = [];

  // ═══════════════════════════════════════════
  // 0. ENSURE TABLES EXIST (create if missing)
  // ═══════════════════════════════════════════
  await queryClient`
    CREATE TABLE IF NOT EXISTS restaurant_config (
      id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      key text NOT NULL UNIQUE,
      value jsonb NOT NULL,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `;
  await queryClient`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      code text NOT NULL UNIQUE,
      type text NOT NULL DEFAULT 'percentage',
      value double precision NOT NULL,
      min_order_amount double precision DEFAULT 0,
      max_uses integer DEFAULT 0,
      current_uses integer DEFAULT 0,
      expires_at timestamp,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `;
  await queryClient`
    CREATE TABLE IF NOT EXISTS riders (
      id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      name text NOT NULL,
      phone text NOT NULL UNIQUE,
      email text,
      vehicle_type text NOT NULL DEFAULT 'bike',
      vehicle_number text,
      status text NOT NULL DEFAULT 'offline',
      is_verified boolean DEFAULT false,
      is_active boolean DEFAULT true,
      current_lat decimal(10,7),
      current_lng decimal(10,7),
      rating decimal(3,2) DEFAULT '5.00',
      total_deliveries integer DEFAULT 0,
      total_earnings decimal(12,2) DEFAULT '0',
      current_order_id integer,
      deleted_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    )
  `;
  summary.push('tables ensured');

  // ═══════════════════════════════════════════
  // 1. RESTAURANT CONFIG
  // ═══════════════════════════════════════════
  const configs: Array<{ key: string; value: any }> = [
    { key: 'name', value: "The Katanguri's Kitchen" },
    { key: 'tagline', value: "Cooked with love, packed with care, and delivered fresh." },
    { key: 'subtitle', value: "Warangal's Favorite Cloud Kitchen" },
    { key: 'phone', value: '+919876543210' },
    { key: 'email', value: 'hello@thekatanguriskitchen.com' },
    { key: 'address', value: 'Hunter Road, Tiger Hills Colony, Hanamkonda, Warangal, Telangana 506001' },
    { key: 'city', value: 'Hanamkonda, Warangal' },
    { key: 'state', value: 'Telangana' },
    { key: 'pincode', value: '506001' },
    { key: 'country', value: 'India' },
    { key: 'lat', value: '17.9784' },
    { key: 'lng', value: '79.5941' },
    { key: 'opensAt', value: '12:00' },
    { key: 'closesAt', value: '22:00' },
    { key: 'operatingDays', value: 'Mon-Sun (All Days)' },
    { key: 'deliveryFeeDefault', value: '40' },
    { key: 'freeDeliveryThreshold', value: '500' },
    { key: 'minimumOrder', value: '149' },
    { key: 'avgPrepTime', value: '20' },
    { key: 'cuisine', value: 'South Indian, Hyderabadi Biryani, Chinese, Starters' },
    { key: 'about', value: "The Katanguri's Kitchen is Warangal's beloved cloud kitchen, serving authentic South Indian flavors with a modern twist. From our signature Nizami Dum Biryani to crispy Chicken 65, every dish is crafted with love and delivered fresh to your doorstep." },
  ];

  for (const cfg of configs) {
    await queryClient`
      INSERT INTO restaurant_config (key, value, created_at, updated_at)
      VALUES (${cfg.key}, ${JSON.stringify(cfg.value)}, NOW(), NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg.value)}, updated_at = NOW()
    `;
  }
  summary.push(`restaurant_config: ${configs.length} entries`);

  // ═══════════════════════════════════════════
  // 2. DELIVERY ZONES (Warangal real zones)
  // ═══════════════════════════════════════════
  const zones = [
    { name: 'Warangal Close', desc: 'Within 3km — quick delivery', radius: '3.00', fee: '30', min: '149', mins: 20 },
    { name: 'Warangal City', desc: '3-5km — standard delivery', radius: '5.00', fee: '40', min: '199', mins: 30 },
    { name: 'Greater Warangal', desc: '5-8km — extended delivery', radius: '8.00', fee: '60', min: '249', mins: 40 },
  ];

  // Clear existing inactive zones first
  await queryClient`DELETE FROM delivery_zones WHERE is_active = false`;

  for (const z of zones) {
    const existing = await queryClient`SELECT id FROM delivery_zones WHERE name = ${z.name} LIMIT 1`;
    if (existing.length === 0) {
      await queryClient`
        INSERT INTO delivery_zones (name, description, center_lat, center_lng, radius_km, delivery_fee, minimum_order, estimated_minutes, is_active, created_at, updated_at)
        VALUES (${z.name}, ${z.desc}, '17.9784000', '79.5941000', ${z.radius}, ${z.fee}, ${z.min}, ${z.mins}, true, NOW(), NOW())
      `;
    }
  }
  summary.push(`delivery_zones: ${zones.length} zones`);

  // ═══════════════════════════════════════════
  // 3. PROMO CODES
  // ═══════════════════════════════════════════
  const promos = [
    { code: 'WELCOME10', type: 'percentage', value: 10, min: 200, max: 1000, expires: '2027-12-31' },
    { code: 'FIRST50', type: 'flat', value: 50, min: 300, max: 500, expires: '2027-12-31' },
    { code: 'SAVE10', type: 'percentage', value: 10, min: 200, max: 1000, expires: '2027-12-31' },
    { code: 'FLAT100', type: 'flat', value: 100, min: 500, max: 300, expires: '2027-12-31' },
  ];

  for (const p of promos) {
    const existing = await queryClient`SELECT id FROM promo_codes WHERE code = ${p.code} LIMIT 1`;
    if (existing.length === 0) {
      await queryClient`
        INSERT INTO promo_codes (code, type, value, min_order_amount, max_uses, current_uses, expires_at, is_active, created_at)
        VALUES (${p.code}, ${p.type}, ${p.value}, ${p.min}, ${p.max}, 0, ${p.expires}::timestamp, true, NOW())
      `;
    }
  }
  summary.push(`promo_codes: ${promos.length} codes`);

  // ═══════════════════════════════════════════
  // 4. SAMPLE RIDERS
  // ═══════════════════════════════════════════
  const riders = [
    { name: 'Ravi Kumar', phone: '+919000000001', vehicle: 'KA-36-AB-1234', lat: '17.9790', lng: '79.5950' },
    { name: 'Suresh Reddy', phone: '+919000000002', vehicle: 'TS-07-CD-5678', lat: '17.9775', lng: '79.5935' },
    { name: 'Kiran Patel', phone: '+919000000003', vehicle: 'TS-07-EF-9012', lat: '17.9800', lng: '79.5960' },
  ];

  for (const r of riders) {
    const existing = await queryClient`SELECT id FROM riders WHERE phone = ${r.phone} LIMIT 1`;
    if (existing.length === 0) {
      await queryClient`
        INSERT INTO riders (name, phone, vehicle_type, vehicle_number, status, is_verified, is_active, current_lat, current_lng, rating, total_deliveries, total_earnings, created_at, updated_at)
        VALUES (${r.name}, ${r.phone}, 'bike', ${r.vehicle}, 'online', true, true, ${r.lat}, ${r.lng}, '4.80', ${Math.floor(Math.random() * 200) + 50}, ${String((Math.random() * 5000 + 1000).toFixed(2))}, NOW(), NOW())
      `;
    }
  }
  summary.push(`riders: ${riders.length} riders`);

  // ═══════════════════════════════════════════
  // 5. SAMPLE CUSTOMER + ADDRESSES
  // ═══════════════════════════════════════════
  const sampleCustomers = [
    { name: 'Priya Sharma', phone: '+918000000001', email: 'priya@example.com' },
    { name: 'Rajesh Gupta', phone: '+918000000002', email: 'rajesh@example.com' },
    { name: 'Anita Devi', phone: '+918000000003', email: 'anita@example.com' },
  ];

  const customerIds: number[] = [];
  for (const c of sampleCustomers) {
    const existing = await queryClient`SELECT id FROM customers WHERE phone = ${c.phone} LIMIT 1`;
    if (existing.length === 0) {
      const inserted = await queryClient`
        INSERT INTO customers (name, phone, email, role, is_guest, created_at, updated_at)
        VALUES (${c.name}, ${c.phone}, ${c.email}, 'customer', false, NOW(), NOW())
        RETURNING id
      `;
      customerIds.push(inserted[0].id);
    } else {
      customerIds.push(existing[0].id);
    }
  }

  // Sample addresses
  const sampleAddresses = [
    { customerId: customerIds[0], label: 'Home', line1: 'Flat 203, SVS Enclave', line2: 'Near NIT Warangal', city: 'Hanamkonda', state: 'Telangana', pin: '506004', lat: '17.9810', lng: '79.5970', isDefault: true },
    { customerId: customerIds[1], label: 'Office', line1: '3rd Floor, Tech Park', line2: 'Kazipet Road', city: 'Hanamkonda', state: 'Telangana', pin: '506003', lat: '17.9760', lng: '79.5920', isDefault: true },
    { customerId: customerIds[2], label: 'Home', line1: '12-5-78, Subedari', line2: 'Near Subedari Police Station', city: 'Hanamkonda', state: 'Telangana', pin: '506001', lat: '17.9795', lng: '79.5945', isDefault: true },
  ];

  for (const a of sampleAddresses) {
    const existing = await queryClient`SELECT id FROM customer_addresses WHERE customer_id = ${a.customerId} AND label = ${a.label} LIMIT 1`;
    if (existing.length === 0) {
      await queryClient`
        INSERT INTO customer_addresses (customer_id, label, address_line_1, address_line_2, city, state, pincode, latitude, longitude, is_default, created_at)
        VALUES (${a.customerId}, ${a.label}, ${a.line1}, ${a.line2}, ${a.city}, ${a.state}, ${a.pin}, ${a.lat}, ${a.lng}, ${a.isDefault}, NOW())
      `;
    }
  }
  summary.push(`customers: ${sampleCustomers.length} customers + ${sampleAddresses.length} addresses`);

  // ═══════════════════════════════════════════
  // 6. SAMPLE ORDERS (various statuses)
  // ═══════════════════════════════════════════
  // Get dish IDs
  const allDishes = await queryClient`SELECT id, name, price FROM dishes WHERE is_available = true ORDER BY id`;
  let orderCount = 0;
  if (allDishes.length > 0) {
    const statuses = ['DELIVERED', 'DELIVERED', 'PREPARING', 'OUT_FOR_DELIVERY', 'CONFIRMED', 'PENDING'];
    orderCount = Math.min(statuses.length, allDishes.length);
    const now = new Date();

    for (let i = 0; i < orderCount; i++) {
      const custIdx = i % customerIds.length;
      const customerId = customerIds[custIdx];
      const dish = allDishes[i % allDishes.length];
      const dish2 = allDishes[(i + 3) % allDishes.length];
      const totalAmount = Number(dish.price) + Number(dish2.price) + 40;
      const status = statuses[i];
      const orderDate = new Date(now.getTime() - (statuses.length - i) * 3600000);

      const existingOrder = await queryClient`SELECT id FROM orders WHERE customer_id = ${customerId} AND total_amount = ${String(totalAmount)} AND created_at::date = ${orderDate.toISOString().split('T')[0]}::date LIMIT 1`;
      if (existingOrder.length === 0) {
        const inserted = await queryClient`
          INSERT INTO orders (customer_id, status, total_amount, delivery_address_id, notes, created_at, updated_at)
          VALUES (${customerId}, ${status}, ${String(totalAmount)}, 1, 'Sample order for demo', ${orderDate.toISOString()}, ${orderDate.toISOString()})
          RETURNING id
        `;
        const orderId = inserted[0].id;

        await queryClient`
          INSERT INTO order_items (order_id, dish_id, quantity, unit_price, modifiers)
          VALUES (${orderId}, ${dish.id}, 1, ${String(dish.price)}, '[]'),
                 (${orderId}, ${dish2.id}, 1, ${String(dish2.price)}, '[]')
        `;

        await queryClient`
          INSERT INTO order_status_history (order_id, to_status, changed_by, notes, created_at)
          VALUES (${orderId}, ${status}, 'system', 'Auto-generated for demo', ${orderDate.toISOString()})
        `;
      }
    }
  }
  summary.push(`orders: ${orderCount} sample orders`);

  // ═══════════════════════════════════════════
  // 7. DISH-INGREDIENT MAPPINGS
  // ═══════════════════════════════════════════
  const ingredientMap: Record<string, string[]> = {
    'Chicken': ['Green Hills Chicken', 'Hyderabad Chicken Dry', 'Chicken 65', 'Chilli Chicken', 'Lemon Chicken', 'Chicken Majestic', 'Kadai Chicken', 'Chicken Shahi Kurma', 'Telangana Chicken Curry', 'Methi Chicken', 'Chicken Chatpat', 'Chicken Mughlai', 'Chicken Fried Rice', 'Schezwan Chicken Fried Rice', 'Chicken Noodles', 'Schezwan Chicken Noodles', 'Nizami Chicken Dum Biryani (Single)', 'Nizami Chicken Dum Biryani (Regular)', 'Nizami Chicken Dum Biryani (Family Pack)', 'Chicken 65 Biryani (Single)', 'Chicken 65 Biryani (Regular)', 'Chicken 65 Biryani (Family Pack)', 'Gongura Chicken Biryani', 'Ulavacharu Chicken Biryani', 'Bagara with Chicken Curry'],
    'Mutton': ['Telangana Mutton Curry', 'Mutton Mughlai', 'Keema Mutton Curry', 'Mutton Ghosh Biryani (Single)', 'Mutton Ghosh Biryani (Family Pack)', 'Nalli Ghosh Biryani'],
    'Fish': ['Chilli Fish', 'Apollo Fish', 'Fish Fry'],
    'Prawns': ['Loose Fried Prawns', 'Prawns Biryani'],
    'Paneer': ['Paneer Majestic', 'Chilli Paneer', 'Paneer 65', 'Paneer Biryani', 'Kaju Paneer Biryani', 'Kadai Paneer', 'Kaju Paneer Masala', 'Paneer Butter Masala'],
    'Eggs': ['Chilli Egg', 'Egg Fried Rice', 'Egg Noodles', 'Egg Biryani'],
    'Mushroom': ['Chilli Mushroom', 'Mushroom Masala'],
    'Basmati Rice': ['Veg Biryani', 'Paneer Biryani', 'Kaju Paneer Biryani', 'Nizami Chicken Dum Biryani (Single)', 'Nizami Chicken Dum Biryani (Regular)', 'Nizami Chicken Dum Biryani (Family Pack)', 'Chicken 65 Biryani (Single)', 'Chicken 65 Biryani (Regular)', 'Chicken 65 Biryani (Family Pack)', 'Gongura Chicken Biryani', 'Mutton Ghosh Biryani (Single)', 'Mutton Ghosh Biryani (Family Pack)', 'Nalli Ghosh Biryani', 'Ulavacharu Chicken Biryani', 'Prawns Biryani', 'Egg Biryani', 'Chicken Fried Rice', 'Egg Fried Rice', 'Mixed Fried Rice', 'Schezwan Chicken Fried Rice', 'Veg Fried Rice', 'Chicken Noodles', 'Egg Noodles', 'Schezwan Chicken Noodles', 'Sambar Rice', 'Bagara with Chicken Curry', 'Bagara with Mixed Veg Curry'],
    'Toor Dal': ['Dal Tadka', 'Sambar Rice'],
    'Curd': ['Curd Rice'],
    'Cashew Nuts': ['Chicken Mughlai', 'Mutton Mughlai', 'Kaju Masala', 'Kaju Paneer Masala', 'Kaju Paneer Biryani', 'Chicken Shahi Kurma'],
  };

  // Get ingredient IDs
  const ingredientRows = await queryClient`SELECT id, name FROM ingredients`;
  const ingredientIdMap: Record<string, number> = {};
  for (const row of ingredientRows) {
    ingredientIdMap[row.name] = row.id;
  }

  let dishIngCount = 0;
  for (const [ingredientName, dishNames] of Object.entries(ingredientMap)) {
    const ingredientId = ingredientIdMap[ingredientName];
    if (!ingredientId) continue;

    for (const dishName of dishNames) {
      const dishRow = await queryClient`SELECT id FROM dishes WHERE name = ${dishName} LIMIT 1`;
      if (dishRow.length === 0) continue;

      const existing = await queryClient`SELECT id FROM dish_ingredients WHERE dish_id = ${dishRow[0].id} AND ingredient_id = ${ingredientId} LIMIT 1`;
      if (existing.length === 0) {
        await queryClient`
          INSERT INTO dish_ingredients (dish_id, ingredient_id, quantity)
          VALUES (${dishRow[0].id}, ${ingredientId}, ${0.300 + Math.random() * 0.5})
        `;
        dishIngCount++;
      }
    }
  }
  summary.push(`dish_ingredients: ${dishIngCount} mappings`);

  return { success: true, summary };
}
