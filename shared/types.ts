export type ToolStatus = 'available' | 'maintenance' | 'retired';
export type BorrowStatus = 'pending' | 'approved' | 'rejected' | 'borrowing' | 'returned' | 'overdue';
export type DepositType = 'collect' | 'refund';
export type DepositStatus = 'pending' | 'completed' | 'deducted';
export type DamageSeverity = 'minor' | 'moderate' | 'severe';

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
