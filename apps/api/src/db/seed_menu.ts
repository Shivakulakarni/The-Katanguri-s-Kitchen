import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { categories, dishes } from './schemas/menu.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}
const client = postgres(connectionString);
const db = drizzle(client);

const menuData = [
  {
    category: 'NON-VEG STARTERS',
    dishes: [
      { name: 'Green Hills Chicken', price: '189.00', isVeg: false },
      { name: 'Hyderabad Chicken Dry', price: '189.00', isVeg: false },
      { name: 'Chicken 65', price: '189.00', isVeg: false },
      { name: 'Chilli Chicken', price: '189.00', isVeg: false },
      { name: 'Lemon Chicken', price: '189.00', isVeg: false },
      { name: 'Chilli Fish', price: '249.00', isVeg: false },
      { name: 'Loose Fried Prawns', price: '249.00', isVeg: false },
      { name: 'Apollo Fish', price: '249.00', isVeg: false },
      { name: 'Fish Fry', price: '249.00', isVeg: false },
      { name: 'Chilli Egg', price: '149.00', isVeg: false },
      { name: 'Chicken Majestic', price: '189.00', isVeg: false },
    ]
  },
  {
    category: 'VEG STARTERS',
    dishes: [
      { name: 'Crispy Corn', price: '149.00', isVeg: true },
      { name: 'Baby Corn Majestic', price: '149.00', isVeg: true },
      { name: 'Baby Corn 65', price: '149.00', isVeg: true },
      { name: 'Chilli Mushroom', price: '179.00', isVeg: true },
      { name: 'Paneer Majestic', price: '179.00', isVeg: true },
      { name: 'Chilli Paneer', price: '179.00', isVeg: true },
      { name: 'Paneer 65', price: '179.00', isVeg: true },
    ]
  },
  {
    category: 'NON-VEG CURRIES',
    dishes: [
      { name: 'Kadai Chicken', price: '229.00', isVeg: false },
      { name: 'Chicken Shahi Kurma', price: '229.00', isVeg: false },
      { name: 'Telangana Chicken Curry', price: '229.00', isVeg: false },
      { name: 'Methi Chicken', price: '229.00', isVeg: false },
      { name: 'Chicken Chatpat', price: '229.00', isVeg: false },
      { name: 'Chicken Mughlai', price: '229.00', isVeg: false },
      { name: 'Telangana Mutton Curry', price: '299.00', isVeg: false },
      { name: 'Mutton Mughlai', price: '299.00', isVeg: false },
      { name: 'Keema Mutton Curry', price: '349.00', isVeg: false },
    ]
  },
  {
    category: 'VEG CURRIES',
    dishes: [
      { name: 'Dal Tadka', price: '149.00', isVeg: true },
      { name: 'Jeera Aloo', price: '119.00', isVeg: true },
      { name: 'Kadai Vegetable', price: '149.00', isVeg: true },
      { name: 'Veg Chat Pat', price: '149.00', isVeg: true },
      { name: 'Kadai Paneer', price: '189.00', isVeg: true },
      { name: 'Kaju Masala', price: '199.00', isVeg: true },
      { name: 'Kaju Paneer Masala', price: '219.00', isVeg: true },
      { name: 'Paneer Butter Masala', price: '179.00', isVeg: true },
      { name: 'Mushroom Masala', price: '179.00', isVeg: true },
    ]
  },
  {
    category: 'CHINESE',
    dishes: [
      { name: 'Chicken Fried Rice', price: '149.00', isVeg: false },
      { name: 'Egg Fried Rice', price: '139.00', isVeg: false },
      { name: 'Mixed Fried Rice', price: '199.00', isVeg: false },
      { name: 'Schezwan Chicken Fried Rice', price: '159.00', isVeg: false },
      { name: 'Egg Noodles', price: '139.00', isVeg: false },
      { name: 'Chicken Noodles', price: '149.00', isVeg: false },
      { name: 'Schezwan Chicken Noodles', price: '159.00', isVeg: false },
      { name: 'Veg Fried Rice', price: '119.00', isVeg: true },
    ]
  },
  {
    category: 'BIRYANIS',
    dishes: [
      { name: 'Veg Biryani', price: '149.00', isVeg: true },
      { name: 'Paneer Biryani', price: '199.00', isVeg: true },
      { name: 'Kaju Paneer Biryani', price: '229.00', isVeg: true },
      { name: 'Nizami Chicken Dum Biryani', price: '199.00', isVeg: false },
      { name: 'Chicken 65 Biryani', price: '229.00', isVeg: false },
      { name: 'Gongura Chicken Biryani', price: '229.00', isVeg: false },
      { name: 'Mutton Ghosh Biryani', price: '299.00', isVeg: false },
      { name: 'Nalli Gosh Biryani', price: '399.00', isVeg: false },
      { name: 'Ulavacharu Chicken Biryani', price: '299.00', isVeg: false },
      { name: 'Prawns Biryani', price: '299.00', isVeg: false },
      { name: 'Egg Biryani', price: '149.00', isVeg: false },
    ]
  },
  {
    category: 'RICE BOWL COMBO',
    dishes: [
      { name: 'Sambar Rice', price: '119.00', isVeg: true },
      { name: 'Curd Rice', price: '119.00', isVeg: true },
      { name: 'Sambar Rice + Curd Rice + Pickle Rice', price: '199.00', isVeg: true },
      { name: 'Bagara with Chicken Curry', price: '149.00', isVeg: false },
      { name: 'Bagara with Mixed Veg Curry', price: '129.00', isVeg: true },
    ]
  },
  {
    category: 'BREADS',
    dishes: [
      { name: 'Roti', price: '15.00', isVeg: true },
      { name: 'Pulka', price: '12.00', isVeg: true },
    ]
  },
  {
    category: 'DESSERT',
    dishes: [
      { name: 'Gulab Jamun (1 pc)', price: '20.00', isVeg: true },
    ]
  }
];

async function seedMenu() {
  console.log('Seeding menu from physical copy...');
  
  try {
    // Clear old data safely (this assumes you want a fresh start. If not, comment out)
    // await db.delete(dishes);
    // await db.delete(categories);

    let displayOrder = 1;

    for (const cat of menuData) {
      // Upsert Category
      const [dbCat] = await db.insert(categories).values({
        name: cat.category,
        displayOrder: displayOrder++,
        isActive: true,
      }).onConflictDoUpdate({
        target: categories.name,
        set: { isActive: true }
      }).returning();

      console.log(`Processing category: ${dbCat.name}`);

      for (const d of cat.dishes) {
        // Find existing dish by name in this category
        // In simple seeding, we'll just insert and let it fail if unique constraint, or we can just try to insert without unique constraint
        // since dishes name might not be unique globally, we just insert.
        
        await db.insert(dishes).values({
          categoryId: dbCat.id,
          name: d.name,
          price: d.price,
          isVeg: d.isVeg,
          isAvailable: true,
        }).onConflictDoNothing(); // if we had a constraint, but we don't have unique constraint on dish name in schema.
      }
    }

    console.log('Menu seeded successfully!');
  } catch (error) {
    console.error('Failed to seed menu:', error);
  } finally {
    process.exit(0);
  }
}

seedMenu();
