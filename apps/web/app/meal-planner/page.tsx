'use client';

import { useState } from 'react';
import { useAuthStore } from '../lib/auth-store';
import { useCartStore } from '../lib/cart-store';
import { toast } from '../lib/toast-store';
import { api } from '../lib/api';

function formatPrice(price: number) {
  return '₹' + price.toLocaleString('en-IN');
}

interface MealPlanDish {
  id: number;
  name: string;
  price: number;
  reason: string;
  isVeg?: boolean;
}

interface MealPlan {
  mealType: string;
  totalPrice: number;
  dishes: MealPlanDish[];
  pairingNote: string;
  chefTip: string;
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅', desc: 'Light & energizing' },
  { value: 'lunch', label: 'Lunch', icon: '☀️', desc: 'Hearty & balanced' },
  { value: 'dinner', label: 'Dinner', icon: '🌙', desc: 'Comforting & warm' },
  { value: 'snack', label: 'Snack', icon: '🍿', desc: 'Quick bites' },
];

const BUDGET_OPTIONS = [
  { value: 150, label: '₹150', desc: 'Light meal' },
  { value: 250, label: '₹250', desc: 'Standard' },
  { value: 400, label: '₹400', desc: 'Premium' },
  { value: 600, label: '₹600', desc: 'Feast' },
];

const DIETARY_OPTIONS = [
  { value: 'No restrictions', label: 'No restrictions' },
  { value: 'Vegetarian only', label: 'Vegetarian only' },
  { value: 'Non-vegetarian', label: 'Non-vegetarian preferred' },
  { value: 'Vegan', label: 'Vegan' },
  { value: 'No spice', label: 'Mild / No spice' },
];

