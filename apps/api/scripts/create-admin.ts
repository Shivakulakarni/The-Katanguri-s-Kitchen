/**
 * Script to create or update an admin user for testing
 * Run with: npx tsx scripts/create-admin.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/connection.js';
import { customers } from '../src/db/schemas/customer.js';
import { eq } from 'drizzle-orm';

const ADMIN_EMAIL = 'admin@kitchen.app';
const ADMIN_PASSWORD = 'Admin@Kitchen123';
const ADMIN_PHONE = '+919000000001';
const ADMIN_NAME = 'Kitchen Admin';

async function createAdmin() {
  console.log('Creating admin user...');
  
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  
  // Check if admin already exists
  const [existing] = await db.select().from(customers).where(eq(customers.email, ADMIN_EMAIL)).limit(1);
  
  if (existing) {
    // Update existing user to admin role
    const [updated] = await db.update(customers)
      .set({ role: 'admin', passwordHash, name: ADMIN_NAME })
      .where(eq(customers.email, ADMIN_EMAIL))
      .returning();
    console.log('Updated existing user to admin:', updated.id, updated.email);
  } else {
    // Create new admin user
    const [created] = await db.insert(customers).values({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      name: ADMIN_NAME,
      passwordHash,
      role: 'admin',
      isGuest: false,
    }).returning();
    console.log('Created new admin user:', created.id, created.email);
  }
  
  console.log('\n✅ Admin user ready!');
  console.log('Email:', ADMIN_EMAIL);
  console.log('Password:', ADMIN_PASSWORD);
  console.log('\nUse these credentials to login at http://localhost:3002/login');
  
  process.exit(0);
}

createAdmin().catch(err => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
