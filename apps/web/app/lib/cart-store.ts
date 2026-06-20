import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  veg: boolean;
  image: string;
  modifiers?: { name: string; label: string; price: number }[];
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  getItemTotal: (item: CartItem) => number;
  getTotal: () => number;
  getCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find(i => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map(i =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1, image: item.image || i.image } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        });
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter(i => i.id !== id),
        }));
        try {
          const { useSpecialInstructions } = require('./useSpecialInstructions');
          useSpecialInstructions.getState().clearInstruction(id);
        } catch { /* instructions store may not be loaded */ }
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map(i =>
            i.id === id ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => {
        set({ items: [] });
        try {
          const { useSpecialInstructions } = require('./useSpecialInstructions');
          useSpecialInstructions.getState().clearAll();
        } catch { /* instructions store may not be loaded */ }
      },

      getItemTotal: (item: CartItem) => {
        const modifierTotal = (item.modifiers || []).reduce((mSum: number, m: any) => mSum + (m.price || 0), 0);
        return (item.price + modifierTotal) * item.quantity;
      },

      getTotal: () => get().items.reduce((sum, i) => {
        const modifierTotal = (i.modifiers || []).reduce((mSum: number, m: any) => mSum + (m.price || 0), 0);
        return sum + (i.price + modifierTotal) * i.quantity;
      }, 0),

      getCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'kitchen-cart',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        if (version === 0) {
          state = {
            ...state,
            items: (state.items || []).map((item: any) => ({
              ...item,
              modifiers: item.modifiers || [],
            })),
          };
        }
        if (version < 2) {
          state = {
            ...state,
            items: (state.items || []).map((item: any) => ({
              ...item,
              image: item.image && typeof item.image === 'string' && item.image.length > 5 ? item.image : '',
            })),
          };
        }
        return state;
      },
    }
  )
);
