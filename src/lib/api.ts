import type { ApiResponse, Tool, Borrow, Deposit, Damage, DashboardStats } from '@shared/types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const api = {
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
    list: (params?: { status?: string }) => {
      const q = params?.status ? `?status=${params.status}` : '';
      return request<Borrow[]>(`/api/borrows${q}`);
    },
    get: (id: number) => request<Borrow>(`/api/borrows/${id}`),
    create: (data: Partial<Borrow> & { borrowDate: string; expectedReturnDate: string }) =>
      request<Borrow>('/api/borrows', { method: 'POST', body: JSON.stringify(data) }),
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
};
