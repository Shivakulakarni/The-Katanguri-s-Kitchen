/**
 * Seed script for The Katanguri's Kitchen — REAL MENU
 * Run with: npx tsx scripts/seed.ts
 */
import 'dotenv/config';
import { db } from '../apps/api/src/db/connection.js';
import { categories, dishes } from '../apps/api/src/db/schemas/menu.js';
import { ingredients, dishIngredients } from '../apps/api/src/db/schemas/inventory.js';
import { automationRules } from '../apps/api/src/db/schemas/automation.js';
import { customers, customerAddresses } from '../apps/api/src/db/schemas/customer.js';
import { orders, orderItems, orderStatusHistory } from '../apps/api/src/db/schemas/order.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';


// Curated fallback photo IDs
const UNIQUE_UNSPLASH_IDS = [
  'photo-1546069901-ba9599a7e63c', 'photo-1498837167922-ddd27525d352', 'photo-1493770348161-369560ae357d'
];
let _imgIdx = 0;
const img = () => {
  const id = UNIQUE_UNSPLASH_IDS[_imgIdx % UNIQUE_UNSPLASH_IDS.length];
  _imgIdx++;
  return `https://images.unsplash.com/${id}?w=400&h=400&fit=crop`;
};

// Verified Pexels images — one unique image per dish
const DISH_IMAGES: Record<string, string> = {
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
  'Crispy Corn': 'https://images.pexels.com/photos/30838940/pexels-photo-30838940.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Baby Corn Majestic': 'https://images.pexels.com/photos/3757707/pexels-photo-3757707.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Baby Corn 65': 'https://images.pexels.com/photos/5718026/pexels-photo-5718026.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chilli Mushroom': 'https://images.pexels.com/photos/5695587/pexels-photo-5695587.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer Majestic': 'https://images.unsplash.com/photo-1589302168068-964664d93cb0?auto=format&fit=crop&w=500&q=80',
  'Chilli Paneer': 'https://images.pexels.com/photos/29631468/pexels-photo-29631468.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer 65': 'https://images.pexels.com/photos/9609837/pexels-photo-9609837.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kadai Chicken': 'https://images.pexels.com/photos/9609838/pexels-photo-9609838.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Shahi Kurma': 'https://images.pexels.com/photos/10345736/pexels-photo-10345736.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Telangana Chicken Curry': 'https://images.pexels.com/photos/37513674/pexels-photo-37513674.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Methi Chicken': 'https://images.pexels.com/photos/34159105/pexels-photo-34159105.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Chatpat': 'https://images.pexels.com/photos/5490697/pexels-photo-5490697.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Mughlai': 'https://images.pexels.com/photos/10810653/pexels-photo-10810653.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Telangana Mutton Curry': 'https://images.pexels.com/photos/14132114/pexels-photo-14132114.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mutton Mughlai': 'https://images.pexels.com/photos/18698236/pexels-photo-18698236.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Keema Mutton Curry': 'https://images.pexels.com/photos/9609855/pexels-photo-9609855.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Dal Tadka': 'https://images.pexels.com/photos/30203314/pexels-photo-30203314.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Jeera Aloo': 'https://images.pexels.com/photos/28674713/pexels-photo-28674713.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kadai Vegetable': 'https://images.pexels.com/photos/19969210/pexels-photo-19969210.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Veg Chat Pat': 'https://images.pexels.com/photos/20408464/pexels-photo-20408464.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kadai Paneer': 'https://images.pexels.com/photos/29684990/pexels-photo-29684990.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kaju Masala': 'https://images.pexels.com/photos/28674555/pexels-photo-28674555.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kaju Paneer Masala': 'https://images.pexels.com/photos/11115801/pexels-photo-11115801.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer Butter Masala': 'https://images.pexels.com/photos/11188417/pexels-photo-11188417.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mushroom Masala': 'https://images.pexels.com/photos/35041663/pexels-photo-35041663.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Fried Rice': 'https://images.pexels.com/photos/12052350/pexels-photo-12052350.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Egg Fried Rice': 'https://images.pexels.com/photos/8992927/pexels-photo-8992927.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mixed Fried Rice': 'https://images.pexels.com/photos/3926124/pexels-photo-3926124.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Schezwan Chicken Fried Rice': 'https://images.pexels.com/photos/5720819/pexels-photo-5720819.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Egg Noodles': 'https://images.pexels.com/photos/8395783/pexels-photo-8395783.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken Noodles': 'https://images.pexels.com/photos/8983416/pexels-photo-8983416.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Schezwan Chicken Noodles': 'https://images.pexels.com/photos/11762852/pexels-photo-11762852.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Veg Fried Rice': 'https://images.pexels.com/photos/34668500/pexels-photo-34668500.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Sambar Rice': 'https://images.pexels.com/photos/35041657/pexels-photo-35041657.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Curd Rice': 'https://images.pexels.com/photos/7593252/pexels-photo-7593252.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Sambar Rice + Curd Rice + Pickle Rice': 'https://images.pexels.com/photos/20408455/pexels-photo-20408455.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Bagara with Chicken Curry': 'https://images.pexels.com/photos/23106696/pexels-photo-23106696.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Bagara with Mixed Veg Curry': 'https://images.pexels.com/photos/28579050/pexels-photo-28579050.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Veg Biryani': 'https://images.pexels.com/photos/9738983/pexels-photo-9738983.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Paneer Biryani': 'https://images.pexels.com/photos/9609859/pexels-photo-9609859.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Kaju Paneer Biryani': 'https://images.pexels.com/photos/9609865/pexels-photo-9609865.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Nizami Chicken Dum Biryani (Single)': 'https://images.pexels.com/photos/9609860/pexels-photo-9609860.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Nizami Chicken Dum Biryani (Regular)': 'https://images.pexels.com/photos/9609868/pexels-photo-9609868.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Nizami Chicken Dum Biryani (Family Pack)': 'https://images.pexels.com/photos/33472114/pexels-photo-33472114.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken 65 Biryani (Single)': 'https://images.pexels.com/photos/9609864/pexels-photo-9609864.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken 65 Biryani (Regular)': 'https://images.pexels.com/photos/12392831/pexels-photo-12392831.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Chicken 65 Biryani (Family Pack)': 'https://images.pexels.com/photos/32825909/pexels-photo-32825909.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Gongura Chicken Biryani': 'https://images.pexels.com/photos/4224304/pexels-photo-4224304.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mutton Ghosh Biryani (Single)': 'https://images.pexels.com/photos/9609856/pexels-photo-9609856.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Mutton Ghosh Biryani (Family Pack)': 'https://images.pexels.com/photos/9609863/pexels-photo-9609863.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Nalli Ghosh Biryani': 'https://images.pexels.com/photos/6089651/pexels-photo-6089651.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Ulavacharu Chicken Biryani': 'https://images.pexels.com/photos/9609840/pexels-photo-9609840.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Prawns Biryani': 'https://images.pexels.com/photos/9609861/pexels-photo-9609861.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Egg Biryani': 'https://images.pexels.com/photos/9609843/pexels-photo-9609843.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Roti': 'https://images.pexels.com/photos/12427834/pexels-photo-12427834.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Pulka': 'https://images.pexels.com/photos/5589941/pexels-photo-5589941.jpeg?auto=compress&cs=tinysrgb&w=500',
  'Gulab Jamun': 'https://images.pexels.com/photos/8887017/pexels-photo-8887017.jpeg?auto=compress&cs=tinysrgb&w=500',
};

