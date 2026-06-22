import type { BorrowStatus, DepositStatus, DamageSeverity, WaitlistStatus } from '@shared/types';

export const borrowStatusMap: Record<BorrowStatus, { label: string; className: string }> = {
  pending: { label: '待审批', className: 'bg-amber-100 text-amber-800' },
  approved: { label: '已批准', className: 'bg-blue-100 text-blue-800' },
  rejected: { label: '已拒绝', className: 'bg-gray-100 text-gray-700' },
  borrowing: { label: '借用中', className: 'bg-primary-100 text-primary-800' },
  returned: { label: '已归还', className: 'bg-green-100 text-green-800' },
  overdue: { label: '已逾期', className: 'bg-red-100 text-red-800' },
};

export const waitlistStatusMap: Record<WaitlistStatus, { label: string; className: string }> = {
  waiting: { label: '排队中', className: 'bg-amber-100 text-amber-800' },
  notified: { label: '待取件', className: 'bg-blue-100 text-blue-800' },
  borrowed: { label: '已借用', className: 'bg-green-100 text-green-800' },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-700' },
  expired: { label: '已过期', className: 'bg-red-100 text-red-800' },
};

export const depositStatusMap: Record<DepositStatus, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-amber-100 text-amber-800' },
  completed: { label: '已完成', className: 'bg-green-100 text-green-800' },
  deducted: { label: '已扣款', className: 'bg-red-100 text-red-800' },
};

export const damageSeverityMap: Record<DamageSeverity, { label: string; className: string }> = {
  minor: { label: '轻微', className: 'bg-green-100 text-green-800' },
  moderate: { label: '一般', className: 'bg-amber-100 text-amber-800' },
  severe: { label: '严重', className: 'bg-red-100 text-red-800' },
};

export const toolStatusMap: Record<string, { label: string; className: string }> = {
  available: { label: '可借用', className: 'bg-primary-100 text-primary-800' },
  maintenance: { label: '维护中', className: 'bg-amber-100 text-amber-800' },
  retired: { label: '已停用', className: 'bg-gray-100 text-gray-700' },
};

export function formatDate(date: string | null | undefined) {
  if (!date) return '-';
  return date.slice(0, 10);
}

export function formatMoney(amount: number) {
  return `¥${amount.toFixed(2)}`;
}
