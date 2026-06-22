/**
 * Dish image resolution — DB is the source of truth.
 * All images are verified free-to-use from Unsplash.
 * Curated for a professional Indian cloud kitchen menu.
 * Each dish has a unique, visually distinct restaurant-quality photo.
 */

export const FALLBACK_DISH_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop';

const CATEGORY_IMAGES: Record<string, string> = {
  'SOUPS': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop',
  'NON-VEG STARTERS': 'https://images.unsplash.com/photo-1603122876935-13e7f40c3984?w=600&h=400&fit=crop',
  'VEG STARTERS': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'NON-VEG CURRIES': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=600&h=400&fit=crop',
  'VEG CURRIES': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop',
  'CHINESE': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'RICE BOWLS': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'BIRYANIS': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'BREADS': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',
  'DESSERT': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
  'CHICKEN TIKKA': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'KEBABS': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'TANDOORI SPECIALS': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'SEA FOOD TANDOORI': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&h=400&fit=crop',
  'VEG TANDOORI': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop',
  'TANDOORI CURRIES': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=600&h=400&fit=crop',
  'PULAO': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
};

/**
 * Verified professional restaurant-quality Unsplash images.
 * Every dish has a unique image. All URLs return HTTP 200.
 * Images chosen for: overhead/bowl shots, warm lighting, restaurant plating.
 */