// Smart image mapper — uses verified Pexels images per dish
function getImageUrl(name: string, isVeg: boolean): string {
  // Direct lookup by exact dish name
  if (DISH_IMAGES[name]) return DISH_IMAGES[name];

  // Category-based fallback
  const n = name.toLowerCase();
  if (n.includes('biryani') || n.includes('bagara')) return DISH_IMAGES['Veg Biryani'];
  if (n.includes('chicken') && (n.includes('65') || n.includes('dry') || n.includes('majestic'))) return DISH_IMAGES['Chicken 65'];
  if (n.includes('fish') || n.includes('prawns')) return DISH_IMAGES['Fish Fry'];
  if (n.includes('paneer')) return DISH_IMAGES['Paneer Butter Masala'];
  if (n.includes('mutton')) return DISH_IMAGES['Mutton Mughlai'];
  if (n.includes('noodles')) return DISH_IMAGES['Chicken Noodles'];
  if (n.includes('fried rice')) return DISH_IMAGES['Chicken Fried Rice'];
  if (n.includes('roti') || n.includes('pulka')) return DISH_IMAGES['Roti'];
  if (n.includes('dal')) return DISH_IMAGES['Dal Tadka'];
  if (n.includes('jamun')) return DISH_IMAGES['Gulab Jamun'];

  return isVeg
    ? 'https://images.pexels.com/photos/11286586/pexels-photo-11286586.jpeg?auto=compress&cs=tinysrgb&w=500'
    : 'https://images.pexels.com/photos/7353380/pexels-photo-7353380.jpeg?auto=compress&cs=tinysrgb&w=500';
}

