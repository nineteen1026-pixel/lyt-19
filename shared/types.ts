export type ToolStatus = 'available' | 'maintenance' | 'retired';
export type BorrowStatus = 'pending' | 'approved' | 'rejected' | 'borrowing' | 'returned' | 'overdue';
export type DepositType = 'collect' | 'refund';
export type DepositStatus = 'pending' | 'completed' | 'deducted';
export type DamageSeverity = 'minor' | 'moderate' | 'severe';
export type UserRole = 'resident' | 'admin';
export type WaitlistStatus = 'waiting' | 'notified' | 'borrowed' | 'cancelled' | 'expired';

export interface User {
  id: number;
  phone: string;
  name: string;
  room: string;
  role: UserRole;
  creditScore: number;
  createdAt: string;
}

export interface CreditConfig {
  initialScore: number;
  maxScore: number;
  minScore: number;
  onTimeReturnBonus: number;
  overduePenalties: { days: number; penalty: number }[];
  damagePenalties: Record<DamageSeverity, number>;
  borrowLimits: { minScore: number; maxBorrows: number }[];
  minBorrowScore: number;
}

export interface CreditInfo {
  score: number;
  level: string;
  maxBorrows: number;
  currentBorrows: number;
  canBorrow: boolean;
  reason?: string;
}

export interface VerificationCode {
  id: number;
  phone: string;
  code: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface Tool {
  id: number;
  name: string;
  category: string;
  image: string;
  description: string;
  depositAmount: number;
  dailyRent: number;
  stock: number;
  status: ToolStatus;
  createdAt: string;
}

export interface Borrow {
  id: number;
  toolId: number;
  toolName: string;
  userId: number | null;
  borrowerName: string;
  borrowerRoom: string;
  borrowerPhone: string;
  borrowDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
  status: BorrowStatus;
  totalRent: number;
  createdAt: string;
}

export interface Deposit {
  id: number;
  borrowId: number;
  amount: number;
  type: DepositType;
  status: DepositStatus;
  deductedAmount: number;
  remark: string;
  createdAt: string;
}

export interface Damage {
  id: number;
  borrowId: number;
  toolId: number;
  description: string;
  severity: DamageSeverity;
  compensationAmount: number;
  reportedBy: string;
  images: string;
  createdAt: string;
}

export interface Waitlist {
  id: number;
  toolId: number;
  toolName: string;
  userId: number;
  userName: string;
  userRoom: string;
  userPhone: string;
  expectedBorrowDate: string;
  expectedReturnDate: string;
  status: WaitlistStatus;
  queuePosition: number | null;
  pickupExpiresAt: string | null;
  notifiedAt: string | null;
  borrowId: number | null;
  createdAt: string;
}

export interface DashboardStats {
  totalTools: number;
  borrowingCount: number;
  depositBalance: number;
  damageCount: number;
  recentBorrows: Borrow[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
