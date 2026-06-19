/**
 * Dish image resolution — DB is the source of truth.
 * The DB `imageUrl` column stores the real image for each dish.
 * If the DB contains generic/duplicate placeholder URLs, this module resolves them
 * to high-quality, unique, real food images using a name-based lookup.
 */

/** Fallback image when a dish has no image in the DB or category */
export const FALLBACK_DISH_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop';

/** Category-level fallback images */
const CATEGORY_IMAGES: Record<string, string> = {
  'NON-VEG STARTERS': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop',
  'VEG STARTERS': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&h=300&fit=crop',
  'NON-VEG CURRIES': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=400&h=300&fit=crop',
  'VEG CURRIES': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop',
  'CHINESE': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop',
  'RICE BOWL COMBO': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=300&fit=crop',
  'BIRYANIS': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop',
  'BREADS': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
  'DESSERT': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop',
  'DESSERTS': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop',
};

/** Verified Pexels images — one unique real image per dish name */
const DISH_IMAGES: Record<string, string> = {
  // Non-Veg Starters
  'Green Hills Chicken': 'https://images.pexels.com/photos/36660076/pexels-photo-36660076.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Hyderabad Chicken Dry': 'https://images.pexels.com/photos/31692606/pexels-photo-31692606.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken 65': 'https://images.pexels.com/photos/7353380/pexels-photo-7353380.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chilli Chicken': 'https://images.pexels.com/photos/5339079/pexels-photo-5339079.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Lemon Chicken': 'https://images.pexels.com/photos/10692533/pexels-photo-10692533.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chilli Fish': 'https://images.pexels.com/photos/35532841/pexels-photo-35532841.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Loose Fried Prawns': 'https://images.pexels.com/photos/4870472/pexels-photo-4870472.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Apollo Fish': 'https://images.pexels.com/photos/37316378/pexels-photo-37316378.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Fish Fry': 'https://images.pexels.com/photos/262897/pexels-photo-262897.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chilli Egg': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80',
  'Chicken Majestic': 'https://images.pexels.com/photos/12337357/pexels-photo-12337357.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Veg Starters
  'Crispy Corn': 'https://images.pexels.com/photos/30838940/pexels-photo-30838940.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Baby Corn Majestic': 'https://images.pexels.com/photos/3757707/pexels-photo-3757707.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Baby Corn 65': 'https://images.pexels.com/photos/5718026/pexels-photo-5718026.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chilli Mushroom': 'https://images.pexels.com/photos/5695587/pexels-photo-5695587.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer Majestic': 'https://images.unsplash.com/photo-1589302168068-964664d93cb0?auto=format&fit=crop&w=500&q=80',
  'Chilli Paneer': 'https://images.pexels.com/photos/29631468/pexels-photo-29631468.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer 65': 'https://images.pexels.com/photos/9609837/pexels-photo-9609837.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Non-Veg Curries
  'Kadai Chicken': 'https://images.pexels.com/photos/9609838/pexels-photo-9609838.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Shahi Kurma': 'https://images.pexels.com/photos/10345736/pexels-photo-10345736.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Telangana Chicken Curry': 'https://images.pexels.com/photos/37513674/pexels-photo-37513674.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Methi Chicken': 'https://images.pexels.com/photos/34159105/pexels-photo-34159105.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Chatpat': 'https://images.pexels.com/photos/5490697/pexels-photo-5490697.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Mughlai': 'https://images.pexels.com/photos/10810653/pexels-photo-10810653.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Telangana Mutton Curry': 'https://images.pexels.com/photos/14132114/pexels-photo-14132114.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mutton Mughlai': 'https://images.pexels.com/photos/18698236/pexels-photo-18698236.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Keema Mutton Curry': 'https://images.pexels.com/photos/9609855/pexels-photo-9609855.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Veg Curries
  'Dal Tadka': 'https://images.pexels.com/photos/30203314/pexels-photo-30203314.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Jeera Aloo': 'https://images.pexels.com/photos/28674713/pexels-photo-28674713.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kadai Vegetable': 'https://images.pexels.com/photos/19969210/pexels-photo-19969210.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Veg Chat Pat': 'https://images.pexels.com/photos/20408464/pexels-photo-20408464.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kadai Paneer': 'https://images.pexels.com/photos/29684990/pexels-photo-29684990.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kaju Masala': 'https://images.pexels.com/photos/28674555/pexels-photo-28674555.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kaju Paneer Masala': 'https://images.pexels.com/photos/11115801/pexels-photo-11115801.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer Butter Masala': 'https://images.pexels.com/photos/11188417/pexels-photo-11188417.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mushroom Masala': 'https://images.pexels.com/photos/35041663/pexels-photo-35041663.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Chinese
  'Chicken Fried Rice': 'https://images.pexels.com/photos/12052350/pexels-photo-12052350.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Egg Fried Rice': 'https://images.pexels.com/photos/8992927/pexels-photo-8992927.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mixed Fried Rice': 'https://images.pexels.com/photos/3926124/pexels-photo-3926124.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Schezwan Chicken Fried Rice': 'https://images.pexels.com/photos/5720819/pexels-photo-5720819.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Egg Noodles': 'https://images.pexels.com/photos/8395783/pexels-photo-8395783.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Noodles': 'https://images.pexels.com/photos/8983416/pexels-photo-8983416.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Schezwan Chicken Noodles': 'https://images.pexels.com/photos/11762852/pexels-photo-11762852.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Veg Fried Rice': 'https://images.pexels.com/photos/34668500/pexels-photo-34668500.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Rice Bowl Combo
  'Sambar Rice': 'https://images.pexels.com/photos/35041657/pexels-photo-35041657.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Curd Rice': 'https://images.pexels.com/photos/7593252/pexels-photo-7593252.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Sambar Rice + Curd Rice + Pickle Rice': 'https://images.pexels.com/photos/20408455/pexels-photo-20408455.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Bagara with Chicken Curry': 'https://images.pexels.com/photos/23106696/pexels-photo-23106696.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Bagara with Mixed Veg Curry': 'https://images.pexels.com/photos/28579050/pexels-photo-28579050.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Biryanis
  'Veg Biryani': 'https://images.pexels.com/photos/9738983/pexels-photo-9738983.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer Biryani': 'https://images.pexels.com/photos/9609859/pexels-photo-9609859.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kaju Paneer Biryani': 'https://images.pexels.com/photos/9609865/pexels-photo-9609865.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Nizami Chicken Dum Biryani': 'https://images.pexels.com/photos/9609860/pexels-photo-9609860.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken 65 Biryani': 'https://images.pexels.com/photos/9609864/pexels-photo-9609864.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Gongura Chicken Biryani': 'https://images.pexels.com/photos/4224304/pexels-photo-4224304.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mutton Ghosh Biryani': 'https://images.pexels.com/photos/9609856/pexels-photo-9609856.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Nalli Gosh Biryani': 'https://images.pexels.com/photos/6089651/pexels-photo-6089651.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Ulavacharu Chicken Biryani': 'https://images.pexels.com/photos/9609840/pexels-photo-9609840.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Prawns Biryani': 'https://images.pexels.com/photos/9609861/pexels-photo-9609861.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Egg Biryani': 'https://images.pexels.com/photos/9609843/pexels-photo-9609843.jpeg?auto=compress&cs=tinysrgb&w=500',

  // Breads & Desserts
  'Roti': 'https://images.pexels.com/photos/12427834/pexels-photo-12427834.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Pulka': 'https://images.pexels.com/photos/5589941/pexels-photo-5589941.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Gulab Jamun': 'https://images.pexels.com/photos/8887017/pexels-photo-8887017.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Gulab Jamun (1 pc)': 'https://images.pexels.com/photos/8887017/pexels-photo-8887017.jpeg?auto=compress&cs=tinysrgb&w=500',
};