function getDescription(name: string, price: string, isVeg: boolean): string {
  const n = name.toLowerCase();
  const dietary = isVeg ? 'Veg' : 'Non-veg';
  const priceStr = `₹${price}`;

  if (n.includes('biryani') || n.includes('bagara')) {
    if (n.includes('chicken') && n.includes('65')) return 'Crispy chicken 65 layered with aromatic basmati rice, slow-cooked dum style';
    if (n.includes('chicken')) return 'Tender chicken pieces marinated in Hyderabadi spices, slow-cooked with fragrant basmati rice';
    if (n.includes('mutton') && n.includes('nalli')) return 'Premium mutton nalli (shank) cooked with saffron-infused rice in traditional dum style';
    if (n.includes('mutton') && n.includes('ghosh') && n.includes('family')) return 'Family-sized portion of melt-in-mouth mutton ghosh biryani with rich, aromatic gravy layers';
    if (n.includes('mutton') || n.includes('ghosh')) return 'Succulent mutton pieces slow-cooked with saffron rice in a sealed dum pot';
    if (n.includes('prawns')) return 'Fresh jumbo prawns cooked with spiced rice and coastal Telangana masala';
    if (n.includes('egg')) return 'Perfect boiled eggs nestled in flavorful masala rice, slow-cooked dum style';
    if (n.includes('ulavacharu')) return 'Signature Telangana dish: ulavacharu (horse gram soup) infused into tender chicken biryani';
    if (n.includes('gongura')) return 'Signature Andhra-Telangana flavor: tangy gongura leaves with spicy chicken biryani';
    if (n.includes('paneer')) return 'Soft paneer cubes marinated in Hyderabadi spices, layered with aromatic basmati rice';
    if (n.includes('kaju')) return 'Rich paneer and cashew nut biryani with saffron-infused rice';
    if (n.includes('veg')) return 'Garden-fresh vegetables cooked with fragrant spices in traditional dum style';
    if (n.includes('family')) return 'Generous family-sized portion, perfect for 4-5 people';
    if (n.includes('single')) return 'Single-serving biryani portion, perfect for one person';
    return 'Our signature Hyderabadi-style biryani, slow-cooked with love';
  }

  if (n.includes('chicken') && (n.includes('65') || n.includes('dry') || n.includes('majestic') || n.includes('chilli') || n.includes('lemon'))) {
    if (n.includes('majestic')) return 'Crispy chicken pieces tossed in tangy, spicy Hyderabadi Majestic sauce with curry leaves';
    if (n.includes('65')) return 'Iconic Hyderabadi Chicken 65 — deep-fried spiced chicken with red chilli chutney';
    if (n.includes('chilli')) return 'Wok-tossed chicken with fresh green chillies, bell peppers, and soy sauce';
    if (n.includes('lemon')) return 'Tangy lemon-marinated chicken, grilled to juicy perfection';
    if (n.includes('dry')) return 'Slow-cooked Hyderabadi-style dry chicken with aromatic spices';
    if (n.includes('hills')) return 'Special Green Hills Chicken — marinated in green herbs and pan-fried crispy';
    return 'Crispy, spicy chicken starter — a crowd favorite';
  }

  if (n.includes('fish')) {
    if (n.includes('chilli')) return 'Crispy fried fish tossed with spicy chilli sauce and bell peppers';
    if (n.includes('fry')) return 'Fresh fish marinated in coastal spices, shallow-fried to golden perfection';
    if (n.includes('apollo')) return 'Apollo Fish — crispy fish fillets tossed in tangy Hyderabadi sauce';
    return 'Fresh catch of the day, prepared in traditional Telangana style';
  }

  if (n.includes('prawns')) {
    if (n.includes('loose')) return 'Lightly battered prawns, deep-fried until golden and crispy';
    return 'Juicy prawns cooked in coastal Andhra spices';
  }

  if (n.includes('egg') && n.includes('chilli')) return 'Wok-tossed boiled eggs in spicy chilli sauce with onions and bell peppers';

  if (n.includes('paneer') && (n.includes('majestic') || n.includes('chilli') || n.includes('65'))) {
    if (n.includes('majestic')) return 'Crispy paneer cubes tossed in tangy Majestic sauce with fresh herbs';
    if (n.includes('chilli')) return 'Wok-fried paneer with spicy chilli sauce, onions, and capsicum';
    return 'Crispy fried paneer 65 — a vegetarian classic';
  }

  if (n.includes('corn') || n.includes('mushroom')) {
    if (n.includes('crispy')) return 'Sweet corn kernels, lightly battered and deep-fried until golden crispy';
    return 'Fresh mushrooms sautéed with spicy masala and curry leaves';
  }

  if (n.includes('baby corn')) {
    if (n.includes('majestic')) return 'Baby corn tossed in tangy Majestic sauce — a Hyderabadi specialty';
    return 'Crispy baby corn 65, spiced and fried to perfection';
  }

  if (n.includes('chicken') && (n.includes('curry') || n.includes('masala') || n.includes('kadai') || n.includes('kurma') || n.includes('methi') || n.includes('chatpat') || n.includes('mughlai'))) {
    if (n.includes('kadai')) return 'Chicken cooked in traditional iron kadai with fresh ground spices and tomatoes';
    if (n.includes('kurma')) return 'Rich, creamy Shahi Kurma with tender chicken in cashew and almond gravy';
    if (n.includes('methi')) return 'Aromatic methi (fenugreek) chicken — mildly spiced with fresh herbs';
    if (n.includes('chatpat')) return 'Tangy and spicy chicken chatpat — a fiery Andhra-style preparation';
    if (n.includes('mughlai')) return 'Rich Mughlai chicken in creamy onion-tomato gravy with aromatic spices';
    if (n.includes('telangana')) return 'Authentic Telangana-style chicken curry with fiery red chilli paste';
    return 'Classic chicken curry slow-cooked with traditional spices';
  }

  if (n.includes('mutton') || n.includes('keema')) {
    if (n.includes('telangana')) return 'Authentic Telangana mutton curry — fiery, rich, and deeply flavorful';
    if (n.includes('mughlai')) return 'Creamy Mughlai mutton with aromatic spices and rich onion gravy';
    if (n.includes('keema')) return 'Spiced minced mutton (keema) slow-cooked with fresh herbs and peas';
    return 'Tender mutton pieces slow-cooked in a rich, aromatic gravy';
  }

  if (n.includes('paneer') && (n.includes('butter') || n.includes('masala') || n.includes('kadai') || n.includes('kaju'))) {
    if (n.includes('butter')) return 'Soft paneer cubes in creamy tomato-butter gravy — the classic North Indian favorite';
    if (n.includes('kadai')) return 'Paneer cubes cooked in iron kadai with bell peppers and fresh ground spices';
    if (n.includes('kaju') && n.includes('paneer')) return 'Paneer and cashew nuts in rich, creamy masala gravy';
    return 'Soft paneer cubes in aromatic masala gravy';
  }

  if (n.includes('dal')) return 'Comforting toor dal tempered with cumin, mustard seeds, and curry leaves';

  if (n.includes('jeera aloo')) return 'Cumin-flavored baby potatoes, pan-roasted with herbs and mild spices';

  if (n.includes('kadai vegetable')) return 'Mixed seasonal vegetables cooked in traditional iron kadai with fresh spices';

  if (n.includes('veg chat pat')) return 'Spicy and tangy mixed vegetable chatpat — a quick stir-fry with bold flavors';

  if (n.includes('kaju masala')) return 'Cashew nuts cooked in rich, creamy tomato-onion masala gravy';

  if (n.includes('mushroom') && n.includes('masala')) return 'Fresh mushrooms sautéed in aromatic masala with onions and tomatoes';

  if (n.includes('fried rice')) {
    if (n.includes('schezwan')) return 'Wok-tossed rice with Schezwan sauce, vegetables, and your choice of protein';
    if (n.includes('mixed')) return 'Mixed non-veg fried rice with chicken, egg, and fresh vegetables';
    if (n.includes('egg')) return 'Wok-fried rice with scrambled eggs and fresh vegetables';
    if (n.includes('chicken')) return 'Wok-fried rice with tender chicken pieces and fresh vegetables';
    if (n.includes('veg')) return 'Wok-fried rice with crisp vegetables and light soy seasoning';
    return 'Wok-fried rice with fresh vegetables and aromatic seasonings';
  }

  if (n.includes('noodles')) {
    if (n.includes('schezwan')) return 'Slippery noodles tossed in spicy Schezwan sauce with vegetables';
    if (n.includes('chicken')) return 'Egg noodles stir-fried with tender chicken and vegetables';
    if (n.includes('egg')) return 'Classic egg noodles stir-fried with vegetables and soy sauce';
    return 'Stir-fried noodles with vegetables and savory seasonings';
  }

  if (n.includes('sambar rice')) return 'Comforting rice with hot sambar — a classic South Indian meal';
  if (n.includes('curd rice')) return 'Cool, creamy curd rice tempered with mustard seeds and curry leaves';
  if (n.includes('sambar rice + curd')) return 'Combo of sambar rice, curd rice, and tangy pickle rice — complete comfort meal';

  if (n.includes('bagara') && n.includes('chicken')) return 'Fragrant bagara rice served with spicy chicken curry';
  if (n.includes('bagara') && n.includes('veg')) return 'Fragrant bagara rice served with mixed vegetable curry';

  if (n.includes('roti')) return 'Freshly made whole wheat roti, cooked on tawa';
  if (n.includes('pulka')) return 'Soft, fluffy pulka bread cooked on open flame';

  if (n.includes('gulab jamun')) return 'Soft, syrup-soaked milk dumplings — a timeless Indian dessert';

  return `${dietary} dish — freshly prepared with authentic spices`;
}

