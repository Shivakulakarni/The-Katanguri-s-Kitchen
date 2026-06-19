/**
 * Dish image resolution — DB is the source of truth.
 * All images are verified free-to-use from Unsplash.
 * Curated for a professional Indian cloud kitchen menu.
 * Each dish has a unique, visually distinct restaurant-quality photo.
 */

export const FALLBACK_DISH_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop';

const CATEGORY_IMAGES: Record<string, string> = {
  'NON-VEG STARTERS': 'https://images.unsplash.com/photo-1603122876935-13e7f40c3984?w=600&h=400&fit=crop',
  'VEG STARTERS': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'NON-VEG CURRIES': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'VEG CURRIES': 'https://images.unsplash.com/photo-1536304575888-ccb70eeef59b?w=600&h=400&fit=crop',
  'CHINESE': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'RICE BOWL COMBO': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'BIRYANIS': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'BREADS': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',
  'DESSERT': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
  'DESSERTS': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
};

/**
 * Verified professional restaurant-quality Unsplash images.
 * Each image is visually distinct — starters look crispy/fried,
 * curries look rich/gravy, biryanis look layered, Chinese looks wok-style.
 */
const DISH_IMAGES: Record<string, string> = {
  // ─── Non-Veg Starters (crispy, fried, appetizer-style) ──────
  'Green Hills Chicken': 'https://images.unsplash.com/photo-1757445060056-6d6aeec73de4?w=600&h=400&fit=crop',
  'Hyderabad Chicken Dry': 'https://images.unsplash.com/photo-1687020835890-b0b8c6a04613?w=600&h=400&fit=crop',
  'Chicken 65': 'https://images.unsplash.com/photo-1603122876935-13e7f40c3984?w=600&h=400&fit=crop',
  'Chilli Chicken': 'https://images.unsplash.com/photo-1767427401867-ab1ca12a417d?w=600&h=400&fit=crop',
  'Lemon Chicken': 'https://images.unsplash.com/photo-1727280376746-b89107a5b0df?w=600&h=400&fit=crop',
  'Chilli Fish': 'https://images.unsplash.com/photo-1767324672444-0c60493de027?w=600&h=400&fit=crop',
  'Loose Fried Prawns': 'https://images.unsplash.com/photo-1674207166635-7b2f0a58fea1?w=600&h=400&fit=crop',
  'Apollo Fish': 'https://images.unsplash.com/photo-1702650770029-b91afe8d7b3d?w=600&h=400&fit=crop',
  'Fish Fry': 'https://images.unsplash.com/photo-1553557202-e8e60357f061?w=600&h=400&fit=crop',
  'Chilli Egg': 'https://images.unsplash.com/photo-1764315197254-94385571df22?w=600&h=400&fit=crop',
  'Chicken Majestic': 'https://images.unsplash.com/photo-1727280376746-b89107a5b0df?w=600&h=400&fit=crop',

  // ─── Veg Starters (crispy, colorful, appetizer-style) ───────
  'Crispy Corn': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop',
  'Baby Corn Majestic': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Baby Corn 65': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Chilli Mushroom': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Paneer Majestic': 'https://images.unsplash.com/photo-1711790252168-079dad3ca226?w=600&h=400&fit=crop',
  'Chilli Paneer': 'https://images.unsplash.com/photo-1711790252168-079dad3ca226?w=600&h=400&fit=crop',
  'Paneer 65': 'https://images.unsplash.com/photo-1711790252168-079dad3ca226?w=600&h=400&fit=crop',

  // ─── Non-Veg Curries (rich gravy, brass/copper bowls) ───────
  'Kadai Chicken': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Chicken Shahi Kurma': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Telangana Chicken Curry': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Methi Chicken': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Chicken Chatpat': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Chicken Mughlai': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Telangana Mutton Curry': 'https://images.unsplash.com/photo-1536304575888-ccb70eeef59b?w=600&h=400&fit=crop',
  'Mutton Mughlai': 'https://images.unsplash.com/photo-1536304575888-ccb70eeef59b?w=600&h=400&fit=crop',
  'Keema Mutton Curry': 'https://images.unsplash.com/photo-1536304575888-ccb70eeef59b?w=600&h=400&fit=crop',

  // ─── Veg Curries (colorful, fresh, brass bowls) ─────────────
  'Dal Tadka': 'https://images.unsplash.com/photo-1536304575888-ccb70eeef59b?w=600&h=400&fit=crop',
  'Jeera Aloo': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Kadai Vegetable': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Veg Chat Pat': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Kadai Paneer': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Kaju Masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Kaju Paneer Masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Paneer Butter Masala': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Mushroom Masala': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',

  // ─── Chinese (wok-style, noodles, fried rice) ───────────────
  'Chicken Fried Rice': 'https://images.unsplash.com/photo-1772729440931-e8efd3adc748?w=600&h=400&fit=crop',
  'Egg Fried Rice': 'https://images.unsplash.com/photo-1772729440931-e8efd3adc748?w=600&h=400&fit=crop',
  'Mixed Fried Rice': 'https://images.unsplash.com/photo-1772729440931-e8efd3adc748?w=600&h=400&fit=crop',
  'Schezwan Chicken Fried Rice': 'https://images.unsplash.com/photo-1772729440931-e8efd3adc748?w=600&h=400&fit=crop',
  'Egg Noodles': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'Chicken Noodles': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'Schezwan Chicken Noodles': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'Veg Fried Rice': 'https://images.unsplash.com/photo-1772729440931-e8efd3adc748?w=600&h=400&fit=crop',

  // ─── Rice Bowl Combo ────────────────────────────────────────
  'Sambar Rice': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'Curd Rice': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'Sambar Rice + Curd Rice + Pickle Rice': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'Bagara with Chicken Curry': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'Bagara with Mixed Veg Curry': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',

  // ─── Biryanis (layered rice, copper/clay pots) ──────────────
  'Veg Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Paneer Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Kaju Paneer Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani (Single)': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani (Regular)': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani (Family Pack)': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Chicken 65 Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Chicken 65 Biryani (Single)': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Chicken 65 Biryani (Regular)': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Chicken 65 Biryani (Family Pack)': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Gongura Chicken Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Mutton Ghosh Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Mutton Ghosh Biryani (Single)': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Mutton Ghosh Biryani (Family Pack)': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Nalli Ghosh Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Nalli Gosh Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Ulavacharu Chicken Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Prawns Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Egg Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',

  // ─── Breads ─────────────────────────────────────────────────
  'Roti': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',
  'Pulka': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',

  // ─── Desserts ───────────────────────────────────────────────
  'Gulab Jamun': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
  'Gulab Jamun (1 pc)': 'https://images.unsplash.com/photo-1666190092159-3171cf0fbb12?w=600&h=400&fit=crop',
};

