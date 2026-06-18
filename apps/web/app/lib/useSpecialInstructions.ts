'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Per-dish special instructions store.
 * Stores instructions keyed by dish ID, persisted to localStorage.
 */
interface InstructionsState {
  instructions: Record<number, string>;
  setInstruction: (dishId: number, instruction: string) => void;
  getInstruction: (dishId: number) => string;
  clearInstruction: (dishId: number) => void;
  clearAll: () => void;
}

export const useSpecialInstructions = create<InstructionsState>()(
  persist(
    (set, get) => ({
      instructions: {},

      setInstruction: (dishId, instruction) => {
        set((state) => ({
          instructions: { ...state.instructions, [dishId]: instruction },
        }));
      },

      getInstruction: (dishId) => get().instructions[dishId] || '',

      clearInstruction: (dishId) => {
        set((state) => {
          const next = { ...state.instructions };
          delete next[dishId];
          return { instructions: next };
        });
      },

      clearAll: () => set({ instructions: {} }),
    }),
    { name: 'kitchen-instructions', version: 1 }
  )
);
