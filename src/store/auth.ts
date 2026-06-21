import { create } from 'zustand';
import type { User } from '@shared/types';
import { api, setToken, getToken } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  login: (data: { phone: string; code: string; name?: string; room?: string }) => Promise<User>;
  sendCode: (phone: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateProfile: (data: { name?: string; room?: string }) => Promise<User>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getToken(),
  loading: false,
  initialized: false,

  initAuth: async () => {
    if (get().initialized) return;
    const token = getToken();
    if (token) {
      try {
        const user = await api.auth.me();
        set({ user, token, initialized: true });
      } catch {
        setToken(null);
        set({ user: null, token: null, initialized: true });
      }
    } else {
      set({ initialized: true });
    }
  },

  sendCode: async (phone: string) => {
    set({ loading: true });
    try {
      const result = await api.auth.sendCode(phone);
      return result.debug;
    } finally {
      set({ loading: false });
    }
  },

  login: async (data) => {
    set({ loading: true });
    try {
      const result = await api.auth.login(data);
      setToken(result.token);
      set({ user: result.user, token: result.token, initialized: true });
      return result.user;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await api.auth.logout();
    } catch {
      // ignore error
    } finally {
      setToken(null);
      set({ user: null, token: null, loading: false, initialized: true });
    }
  },

  fetchUser: async () => {
    set({ loading: true });
    try {
      const user = await api.auth.me();
      set({ user });
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (data) => {
    set({ loading: true });
    try {
      const user = await api.auth.updateProfile(data);
      set({ user });
      return user;
    } finally {
      set({ loading: false });
    }
  },
}));
