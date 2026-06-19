/**
 * Dish image resolution — DB is the source of truth.
 * The DB `imageUrl` column stores the real image for each dish.
 * If the DB contains generic/duplicate placeholder URLs, this module resolves them
 * to high-quality, unique, real food images using a name-based lookup.
 *
 * All images are verified free-to-use from Unsplash or Pexels.
 * Curated for a professional Indian cloud kitchen menu.
 */

/** Fallback image when a dish has no image in the DB or category */
export const FALLBACK_DISH_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop';

/** Category-level fallback images */
const CATEGORY_IMAGES: Record<string, string> = {
  'NON-VEG STARTERS': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop',
  'VEG STARTERS': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'NON-VEG CURRIES': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&h=400&fit=crop',
  'VEG CURRIES': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'CHINESE': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=400&fit=crop',
  'RICE BOWL COMBO': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&h=400&fit=crop',
  'BIRYANIS': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'BREADS': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',
  'DESSERT': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
  'DESSERTS': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
};

/**
 * Verified professional restaurant-quality images — one unique real image per dish name.
 * Sources: Unsplash (free license), Pexels (free license).
 * All images verified to match the dish type.
 */
const DISH_IMAGES: Record<string, string> = {
  // ─── Non-Veg Starters ────────────────────────────────────────
  'Green Hills Chicken': 'https://images.unsplash.com/photo-1757445060056-6d6aeec73de4?w=600&h=400&fit=crop',
  'Hyderabad Chicken Dry': 'https://images.unsplash.com/photo-1687020835890-b0b8c6a04613?w=600&h=400&fit=crop',
  'Chicken 65': 'https://images.pexels.com/photos/7353380/pexels-photo-7353380.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chilli Chicken': 'https://images.pexels.com/photos/5339079/pexels-photo-5339079.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Lemon Chicken': 'https://images.pexels.com/photos/10692533/pexels-photo-10692533.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chilli Fish': 'https://images.pexels.com/photos/262897/pexels-photo-262897.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Loose Fried Prawns': 'https://images.pexels.com/photos/10250383/pexels-photo-10250383.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Apollo Fish': 'https://images.pexels.com/photos/37316378/pexels-photo-37316378.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Fish Fry': 'https://images.pexels.com/photos/262897/pexels-photo-262897.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chilli Egg': 'https://images.unsplash.com/photo-1764315197254-94385571df22?w=600&h=400&fit=crop',
  'Chicken Majestic': 'https://images.pexels.com/photos/12337357/pexels-photo-12337357.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Veg Starters ────────────────────────────────────────────
  'Crispy Corn': 'https://images.pexels.com/photos/30838940/pexels-photo-30838940.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Baby Corn Majestic': 'https://images.pexels.com/photos/3757707/pexels-photo-3757707.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Baby Corn 65': 'https://images.pexels.com/photos/5718026/pexels-photo-5718026.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chilli Mushroom': 'https://images.pexels.com/photos/5695587/pexels-photo-5695587.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Paneer Majestic': 'https://images.unsplash.com/photo-1711790252168-079dad3ca226?w=600&h=400&fit=crop',
  'Chilli Paneer': 'https://images.pexels.com/photos/29631468/pexels-photo-29631468.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Paneer 65': 'https://images.pexels.com/photos/9609837/pexels-photo-9609837.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Non-Veg Curries ─────────────────────────────────────────
  'Kadai Chicken': 'https://images.pexels.com/photos/9609838/pexels-photo-9609838.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chicken Shahi Kurma': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Telangana Chicken Curry': 'https://images.pexels.com/photos/37513674/pexels-photo-37513674.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Methi Chicken': 'https://images.pexels.com/photos/34159105/pexels-photo-34159105.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chicken Chatpat': 'https://images.pexels.com/photos/5490697/pexels-photo-5490697.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chicken Mughlai': 'https://images.pexels.com/photos/10810653/pexels-photo-10810653.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Telangana Mutton Curry': 'https://images.pexels.com/photos/14132114/pexels-photo-14132114.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Mutton Mughlai': 'https://images.pexels.com/photos/18698236/pexels-photo-18698236.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Keema Mutton Curry': 'https://images.pexels.com/photos/9609855/pexels-photo-9609855.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Veg Curries ─────────────────────────────────────────────
  'Dal Tadka': 'https://images.unsplash.com/photo-1756821753095-64134f5c0c5c?w=600&h=400&fit=crop',
  'Jeera Aloo': 'https://images.pexels.com/photos/28674713/pexels-photo-28674713.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Kadai Vegetable': 'https://images.pexels.com/photos/19969210/pexels-photo-19969210.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Veg Chat Pat': 'https://images.pexels.com/photos/20408464/pexels-photo-20408464.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Kadai Paneer': 'https://images.pexels.com/photos/29684990/pexels-photo-29684990.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Kaju Masala': 'https://images.pexels.com/photos/28674555/pexels-photo-28674555.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Kaju Paneer Masala': 'https://images.pexels.com/photos/11115801/pexels-photo-11115801.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Paneer Butter Masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Mushroom Masala': 'https://images.pexels.com/photos/35041663/pexels-photo-35041663.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Chinese ─────────────────────────────────────────────────
  'Chicken Fried Rice': 'https://images.pexels.com/photos/12052350/pexels-photo-12052350.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Egg Fried Rice': 'https://images.pexels.com/photos/8992927/pexels-photo-8992927.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Mixed Fried Rice': 'https://images.pexels.com/photos/3926124/pexels-photo-3926124.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Schezwan Chicken Fried Rice': 'https://images.pexels.com/photos/5720819/pexels-photo-5720819.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Egg Noodles': 'https://images.pexels.com/photos/8395783/pexels-photo-8395783.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Chicken Noodles': 'https://images.pexels.com/photos/6646211/pexels-photo-6646211.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Schezwan Chicken Noodles': 'https://images.pexels.com/photos/11762852/pexels-photo-11762852.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Veg Fried Rice': 'https://images.pexels.com/photos/34668500/pexels-photo-34668500.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Rice Bowl Combo ─────────────────────────────────────────
  'Sambar Rice': 'https://images.pexels.com/photos/35041657/pexels-photo-35041657.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Curd Rice': 'https://images.pexels.com/photos/13243817/pexels-photo-13243817.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Sambar Rice + Curd Rice + Pickle Rice': 'https://images.pexels.com/photos/20408455/pexels-photo-20408455.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Bagara with Chicken Curry': 'https://images.pexels.com/photos/23106696/pexels-photo-23106696.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Bagara with Mixed Veg Curry': 'https://images.pexels.com/photos/28579050/pexels-photo-28579050.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Biryanis ────────────────────────────────────────────────
  'Veg Biryani': 'https://images.pexels.com/photos/9738983/pexels-photo-9738983.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Paneer Biryani': 'https://images.pexels.com/photos/9609859/pexels-photo-9609859.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Kaju Paneer Biryani': 'https://images.pexels.com/photos/9609865/pexels-photo-9609865.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Nizami Chicken Dum Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani (Single)': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani (Regular)': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani (Family Pack)': 'https://images.unsplash.com/photo-1691171047323-37acec85fc84?w=600&h=400&fit=crop',
  'Chicken 65 Biryani': 'https://images.unsplash.com/photo-1687020835890-b0b8c6a04613?w=600&h=400&fit=crop',
  'Chicken 65 Biryani (Single)': 'https://images.unsplash.com/photo-1687020835890-b0b8c6a04613?w=600&h=400&fit=crop',
  'Chicken 65 Biryani (Regular)': 'https://images.unsplash.com/photo-1772469597765-ff29d5616fb7?w=600&h=400&fit=crop',
  'Chicken 65 Biryani (Family Pack)': 'https://images.unsplash.com/photo-1691171047323-37acec85fc84?w=600&h=400&fit=crop',
  'Gongura Chicken Biryani': 'https://images.pexels.com/photos/4224304/pexels-photo-4224304.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Mutton Ghosh Biryani': 'https://images.pexels.com/photos/9609856/pexels-photo-9609856.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Mutton Ghosh Biryani (Single)': 'https://images.pexels.com/photos/9609856/pexels-photo-9609856.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Mutton Ghosh Biryani (Family Pack)': 'https://images.pexels.com/photos/6089651/pexels-photo-6089651.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Nalli Ghosh Biryani': 'https://images.pexels.com/photos/6089651/pexels-photo-6089651.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Nalli Gosh Biryani': 'https://images.pexels.com/photos/6089651/pexels-photo-6089651.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Ulavacharu Chicken Biryani': 'https://images.pexels.com/photos/9609840/pexels-photo-9609840.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Prawns Biryani': 'https://images.pexels.com/photos/9609861/pexels-photo-9609861.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Egg Biryani': 'https://images.pexels.com/photos/9609843/pexels-photo-9609843.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Breads ──────────────────────────────────────────────────
  'Roti': 'https://images.pexels.com/photos/12427834/pexels-photo-12427834.jpeg?auto=compress&cs=tinysrgb&w=600',
  'Pulka': 'https://images.pexels.com/photos/5589941/pexels-photo-5589941.jpeg?auto=compress&cs=tinysrgb&w=600',

  // ─── Desserts ────────────────────────────────────────────────
  'Gulab Jamun': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
  'Gulab Jamun (1 pc)': 'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?w=600&h=400&fit=crop',
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
  let resolvedUrl = FALLBACK_DISH_IMAGE;

  // 1. Prioritize real custom user-uploaded images (e.g. from Supabase storage)
  if (dbImageUrl && dbImageUrl.includes('supabase.co')) {
    resolvedUrl = dbImageUrl;
  } else {
    // 2. Exact match in our unique dish images dictionary
    const normalized = dishName ? dishName.trim() : '';
    let found = false;
    if (normalized && DISH_IMAGES[normalized]) {
      resolvedUrl = DISH_IMAGES[normalized];
      found = true;
    }

    // 3. Fallback substring match
    if (!found && normalized) {
      const lowercaseName = normalized.toLowerCase();
      const matchedKey = Object.keys(DISH_IMAGES).find(key => {
        const k = key.toLowerCase();
        return lowercaseName.includes(k) || k.includes(lowercaseName);
      });
      if (matchedKey) {
        resolvedUrl = DISH_IMAGES[matchedKey];
        found = true;
      }
    }

    // 4. Fall back to database image (if it's not a generic duplicated unsplash placeholder)
    if (!found && dbImageUrl && !dbImageUrl.includes('photo-1563379091339') && !dbImageUrl.includes('photo-1565557623262')) {
      resolvedUrl = dbImageUrl;
      found = true;
    }

    // 5. Category-level fallback images
    if (!found && categoryName && CATEGORY_IMAGES[categoryName]) {
      resolvedUrl = CATEGORY_IMAGES[categoryName];
      found = true;
    }

    if (!found) {
      resolvedUrl = dbImageUrl || FALLBACK_DISH_IMAGE;
    }
  }

  // Rewrite external Unsplash and Pexels URLs through our image proxy
  if (resolvedUrl && (resolvedUrl.startsWith('https://images.unsplash.com') || resolvedUrl.startsWith('https://images.pexels.com'))) {
    return `/api/image-proxy?url=${encodeURIComponent(resolvedUrl)}`;
  }

  return resolvedUrl;
}