async function seed() {
  console.log('Seeding The Katanguri\'s Kitchen (REAL MENU)...');

  await db.delete(orderItems);
  await db.delete(orderStatusHistory);
  await db.delete(orders);
  await db.delete(customerAddresses);
  await db.delete(dishIngredients);
  await db.delete(ingredients);
  await db.delete(dishes);
  await db.delete(categories);
  await db.delete(automationRules);
  await db.delete(customers);

  // ── Admin User ──
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@katanguri.com';
  const adminPhone = process.env.ADMIN_PHONE || '9347968582';
  const adminName = process.env.ADMIN_NAME || 'Admin User';
  await db.insert(customers).values({
    email: adminEmail, phone: adminPhone,
    name: adminName, passwordHash: adminHash, isGuest: false, role: 'admin',
  });
  console.log(`Admin user created: ${adminEmail} / ${adminPassword}`);

  // ══════════════════════════════════════════════
  //  CATEGORIES
  // ══════════════════════════════════════════════
  const [catNVStarters]  = await db.insert(categories).values({ name: 'NON-VEG STARTERS',  description: 'Crispy, spicy non-veg starters', displayOrder: 1 }).returning();
  const [catVStarters]   = await db.insert(categories).values({ name: 'VEG STARTERS',     description: 'Crispy veg starters', displayOrder: 2 }).returning();
  const [catNVCurries]   = await db.insert(categories).values({ name: 'NON-VEG CURRIES',  description: 'Rich non-veg curries', displayOrder: 3 }).returning();
  const [catVCurries]    = await db.insert(categories).values({ name: 'VEG CURRIES',      description: 'Flavorful veg curries', displayOrder: 4 }).returning();
  const [catChinese]     = await db.insert(categories).values({ name: 'CHINESE',          description: 'Indo-Chinese favorites', displayOrder: 5 }).returning();
  const [catRiceBowl]    = await db.insert(categories).values({ name: 'RICE BOWL COMBO',  description: 'Comfort rice combos', displayOrder: 6 }).returning();
  const [catBiryani]     = await db.insert(categories).values({ name: 'BIRYANIS',         description: 'Our signature dum biryanis', displayOrder: 7 }).returning();
  const [catBreads]      = await db.insert(categories).values({ name: 'BREADS',           description: 'Fresh Indian breads', displayOrder: 8 }).returning();
  const [catDesserts]    = await db.insert(categories).values({ name: 'DESSERTS',         description: 'Sweet endings', displayOrder: 9 }).returning();

  console.log('Categories inserted: 9');

  // ══════════════════════════════════════════════
  //  NON-VEG STARTERS
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catNVStarters.id, name: 'Green Hills Chicken',    price: '189', isVeg: false, prepTimeMin: 15, imageUrl: getImageUrl('Green Hills Chicken', false), description: 'Special Green Hills Chicken — marinated in green herbs and pan-fried crispy' },
    { categoryId: catNVStarters.id, name: 'Hyderabad Chicken Dry', price: '189', isVeg: false, prepTimeMin: 15, imageUrl: getImageUrl('Hyderabad Chicken Dry', false), description: 'Slow-cooked Hyderabadi-style dry chicken with aromatic spices and curry leaves' },
    { categoryId: catNVStarters.id, name: 'Chicken 65',            price: '189', isVeg: false, prepTimeMin: 15, imageUrl: getImageUrl('Chicken 65', false), description: 'Iconic Hyderabadi Chicken 65 — deep-fried spiced chicken with red chilli chutney' },
    { categoryId: catNVStarters.id, name: 'Chilli Chicken',        price: '189', isVeg: false, prepTimeMin: 15, imageUrl: getImageUrl('Chilli Chicken', false), description: 'Wok-tossed chicken with fresh green chillies, bell peppers, and soy sauce' },
    { categoryId: catNVStarters.id, name: 'Lemon Chicken',         price: '189', isVeg: false, prepTimeMin: 15, imageUrl: getImageUrl('Lemon Chicken', false), description: 'Tangy lemon-marinated chicken, grilled to juicy perfection with mint chutney' },
    { categoryId: catNVStarters.id, name: 'Chilli Fish',           price: '249', isVeg: false, prepTimeMin: 18, imageUrl: getImageUrl('Chilli Fish', false), description: 'Crispy fried fish tossed with spicy chilli sauce and bell peppers' },
    { categoryId: catNVStarters.id, name: 'Loose Fried Prawns',    price: '249', isVeg: false, prepTimeMin: 18, imageUrl: getImageUrl('Loose Fried Prawns', false), description: 'Lightly battered prawns, deep-fried until golden and crispy' },
    { categoryId: catNVStarters.id, name: 'Apollo Fish',           price: '249', isVeg: false, prepTimeMin: 18, imageUrl: getImageUrl('Apollo Fish', false), description: 'Apollo Fish — crispy fish fillets tossed in tangy Hyderabadi sauce' },
    { categoryId: catNVStarters.id, name: 'Fish Fry',              price: '249', isVeg: false, prepTimeMin: 18, imageUrl: getImageUrl('Fish Fry', false), description: 'Fresh fish marinated in coastal spices, shallow-fried to golden perfection' },
    { categoryId: catNVStarters.id, name: 'Chilli Egg',            price: '149', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Chilli Egg', false), description: 'Wok-tossed boiled eggs in spicy chilli sauce with onions and bell peppers' },
    { categoryId: catNVStarters.id, name: 'Chicken Majestic',      price: '189', isVeg: false, prepTimeMin: 18, imageUrl: getImageUrl('Chicken Majestic', false), description: 'Crispy chicken pieces tossed in tangy, spicy Hyderabadi Majestic sauce with curry leaves' },
  ]);

  // ══════════════════════════════════════════════
  //  VEG STARTERS
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catVStarters.id, name: 'Crispy Corn',         price: '149', isVeg: true, prepTimeMin: 12, imageUrl: getImageUrl('Crispy Corn', true) },
    { categoryId: catVStarters.id, name: 'Baby Corn Majestic',  price: '149', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Baby Corn Majestic', true) },
    { categoryId: catVStarters.id, name: 'Baby Corn 65',        price: '149', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Baby Corn 65', true) },
    { categoryId: catVStarters.id, name: 'Chilli Mushroom',     price: '179', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Chilli Mushroom', true) },
    { categoryId: catVStarters.id, name: 'Paneer Majestic',     price: '179', isVeg: true, prepTimeMin: 18, imageUrl: getImageUrl('Paneer Majestic', true) },
    { categoryId: catVStarters.id, name: 'Chilli Paneer',       price: '179', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Chilli Paneer', true) },
    { categoryId: catVStarters.id, name: 'Paneer 65',           price: '179', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Paneer 65', true) },
  ]);

  // ══════════════════════════════════════════════
  //  NON-VEG CURRIES
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catNVCurries.id, name: 'Kadai Chicken',           price: '229', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Kadai Chicken', false) },
    { categoryId: catNVCurries.id, name: 'Chicken Shahi Kurma',     price: '229', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Chicken Shahi Kurma', false) },
    { categoryId: catNVCurries.id, name: 'Telangana Chicken Curry', price: '229', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Telangana Chicken Curry', false) },
    { categoryId: catNVCurries.id, name: 'Methi Chicken',           price: '229', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Methi Chicken', false) },
    { categoryId: catNVCurries.id, name: 'Chicken Chatpat',         price: '229', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Chicken Chatpat', false) },
    { categoryId: catNVCurries.id, name: 'Chicken Mughlai',         price: '229', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Chicken Mughlai', false) },
    { categoryId: catNVCurries.id, name: 'Telangana Mutton Curry',  price: '299', isVeg: false, prepTimeMin: 25, imageUrl: getImageUrl('Telangana Mutton Curry', false) },
    { categoryId: catNVCurries.id, name: 'Mutton Mughlai',          price: '299', isVeg: false, prepTimeMin: 25, imageUrl: getImageUrl('Mutton Mughlai', false) },
    { categoryId: catNVCurries.id, name: 'Keema Mutton Curry',      price: '349', isVeg: false, prepTimeMin: 25, imageUrl: getImageUrl('Keema Mutton Curry', false) },
  ]);

  // ══════════════════════════════════════════════
  //  VEG CURRIES
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catVCurries.id, name: 'Dal Tadka',             price: '149', isVeg: true, prepTimeMin: 10, imageUrl: getImageUrl('Dal Tadka', true) },
    { categoryId: catVCurries.id, name: 'Jeera Aloo',            price: '119', isVeg: true, prepTimeMin: 10, imageUrl: getImageUrl('Jeera Aloo', true) },
    { categoryId: catVCurries.id, name: 'Kadai Vegetable',       price: '149', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Kadai Vegetable', true) },
    { categoryId: catVCurries.id, name: 'Veg Chat Pat',          price: '149', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Veg Chat Pat', true) },
    { categoryId: catVCurries.id, name: 'Kadai Paneer',          price: '189', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Kadai Paneer', true) },
    { categoryId: catVCurries.id, name: 'Kaju Masala',           price: '199', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Kaju Masala', true) },
    { categoryId: catVCurries.id, name: 'Kaju Paneer Masala',    price: '219', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Kaju Paneer Masala', true) },
    { categoryId: catVCurries.id, name: 'Paneer Butter Masala',  price: '179', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Paneer Butter Masala', true) },
    { categoryId: catVCurries.id, name: 'Mushroom Masala',       price: '179', isVeg: true, prepTimeMin: 15, imageUrl: getImageUrl('Mushroom Masala', true) },
  ]);

  // ══════════════════════════════════════════════
  //  CHINESE
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catChinese.id, name: 'Chicken Fried Rice',           price: '149', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Chicken Fried Rice', false) },
    { categoryId: catChinese.id, name: 'Egg Fried Rice',              price: '139', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Egg Fried Rice', false) },
    { categoryId: catChinese.id, name: 'Mixed Fried Rice',            price: '199', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Mixed Fried Rice', false) },
    { categoryId: catChinese.id, name: 'Schezwan Chicken Fried Rice', price: '159', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Schezwan Chicken Fried Rice', false) },
    { categoryId: catChinese.id, name: 'Egg Noodles',                 price: '139', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Egg Noodles', false) },
    { categoryId: catChinese.id, name: 'Chicken Noodles',             price: '149', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Chicken Noodles', false) },
    { categoryId: catChinese.id, name: 'Schezwan Chicken Noodles',    price: '159', isVeg: false, prepTimeMin: 12, imageUrl: getImageUrl('Schezwan Chicken Noodles', false) },
    { categoryId: catChinese.id, name: 'Veg Fried Rice',              price: '119', isVeg: true,  prepTimeMin: 12, imageUrl: getImageUrl('Veg Fried Rice', true) },
  ]);

  // ══════════════════════════════════════════════
  //  RICE BOWL COMBO
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catRiceBowl.id, name: 'Sambar Rice',                           price: '119', isVeg: true,  prepTimeMin: 8,  imageUrl: getImageUrl('Sambar Rice', true) },
    { categoryId: catRiceBowl.id, name: 'Curd Rice',                             price: '119', isVeg: true,  prepTimeMin: 5,  imageUrl: getImageUrl('Curd Rice', true) },
    { categoryId: catRiceBowl.id, name: 'Sambar Rice + Curd Rice + Pickle Rice', price: '199', isVeg: true,  prepTimeMin: 10, imageUrl: getImageUrl('Sambar Rice + Curd Rice + Pickle Rice', true) },
    { categoryId: catRiceBowl.id, name: 'Bagara with Chicken Curry',             price: '149', isVeg: false, prepTimeMin: 15, imageUrl: getImageUrl('Bagara with Chicken Curry', false) },
    { categoryId: catRiceBowl.id, name: 'Bagara with Mixed Veg Curry',           price: '129', isVeg: true,  prepTimeMin: 12, imageUrl: getImageUrl('Bagara with Mixed Veg Curry', true) },
  ]);

  // ══════════════════════════════════════════════
  //  BIRYANIS
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catBiryani.id, name: 'Veg Biryani',                             price: '149', isVeg: true,  prepTimeMin: 20, imageUrl: getImageUrl('Veg Biryani', true) },
    { categoryId: catBiryani.id, name: 'Paneer Biryani',                          price: '199', isVeg: true,  prepTimeMin: 20, imageUrl: getImageUrl('Paneer Biryani', true) },
    { categoryId: catBiryani.id, name: 'Kaju Paneer Biryani',                     price: '229', isVeg: true,  prepTimeMin: 20, imageUrl: getImageUrl('Kaju Paneer Biryani', true) },
    { categoryId: catBiryani.id, name: 'Nizami Chicken Dum Biryani (Single)',     price: '149', isVeg: false, prepTimeMin: 30, imageUrl: getImageUrl('Nizami Chicken Dum Biryani (Single)', false) },
    { categoryId: catBiryani.id, name: 'Nizami Chicken Dum Biryani (Regular)',    price: '199', isVeg: false, prepTimeMin: 30, imageUrl: getImageUrl('Nizami Chicken Dum Biryani (Regular)', false) },
    { categoryId: catBiryani.id, name: 'Nizami Chicken Dum Biryani (Family Pack)',price: '399', isVeg: false, prepTimeMin: 35, imageUrl: getImageUrl('Nizami Chicken Dum Biryani (Family Pack)', false) },
    { categoryId: catBiryani.id, name: 'Chicken 65 Biryani (Single)',             price: '169', isVeg: false, prepTimeMin: 25, imageUrl: getImageUrl('Chicken 65 Biryani (Single)', false) },
    { categoryId: catBiryani.id, name: 'Chicken 65 Biryani (Regular)',            price: '229', isVeg: false, prepTimeMin: 25, imageUrl: getImageUrl('Chicken 65 Biryani (Regular)', false) },
    { categoryId: catBiryani.id, name: 'Chicken 65 Biryani (Family Pack)',        price: '449', isVeg: false, prepTimeMin: 30, imageUrl: getImageUrl('Chicken 65 Biryani (Family Pack)', false) },
    { categoryId: catBiryani.id, name: 'Gongura Chicken Biryani',                 price: '229', isVeg: false, prepTimeMin: 25, imageUrl: getImageUrl('Gongura Chicken Biryani', false) },
    { categoryId: catBiryani.id, name: 'Mutton Ghosh Biryani (Single)',           price: '299', isVeg: false, prepTimeMin: 35, imageUrl: getImageUrl('Mutton Ghosh Biryani (Single)', false) },
    { categoryId: catBiryani.id, name: 'Mutton Ghosh Biryani (Family Pack)',      price: '499', isVeg: false, prepTimeMin: 40, imageUrl: getImageUrl('Mutton Ghosh Biryani (Family Pack)', false) },
    { categoryId: catBiryani.id, name: 'Nalli Ghosh Biryani',                     price: '399', isVeg: false, prepTimeMin: 40, imageUrl: getImageUrl('Nalli Ghosh Biryani', false) },
    { categoryId: catBiryani.id, name: 'Ulavacharu Chicken Biryani',              price: '299', isVeg: false, prepTimeMin: 30, imageUrl: getImageUrl('Ulavacharu Chicken Biryani', false) },
    { categoryId: catBiryani.id, name: 'Prawns Biryani',                          price: '299', isVeg: false, prepTimeMin: 30, imageUrl: getImageUrl('Prawns Biryani', false) },
    { categoryId: catBiryani.id, name: 'Egg Biryani',                             price: '149', isVeg: false, prepTimeMin: 20, imageUrl: getImageUrl('Egg Biryani', false) },
  ]);

  // ══════════════════════════════════════════════
  //  BREADS
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catBreads.id, name: 'Roti',  price: '15', isVeg: true, prepTimeMin: 5, imageUrl: getImageUrl('Roti', true) },
    { categoryId: catBreads.id, name: 'Pulka', price: '12', isVeg: true, prepTimeMin: 5, imageUrl: getImageUrl('Pulka', true) },
  ]);

  // ══════════════════════════════════════════════
  //  DESSERTS
  // ══════════════════════════════════════════════
  await db.insert(dishes).values([
    { categoryId: catDesserts.id, name: 'Gulab Jamun', price: '20', isVeg: true, prepTimeMin: 3, description: 'Per piece', imageUrl: getImageUrl('Gulab Jamun', true) },
  ]);

  // ══════════════════════════════════════════════
  //  INGREDIENTS
  // ══════════════════════════════════════════════
  await db.insert(ingredients).values({ name: 'Chicken (Bone-in)', unit: 'kg', currentStock: '15', parLevel: '8', unitCost: '180' });
  await db.insert(ingredients).values({ name: 'Mutton', unit: 'kg', currentStock: '5', parLevel: '3', unitCost: '450' });
  await db.insert(ingredients).values({ name: 'Prawns', unit: 'kg', currentStock: '3', parLevel: '2', unitCost: '400' });
  await db.insert(ingredients).values({ name: 'Fish', unit: 'kg', currentStock: '4', parLevel: '2', unitCost: '350' });
  await db.insert(ingredients).values({ name: 'Paneer', unit: 'kg', currentStock: '10', parLevel: '5', unitCost: '180' });
  await db.insert(ingredients).values({ name: 'Basmati Rice', unit: 'kg', currentStock: '30', parLevel: '15', unitCost: '100' });
  await db.insert(ingredients).values({ name: 'Toor Dal', unit: 'kg', currentStock: '8', parLevel: '5', unitCost: '90' });
  await db.insert(ingredients).values({ name: 'Curd', unit: 'L', currentStock: '10', parLevel: '5', unitCost: '40' });
  await db.insert(ingredients).values({ name: 'Cooking Oil', unit: 'L', currentStock: '20', parLevel: '10', unitCost: '120' });
  await db.insert(ingredients).values({ name: 'Eggs', unit: 'pcs', currentStock: '100', parLevel: '50', unitCost: '6' });
  await db.insert(ingredients).values({ name: 'Mushroom', unit: 'kg', currentStock: '3', parLevel: '2', unitCost: '120' });
  await db.insert(ingredients).values({ name: 'Cashew Nuts', unit: 'kg', currentStock: '2', parLevel: '1', unitCost: '800' });

  // ══════════════════════════════════════════════
  //  AUTOMATION RULES
  // ══════════════════════════════════════════════
  await db.insert(automationRules).values([
    {
      name: 'Auto-refund on early cancellation', trigger: 'order.cancelled',
      conditions: [{ field: 'order.status', op: 'eq', value: 'CONFIRMED' }, { field: 'order.elapsed_minutes', op: 'lt', value: 5 }],
      actions: [{ type: 'refund', params: { full: true } }, { type: 'notification', params: { channel: 'email', template: 'refund-initiated' } }],
      isActive: true,
    },
    {
      name: 'Out of stock alert', trigger: 'stock.depleted', conditions: [],
      actions: [{ type: 'notification', params: { channel: 'slack', template: 'stock-depleted' } }],
      isActive: true,
    },
    {
      name: 'Low stock auto-PO', trigger: 'stock.low', conditions: [],
      actions: [{ type: 'notification', params: { channel: 'dashboard', template: 'low-stock' } }],
      isActive: true,
    },
  ]);

  const totalDishes = await db.select().from(dishes);
  
  try {
    const Redis = (await import('ioredis')).default;
    const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redisClient.del('cache:menu:all');
    redisClient.disconnect();
    console.log('Redis menu cache cleared successfully.');
  } catch (err) {
    console.log('Failed to clear Redis menu cache during seed (Redis offline or ioredis missing):', err);
  }

  console.log(`Seed complete! ${totalDishes.length} dishes across 9 categories.`);
  console.log('The Katanguri\'s Kitchen — Hunter Road, Syampet, Hanamkonda');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
