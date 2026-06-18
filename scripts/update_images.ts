import 'dotenv/config';
import { db } from '../apps/api/src/db/connection.js';
import { dishes } from '../apps/api/src/db/schemas/menu.js';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';

// Smart Unsplash image mapper for Indian/Cloud Kitchen dishes
function getImageUrl(name: string, isVeg: boolean): string {
  const n = name.toLowerCase();

  // BIRYANIS
  if (n.includes('biryani') || n.includes('bagara')) {
    if (n.includes('chicken') || n.includes('65')) {
      // Nizami Chicken Dum Biryani / Chicken 65 Biryani
      return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80';
    }
    if (n.includes('mutton') || n.includes('ghosh') || n.includes('nalli')) {
      // Mutton Biryani / Nalli Ghosh Biryani
      return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80';
    }
    if (n.includes('prawns')) {
      // Prawns Biryani
      return 'https://images.unsplash.com/photo-1625220194771-7ebded05f6c6?w=500&auto=format&fit=crop&q=80';
    }
    if (n.includes('egg')) {
      // Egg Biryani
      return 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&auto=format&fit=crop&q=80';
    }
    // Veg Biryani / Paneer Biryani / Kaju Paneer Biryani / Default
    return 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&auto=format&fit=crop&q=80';
  }

  // CHICKEN STARTERS (NON-VEG STARTERS)
  if (n.includes('chicken') && (n.includes('65') || n.includes('dry') || n.includes('majestic') || n.includes('chilli') || n.includes('lemon') || n.includes('hills'))) {
    // Chicken 65, Chicken Majestic, Chilli Chicken, Hyderabad Dry, Lemon Chicken, Green Hills Chicken
    return 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&auto=format&fit=crop&q=80';
  }

  // FISH STARTERS
  if (n.includes('fish') || n.includes('prawns')) {
    if (n.includes('prawns')) {
      // Loose Fried Prawns
      return 'https://images.unsplash.com/photo-1534080391025-0967e9ae1368?w=500&auto=format&fit=crop&q=80';
    }
    // Chilli Fish, Apollo Fish, Fish Fry
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=80';
  }

  // EGG STARTERS
  if (n.includes('egg') && n.includes('chilli')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&auto=format&fit=crop&q=80';
  }

  // VEG STARTERS (PANEER)
  if (n.includes('paneer') && (n.includes('majestic') || n.includes('chilli') || n.includes('65'))) {
    // Paneer Majestic, Chilli Paneer, Paneer 65
    return 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80';
  }

  // VEG STARTERS (CORN / MUSHROOM)
  if (n.includes('corn') || n.includes('mushroom')) {
    // Crispy Corn, Baby Corn Majestic, Baby Corn 65, Chilli Mushroom
    return 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=500&auto=format&fit=crop&q=80';
  }

  // CHICKEN CURRIES
  if (n.includes('chicken') && (n.includes('curry') || n.includes('masala') || n.includes('kadai') || n.includes('kurma') || n.includes('methi') || n.includes('chatpat') || n.includes('mughlai'))) {
    return 'https://images.unsplash.com/photo-1610057099443-fde8c4d90ef8?w=500&auto=format&fit=crop&q=80';
  }

  // MUTTON CURRIES
  if (n.includes('mutton') || n.includes('keema')) {
    return 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=500&auto=format&fit=crop&q=80';
  }

  // VEG CURRIES (PANEER)
  if (n.includes('paneer') && (n.includes('butter') || n.includes('masala') || n.includes('kadai') || n.includes('kaju'))) {
    // Paneer Butter Masala, Kadai Paneer, Kaju Paneer Masala
    return 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=80';
  }

  // VEG CURRIES (DAL)
  if (n.includes('dal')) {
    return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80';
  }

  // VEG CURRIES (OTHERS)
  if (n.includes('aloo') || n.includes('vegetable') || n.includes('veg') || n.includes('kaju') || n.includes('mushroom')) {
    // Jeera Aloo, Kadai Vegetable, Veg Chat Pat, Kaju Masala, Mushroom Masala
    return 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&auto=format&fit=crop&q=80';
  }

  // NOODLES
  if (n.includes('noodles') || n.includes('noodle')) {
    return 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80';
  }

  // CHINESE / FRIED RICE
  if (n.includes('fried rice') || n.includes('rice')) {
    if (n.includes('sambar')) {
      return 'https://images.unsplash.com/photo-1616641155576-80041400b774?w=500&auto=format&fit=crop&q=80';
    }
    if (n.includes('curd')) {
      return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80';
    }
    // Chicken/Egg/Mixed/Veg Fried Rice
    return 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=80';
  }

  // BREADS
  if (n.includes('roti') || n.includes('pulka') || n.includes('naan')) {
    return 'https://images.unsplash.com/photo-1585959189455-111b748db09a?w=500&auto=format&fit=crop&q=80';
  }

  // DESSERTS
  if (n.includes('jamun') || n.includes('dessert')) {
    return 'https://images.unsplash.com/photo-1589302168068-9646c2e9d511?w=500&auto=format&fit=crop&q=80';
  }

  // Default Fallbacks
  return isVeg 
    ? 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80';
}

async function main() {
  console.log('Fetching all dishes from DB...');
  const allDishes = await db.select().from(dishes);
  console.log(`Found ${allDishes.length} dishes in database.`);

  for (let i = 0; i < allDishes.length; i++) {
    const dish = allDishes[i];
    const newUrl = getImageUrl(dish.name, dish.isVeg || false);
    
    console.log(`Updating [${dish.name}] -> ${newUrl}`);
    await db.update(dishes)
      .set({ imageUrl: newUrl })
      .where(eq(dishes.id, dish.id));
  }

  console.log('Clearing Redis menu cache...');
  const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await redisClient.del('cache:menu:all');
  redisClient.disconnect();

  console.log('Database updated successfully with highly accurate Indian food images!');
}

main().catch(console.error);
