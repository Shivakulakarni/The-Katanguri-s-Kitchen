/**
 * Dish image resolution — DB is the source of truth.
 * The DB `imageUrl` column stores the real image for each dish (set via admin or seed).
 * This module only provides a category-level and generic fallback.
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

/**
 * Get the best image URL for a dish.
 * Fallback chain:
 * 1. Database imageUrl (from the dishes table — the source of truth)
 * 2. Category-level image (from internal map)
 * 3. Generic food fallback
 */
export function getDishImage(
  _dishName: string,
  dbImageUrl?: string | null,
  categoryName?: string,
): string {
  // 1. Database image (source of truth — managed by admin/seed)
  if (dbImageUrl) return dbImageUrl;

  // 2. Pre-computed category fallback
  if (categoryName && CATEGORY_IMAGES[categoryName]) return CATEGORY_IMAGES[categoryName];

  // 3. Generic fallback
  return FALLBACK_DISH_IMAGE;
}