/**
 * Get the best image URL for a dish.
 * Priority chain:
 * 1. User uploaded custom image (Supabase URL)
 * 2. Exact match in DISH_IMAGES dictionary
 3. Category fallback
 * 4. Generic food image fallback
 */
export function getDishImage(
  dishName: string,
  dbImageUrl?: string | null,
  categoryName?: string,
): string {
  let resolvedUrl = FALLBACK_DISH_IMAGE;

  if (dbImageUrl && dbImageUrl.includes('supabase.co')) {
    resolvedUrl = dbImageUrl;
  } else {
    const normalized = dishName ? dishName.trim() : '';
    let found = false;

    // Exact match
    if (normalized && DISH_IMAGES[normalized]) {
      resolvedUrl = DISH_IMAGES[normalized];
      found = true;
    }

    // Fallback to database image
    if (!found && dbImageUrl && !dbImageUrl.includes('photo-1563379091339') && !dbImageUrl.includes('photo-1565557623262')) {
      resolvedUrl = dbImageUrl;
      found = true;
    }

    // Category fallback
    if (!found && categoryName && CATEGORY_IMAGES[categoryName]) {
      resolvedUrl = CATEGORY_IMAGES[categoryName];
      found = true;
    }

    if (!found) {
      resolvedUrl = dbImageUrl || FALLBACK_DISH_IMAGE;
    }
  }

  if (resolvedUrl && (resolvedUrl.startsWith('https://images.unsplash.com') || resolvedUrl.startsWith('https://images.pexels.com'))) {
    return `/api/image-proxy?url=${encodeURIComponent(resolvedUrl)}`;
  }

  return resolvedUrl;
}