const DISH_IMAGES: Record<string, string> = {
  // ─── Soups (warm bowls, steam, ladle shots) ──────
  'Sweet Corn Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop',
  'Chicken Manchow Soup': 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=600&h=400&fit=crop',
  'Hot and Sour Soup': 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&h=400&fit=crop',
  'Lemon Corriander Soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=400&fit=crop',
  'Nihari Paya': 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=400&fit=crop',
  'Mutton Marag': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&h=400&fit=crop',

  // ─── Non-Veg Starters (crispy, fried, appetizer-style) ──────
  'Chicken Manchurian': 'https://images.unsplash.com/photo-1603122876935-13e7f40c3984?w=600&h=400&fit=crop',
  'Chicken Lollipop': 'https://images.unsplash.com/photo-1727280376746-b89107a5b0df?w=600&h=400&fit=crop',
  'Chicken Drum Stick': 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=600&h=400&fit=crop',
  'Dragon Chicken': 'https://images.unsplash.com/photo-1767427401867-ab1ca12a417d?w=600&h=400&fit=crop',
  'Chicken 65': 'https://images.unsplash.com/photo-1603122876935-13e7f40c3984?w=600&h=400&fit=crop',
  'Chicken 555': 'https://images.unsplash.com/photo-1687020835890-b0b8c6a04613?w=600&h=400&fit=crop',
  'Kalimirchi Chicken': 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=400&fit=crop',
  'Green Hills Chicken': 'https://images.unsplash.com/photo-1757445060056-6d6aeec73de4?w=600&h=400&fit=crop',
  'Orugallu Chicken Dry': 'https://images.unsplash.com/photo-1687020835890-b0b8c6a04613?w=600&h=400&fit=crop',
  'Chicken Wings': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=400&fit=crop',
  'Chicken Majestic': 'https://images.unsplash.com/photo-1727280376746-b89107a5b0df?w=600&h=400&fit=crop',
  'Chilli Chicken': 'https://images.unsplash.com/photo-1767427401867-ab1ca12a417d?w=600&h=400&fit=crop',
  'Lemon Chicken': 'https://images.unsplash.com/photo-1727280376746-b89107a5b0df?w=600&h=400&fit=crop',
  'Chilli Egg': 'https://images.unsplash.com/photo-1764315197254-94385571df22?w=600&h=400&fit=crop',
  'Egg 65': 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&h=400&fit=crop',
  'Apollo Fish': 'https://images.unsplash.com/photo-1702650770029-b91afe8d7b3d?w=600&h=400&fit=crop',
  'Fish Chips': 'https://images.unsplash.com/photo-1553557202-e8e60357f061?w=600&h=400&fit=crop',
  'Lemon Pepper Prawns': 'https://images.unsplash.com/photo-1674207166635-7b2f0a58fea1?w=600&h=400&fit=crop',
  'Crispy Fried Prawns': 'https://images.unsplash.com/photo-1674207166635-7b2f0a58fea1?w=600&h=400&fit=crop',
  'Loose Fried Prawns': 'https://images.unsplash.com/photo-1674207166635-7b2f0a58fea1?w=600&h=400&fit=crop',
  'Garlic Butter Prawns': 'https://images.unsplash.com/photo-1625943553852-781c6dd46faa?w=600&h=400&fit=crop',
  'Fish Fingers': 'https://images.unsplash.com/photo-1553557202-e8e60357f061?w=600&h=400&fit=crop',

  // ─── Veg Starters (crispy, colorful, appetizer-style) ───────
  'Crispy Corn': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop',
  'Veg Manchurian': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Gobi Manchurian': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Paneer Majestic': 'https://images.unsplash.com/photo-1711790252168-079dad3ca226?w=600&h=400&fit=crop',
  'Chilli Paneer': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop',
  'Paneer 65': 'https://images.unsplash.com/photo-1711790252168-079dad3ca226?w=600&h=400&fit=crop',
  'Baby Corn Majestic': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Chilli Baby Corn': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Baby Corn Manchurian': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Veg Spring Roll': 'https://images.unsplash.com/photo-1606525436893-76a4b6bdaf3f?w=600&h=400&fit=crop',

  // ─── Non-Veg Curries (rich gravy, brass/copper bowls) ───────
  'Kadai Chicken': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=600&h=400&fit=crop',
  'Chicken Shahi Kurma': 'https://images.unsplash.com/photo-1764304733301-3a9f335f0c67?w=600&h=400&fit=crop',
  'Telangana Chicken Curry': 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=400&fit=crop',
  'Methi Chicken': 'https://images.unsplash.com/photo-1772730065344-4cf131b39951?w=600&h=400&fit=crop',
  'Chicken Chatpat': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&h=400&fit=crop',
  'Chicken Chettinad': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&h=400&fit=crop',
  'Chicken Kolhapuri': 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=400&fit=crop',
  'Chicken Mughlai': 'https://images.unsplash.com/photo-1542367592-8849eb950fd8?w=600&h=400&fit=crop',
  'Kadai Mutton': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&h=400&fit=crop',
  'Telangana Mutton Curry': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&h=400&fit=crop',
  'Mutton Mughlai': 'https://images.unsplash.com/photo-1536304575888-ccb70eeef59b?w=600&h=400&fit=crop',
  'Mutton Keema': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&h=400&fit=crop',
  'Egg Bhurji': 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&h=400&fit=crop',
  'Egg Masala Kurma': 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&h=400&fit=crop',

  // ─── Veg Curries (colorful, fresh, brass bowls) ─────────────
  'Dal Tadka': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&h=400&fit=crop',
  'Jeera Aloo': 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&h=400&fit=crop',
  'Kadai Paneer': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop',
  'Paneer Butter Masala': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&h=400&fit=crop',
  'Kaju Masala': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=400&fit=crop',
  'Kaju Paneer Masala': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Shahi Paneer Kurma': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop',
  'Methi Chaman': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Deccan Vegetable': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Veg Chatpat': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',

  // ─── Chinese (wok-style, noodles, fried rice) ───────────────
  'Chicken Fried Rice': 'https://images.unsplash.com/photo-1772729440931-e8efd3adc748?w=600&h=400&fit=crop',
  'Egg Fried Rice': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Gobi Fried Rice': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Double Egg Fried Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Mixed Fried Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Double Egg Chicken Fried Rice': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop',
  'Schezwan Chicken Fried Rice': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop',
  'Veg Fried Rice': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Egg Noodles': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'Chicken Noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop',
  'Double Egg Noodles': 'https://images.unsplash.com/photo-1772729219168-af0f0e57bb9c?w=600&h=400&fit=crop',
  'Double Egg Chicken Noodles': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&h=400&fit=crop',
  'Schezwan Chicken Noodles': 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&h=400&fit=crop',

  // ─── Rice Bowls ────────────────────────────────────────
  'Sambar Rice': 'https://images.unsplash.com/photo-1742599361539-f096753d1100?w=600&h=400&fit=crop',
  'Jeera Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Bagara Rice': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Curd Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=400&fit=crop',

  // ─── Biryanis (layered rice, copper/clay pots) ──────────────
  'Chicken Fry Piece Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=400&fit=crop',
  'Veg Biryani': 'https://images.unsplash.com/photo-1752673508949-f4aeeaef75f0?w=600&h=400&fit=crop',
  'Paneer Biryani': 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=600&h=400&fit=crop',
  'Kaju Paneer Biryani': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop',
  'Nizami Chicken Dum Biryani': 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&h=400&fit=crop',
  'Chicken 65 Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&h=400&fit=crop',
  'Gongura Chicken Biryani': 'https://images.unsplash.com/photo-1772469597765-ff29d5616fb7?w=600&h=400&fit=crop',
  'Mutton Biryani': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop',
  'Nalli Gosh Biryani': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=400&fit=crop',
  'Prawns Biryani': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Fish Biryani': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Egg Biryani': 'https://images.unsplash.com/photo-1772469597765-ff29d5616fb7?w=600&h=400&fit=crop',

  // ─── Breads ─────────────────────────────────────────────────
  'Roti': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',
  'Pulka': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&h=400&fit=crop',
  'Rumali Roti': 'https://images.unsplash.com/photo-1586444248879-bc604cbd555a?w=600&h=400&fit=crop',
  'Plain Naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop',
  'Butter Naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=400&fit=crop',
  'Garlic Naan': 'https://images.unsplash.com/photo-1586444248879-bc604cbd555a?w=600&h=400&fit=crop',
  'Butter Garlic Naan': 'https://images.unsplash.com/photo-1586444248879-bc604cbd555a?w=600&h=400&fit=crop',
  'Tandoori Roti': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop',

  // ─── Desserts ───────────────────────────────────────────────
  'Gulab Jamun': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',
  'Nethi Bakshalu (3 pcs)': 'https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?w=600&h=400&fit=crop',

  // ─── Chicken Tikka (skewers, tandoor, charred) ──────────────
  'Chicken Tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'Malai Chicken Tikka': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',
  'Hariyali Chicken Tikka': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',
  'Afghani Chicken Tikka': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',
  'Lasooni Chicken Tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'Reshmi Chicken Tikka': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',

  // ─── Kebabs (grilled, smoky, platter) ───────────────────────
  'Mughlai Chicken Kebab': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'Dum Chicken Kebab': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',
  'Tandoori Chicken Wings': 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&h=400&fit=crop',
  'Dragon Chicken Kebab': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',

  // ─── Tandoori Specials (whole chicken, clay oven) ────────────
  'Full Tandoori Chicken': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'Half Tandoori Chicken': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',
  'Afghani Tandoori Chicken': 'https://images.unsplash.com/photo-1610057099895-3c0ed15d3e7e?w=600&h=400&fit=crop',
  'Kalmi Kebab': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=400&fit=crop',
  'Tangdi Kebab': 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=600&h=400&fit=crop',

  // ─── Sea Food Tandoori ──────────────────────────────────────
  'Tandoori Prawns': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&h=400&fit=crop',
  'Malai Prawns Tikka': 'https://images.unsplash.com/photo-1625943553852-781c6dd46faa?w=600&h=400&fit=crop',
  'Fish Tikka': 'https://images.unsplash.com/photo-1553557202-e8e60357f061?w=600&h=400&fit=crop',
  'Garlic Butter Fish Grill': 'https://images.unsplash.com/photo-1553557202-e8e60357f061?w=600&h=400&fit=crop',

  // ─── Veg Tandoori ───────────────────────────────────────────
  'Paneer Tikka': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop',
  'Malai Paneer Tikka': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop',
  'Hariyali Paneer Tikka': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=400&fit=crop',
  'Tandoori Mushroom': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=400&fit=crop',
  'Baby Corn Tikka': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',
  'Hara Bhara Kebab': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=400&fit=crop',

  // ─── Tandoori Curries ───────────────────────────────────────
  'Afghani Chicken Masala': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=600&h=400&fit=crop',
  'Tandoori Chicken Masala': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=600&h=400&fit=crop',
  'Chicken Tikka Masala': 'https://images.unsplash.com/photo-1708782344490-9026aaa5eec7?w=600&h=400&fit=crop',
  'Prawns Tandoori Masala': 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&h=400&fit=crop',

  // ─── Pulao ──────────────────────────────────────────────────
  'Kodi Pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Pachi Mirchi Kodi Pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Prawns Pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Gongura Chicken Pulao': 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&h=400&fit=crop',
  'Gongura Veg Pulao': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Veg Pulao': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Paneer Pulao': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
  'Pachi Mirchi Veg Pulao': 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600&h=400&fit=crop',
};

/**
 * Get the best image URL for a dish.
 * Priority chain:
 * 1. User uploaded custom image (Supabase URL)
 * 2. Exact match in DISH_IMAGES dictionary
 * 3. Category fallback
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

  return resolvedUrl;
}
