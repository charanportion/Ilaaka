import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { fetchOwnProfile } from '@/lib/users';
import type { OwnProfile } from '@/types/api';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: OwnProfile | null;
  setSession: (s: Session | null) => void;
  setProfile: (p: OwnProfile | null) => void;
  refreshProfile: () => Promise<OwnProfile | null>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  setSession: (s) => {
    const next = { session: s, user: s?.user ?? null };
    if (!s) set({ ...next, profile: null });
    else set(next);
  },
  setProfile: (p) => set({ profile: p }),
  refreshProfile: async () => {
    const userId = get().user?.id;
    if (!userId) {
      set({ profile: null });
      return null;
    }
    const p = await fetchOwnProfile(userId);
    set({ profile: p });
    return p;
  },
}));
