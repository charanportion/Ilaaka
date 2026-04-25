import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  setSession: (s: Session | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (s) => set({ session: s, user: s?.user ?? null }),
}));