export default function MealPlannerPage() {
  const { token } = useAuthStore();
  const { addItem } = useCartStore();
  const [mealType, setMealType] = useState('lunch');
  const [budget, setBudget] = useState(250);
  const [dietary, setDietary] = useState('No restrictions');
  const [loading, setLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setMealPlan(null);

    try {
      const data = await api.post<{ mealPlan: MealPlan }>('/api/v1/ai/meal-plan', {
        mealType,
        budget,
        dietary,
      }, token || undefined);
      setMealPlan(data.mealPlan);
    } catch {
      setError('Failed to generate meal plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllToCart = () => {
    if (!mealPlan) return;
    for (const dish of mealPlan.dishes) {
      addItem({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        veg: dish.isVeg ?? true,
        image: '',
        modifiers: [],
      });
    }
    toast.success(`${mealPlan.dishes.length} items added to cart`, formatPrice(mealPlan.totalPrice));
  };

  return (
    <div className="container" style={{ paddingTop: 32, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Meal Planner</h1>
        <p style={{ color: '#767676', fontSize: 15 }}>
          Let Chef Katanguri design the perfect meal for you
        </p>
      </div>

      {/* Configuration Card */}
      <div className="card" style={{ padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Configure Your Meal</h2>

        {/* Meal Type */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#666', display: 'block', marginBottom: 10 }}>
            What meal are you planning?
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {MEAL_TYPES.map(mt => (
              <button key={mt.value} onClick={() => setMealType(mt.value)}
                style={{
                  padding: '14px 12px', borderRadius: 12, border: '2px solid',
                  borderColor: mealType === mt.value ? '#e23744' : '#f0f0f0',
                  background: mealType === mt.value ? 'rgba(226, 55, 68, 0.05)' : '#fff',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{mt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: mealType === mt.value ? '#e23744' : '#333' }}>{mt.label}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{mt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#666', display: 'block', marginBottom: 10 }}>
            Your budget
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {BUDGET_OPTIONS.map(bo => (
              <button key={bo.value} onClick={() => setBudget(bo.value)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10, border: '2px solid',
                  borderColor: budget === bo.value ? '#e23744' : '#f0f0f0',
                  background: budget === bo.value ? 'rgba(226, 55, 68, 0.05)' : '#fff',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: budget === bo.value ? '#e23744' : '#333' }}>{bo.label}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{bo.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Dietary */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#666', display: 'block', marginBottom: 10 }}>
            Dietary preference
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DIETARY_OPTIONS.map(d => (
              <button key={d.value} onClick={() => setDietary(d.value)}
                style={{
                  padding: '8px 16px', borderRadius: 20, border: '2px solid',
                  borderColor: dietary === d.value ? '#e23744' : '#f0f0f0',
                  background: dietary === d.value ? '#e23744' : '#fff',
                  color: dietary === d.value ? '#fff' : '#666',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button onClick={handleGenerate} disabled={loading}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            transition: 'transform 0.1s', boxShadow: loading ? 'none' : '0 4px 15px rgba(226, 55, 68, 0.3)',
          }}
          onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
          {loading ? '👨‍🍳 Chef is cooking up your meal plan...' : '🍽️ Generate Meal Plan'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: 20, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', marginBottom: 24 }}>
          <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
        </div>
      )}

      {/* Meal Plan Result */}
      {mealPlan && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 48 }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(226, 55, 68, 0.1) 0%, rgba(198, 40, 40, 0.05) 100%)',
            borderBottom: '1px solid rgba(226, 55, 68, 0.1)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1c1c1c' }}>
                  {mealPlan.mealType.charAt(0).toUpperCase() + mealPlan.mealType.slice(1)} Plan
                </h2>
                <p style={{ fontSize: 13, color: '#767676', marginTop: 2 }}>Designed by Chef Katanguri</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#e23744' }}>{formatPrice(mealPlan.totalPrice)}</div>
                <div style={{ fontSize: 12, color: '#999' }}>Total</div>
              </div>
            </div>
          </div>

          {/* Dishes */}
          <div style={{ padding: '16px 24px' }}>
            {mealPlan.dishes.map((dish, i) => (
              <div key={dish.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0', borderBottom: i < mealPlan.dishes.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c1c' }}>{dish.name}</div>
                  <div style={{ fontSize: 13, color: '#767676', marginTop: 2 }}>{dish.reason}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1c1c1c', marginLeft: 16 }}>{formatPrice(dish.price)}</div>
              </div>
            ))}
          </div>

          {/* Pairing Note */}
          <div style={{ padding: '14px 24px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
              <strong>Why this works:</strong> {mealPlan.pairingNote}
            </div>
          </div>

          {/* Chef Tip */}
          <div style={{ padding: '14px 24px', background: 'rgba(226, 55, 68, 0.03)', borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 13, color: '#e23744', lineHeight: 1.5 }}>
              <strong>👨‍🍳 Chef's Tip:</strong> {mealPlan.chefTip}
            </div>
          </div>

          {/* Add All Button */}
          <div style={{ padding: '16px 24px' }}>
            <button onClick={handleAddAllToCart}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                background: '#e23744', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', transition: 'transform 0.1s',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
              Add All to Cart ({formatPrice(mealPlan.totalPrice)})
            </button>
          </div>
        </div>
      )}

      {/* How it works */}
      {!mealPlan && !loading && (
        <div className="card" style={{ padding: 28, marginBottom: 48 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>How it works</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { step: '01', title: 'Choose your meal type', desc: 'Breakfast, lunch, dinner, or a quick snack', icon: '🍽️' },
              { step: '02', title: 'Set your budget', desc: 'We\'ll suggest dishes that fit your price range', icon: '💰' },
              { step: '03', title: 'Pick dietary preference', desc: 'Vegetarian, vegan, non-veg, or no restrictions', icon: '🥗' },
              { step: '04', title: 'Get your personalized plan', desc: 'Chef Katanguri curates the perfect meal for you', icon: '👨‍🍳' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(226, 55, 68, 0.08)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1c' }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#767676', marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
