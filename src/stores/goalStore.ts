import { create } from 'zustand';
import type { Goal } from '../types';
import * as db from '../services/database';

interface GoalState {
  goals: Goal[];
  isLoading: boolean;

  fetchGoals: () => Promise<void>;
  createGoal: (goal: Goal) => Promise<void>;
  updateGoal: (goal: Goal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

/** 目標状態管理ストア（Zustand）*/
export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  isLoading: false,

  fetchGoals: async () => {
    set({ isLoading: true });
    try {
      const goals = await db.getAllGoals();
      set({ goals });
    } finally {
      set({ isLoading: false });
    }
  },

  createGoal: async (goal) => {
    await db.createGoal(goal);
    set((state) => ({ goals: [goal, ...state.goals] }));
  },

  updateGoal: async (goal) => {
    await db.updateGoal(goal);
    set((state) => ({
      goals: state.goals.map((g) => (g.id === goal.id ? goal : g)),
    }));
  },

  deleteGoal: async (id) => {
    await db.deleteGoal(id);
    set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
  },
}));
