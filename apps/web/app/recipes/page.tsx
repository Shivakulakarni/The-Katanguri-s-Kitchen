'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };

const recipes = [
  { title: 'Hyderabadi Dum Biryani', desc: 'A centuries-old technique of layering partially cooked basmati rice with marinated meat, saffron milk, and fried onions, then slow-cooking in a sealed pot.', tag: 'Signature' },
  { title: 'Chicken 65', desc: 'Crispy deep-fried chicken tossed with curry leaves, dried red chilies, and a secret spice blend that gives it its iconic red color.', tag: 'Popular' },
  { title: 'Mutton Curry', desc: 'Slow-cooked mutton in a rich, aromatic gravy made with roasted spices, coconut, and fresh herbs — tender and full of flavor.', tag: 'Classic' },
  { title: 'Paneer Butter Masala', desc: 'Soft paneer cubes in a creamy, tomato-based gravy with cashew paste, butter, and a hint of kasuri methi.', tag: 'Vegetarian' },
  { title: 'Double Ka Meetha', desc: 'A royal Hyderabadi dessert made with fried bread slices soaked in saffron-flavored milk and topped with dry fruits.', tag: 'Dessert' },
];

export default function RecipesPage() {
  return (
    <div style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="container" style={{ maxWidth: 800 }}>
        <motion.div {...fadeUp}>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: 'var(--ink-deep)', marginBottom: 8 }}>
            Our Recipes
          </h1>
          <p style={{ color: 'var(--steel)', fontSize: 16, marginBottom: 32, lineHeight: 1.7 }}>
            Behind every dish is a story. Discover the traditions behind our most loved recipes.
          </p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {recipes.map((recipe, i) => (
            <motion.div key={recipe.title} {...fadeUp} transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}>
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)' }}>{recipe.title}</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--surface-warm)', padding: '3px 10px', borderRadius: 'var(--rounded-full)', textTransform: 'uppercase' }}>{recipe.tag}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--charcoal)', lineHeight: 1.7 }}>{recipe.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.5 }}>
          <div className="card" style={{ padding: 32, textAlign: 'center', marginTop: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-deep)', marginBottom: 8 }}>Hungry yet?</h2>
            <p style={{ color: 'var(--steel)', fontSize: 14, marginBottom: 20 }}>Try these dishes fresh from our kitchen.</p>
            <Link href="/menu" style={{ background: 'var(--primary)', color: '#fff', padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
              Order Now
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
