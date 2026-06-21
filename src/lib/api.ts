import type { ApiResponse, Tool, Borrow, Deposit, Damage, DashboardStats, User, LoginResponse, CreditInfo } from '@shared/types';

const TOKEN_KEY = 'auth_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    headers,
    ...options,
  });

  if (res.status === 401) {
    setToken(null);
  }

  const data = (await res.json()) as ApiResponse<T>;
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const api = {
  auth: {
    sendCode: (phone: string) =>
      request<{ debug?: string }>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
    login: (data: { phone: string; code: string; name?: string; room?: string }) =>
      request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request<User>('/api/auth/me'),
    updateProfile: (data: { name?: string; room?: string }) =>
      request<User>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<void>('/api/auth/logout', { method: 'POST' }),
  },
  dashboard: {
    getStats: () => request<DashboardStats>('/api/dashboard'),
  },
  tools: {
    list: (params?: { category?: string; keyword?: string }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set('category', params.category);
      if (params?.keyword) q.set('keyword', params.keyword);
      const qs = q.toString();
      return request<Tool[]>(`/api/tools${qs ? `?${qs}` : ''}`);
    },
    get: (id: number) => request<Tool>(`/api/tools/${id}`),
    categories: () => request<string[]>('/api/tools/categories'),
    create: (data: Partial<Tool>) =>
      request<Tool>('/api/tools', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Tool>) =>
      request<Tool>(`/api/tools/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) =>
      request<void>(`/api/tools/${id}`, { method: 'DELETE' }),
  },
  borrows: {
    list: (params?: { status?: string; userId?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.userId) q.set('userId', String(params.userId));
      const qs = q.toString();
      return request<Borrow[]>(`/api/borrows${qs ? `?${qs}` : ''}`);
    },
    mine: (params?: { status?: string }) => {
      const q = params?.status ? `?status=${params.status}` : '';
      return request<Borrow[]>(`/api/borrows/mine${q}`);
    },
    get: (id: number) => request<Borrow>(`/api/borrows/${id}`),
    create: (data: { toolId: number; borrowDate: string; expectedReturnDate: string }) =>
      request<Borrow>('/api/borrows', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: number) =>
      request<Borrow>(`/api/borrows/${id}/approve`, { method: 'PUT' }),
    reject: (id: number) =>
      request<Borrow>(`/api/borrows/${id}/reject`, { method: 'PUT' }),
    returnTool: (id: number) =>
      request<Borrow>(`/api/borrows/${id}/return`, { method: 'PUT' }),
    update: (id: number, data: Partial<Borrow>) =>
      request<Borrow>(`/api/borrows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  deposits: {
    list: () => request<Deposit[]>('/api/deposits'),
    create: (data: Partial<Deposit>) =>
      request<Deposit>('/api/deposits', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Deposit>) =>
      request<Deposit>(`/api/deposits/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  damages: {
    list: () => request<Damage[]>('/api/damages'),
    get: (id: number) => request<Damage>(`/api/damages/${id}`),
    create: (data: Partial<Damage>) =>
      request<Damage>('/api/damages', { method: 'POST', body: JSON.stringify(data) }),
  },
  credit: {
    getInfo: () => request<CreditInfo>('/api/credit/me'),
    getEligibility: () => request<{
      canBorrow: boolean;
      reason?: string;
      maxBorrows: number;
      currentBorrows: number;
      creditScore: number;
    }>('/api/credit/eligibility'),
  },
};