/**
 * Get the best image URL for a dish.
 * Priority chain:
 * 1. User uploaded custom image (e.g., starts with Supabase URL)
 * 2. Curated unique Pexels/Unsplash image from name-based lookup
 * 3. Fallback to general category placeholder image
 * 4. Generic food image fallback
 */
export function getDishImage(
  dishName: string,
  dbImageUrl?: string | null,
  categoryName?: string,
): string {
  // 1. Prioritize real custom user-uploaded images (e.g. from Supabase storage)
  if (dbImageUrl && dbImageUrl.includes('supabase.co')) {
    return dbImageUrl;
  }

  // 2. Exact match in our unique dish images dictionary
  const normalized = dishName ? dishName.trim() : '';
  if (normalized && DISH_IMAGES[normalized]) {
    return DISH_IMAGES[normalized];
  }

  // 3. Fallback substring match (in case of subtle name differences like sizing)
  if (normalized) {
    const lowercaseName = normalized.toLowerCase();
    const matchedKey = Object.keys(DISH_IMAGES).find(key => {
      const k = key.toLowerCase();
      return lowercaseName.includes(k) || k.includes(lowercaseName);
    });
    if (matchedKey) {
      return DISH_IMAGES[matchedKey];
    }
  }

  // 4. Fall back to database image (if it's not a generic duplicated unsplash placeholder)
  if (dbImageUrl && !dbImageUrl.includes('photo-1563379091339') && !dbImageUrl.includes('photo-1565557623262')) {
    return dbImageUrl;
  }

  // 5. Category-level fallback images
  if (categoryName && CATEGORY_IMAGES[categoryName]) {
    return CATEGORY_IMAGES[categoryName];
  }

  // 6. Final generic fallback
  return dbImageUrl || FALLBACK_DISH_IMAGE;
}
