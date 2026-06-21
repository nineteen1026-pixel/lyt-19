import type { CreditConfig, CreditInfo, DamageSeverity, Borrow } from './types.js';

export const CREDIT_CONFIG: CreditConfig = {
  initialScore: 100,
  maxScore: 100,
  minScore: 0,
  onTimeReturnBonus: 5,
  overduePenalties: [
    { days: 7, penalty: 30 },
    { days: 4, penalty: 20 },
    { days: 1, penalty: 10 },
  ],
  damagePenalties: {
    minor: 10,
    moderate: 20,
    severe: 50,
  },
  borrowLimits: [
    { minScore: 80, maxBorrows: 5 },
    { minScore: 60, maxBorrows: 3 },
    { minScore: 40, maxBorrows: 2 },
    { minScore: 0, maxBorrows: 0 },
  ],
  minBorrowScore: 40,
};

export function calculateOverdueDays(expectedReturnDate: string, actualReturnDate: string): number {
  const expected = new Date(expectedReturnDate).getTime();
  const actual = new Date(actualReturnDate).getTime();
  const diff = actual - expected;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function calculateOverduePenalty(overdueDays: number): number {
  if (overdueDays <= 0) return 0;
  for (const { days, penalty } of CREDIT_CONFIG.overduePenalties) {
    if (overdueDays >= days) {
      return penalty;
    }
  }
  return 0;
}

export function calculateReturnScoreChange(
  expectedReturnDate: string,
  actualReturnDate: string
): number {
  const overdueDays = calculateOverdueDays(expectedReturnDate, actualReturnDate);
  if (overdueDays === 0) {
    return CREDIT_CONFIG.onTimeReturnBonus;
  }
  return -calculateOverduePenalty(overdueDays);
}

export function calculateDamagePenalty(severity: DamageSeverity): number {
  return -(CREDIT_CONFIG.damagePenalties[severity] || 0);
}

export function updateCreditScore(currentScore: number, change: number): number {
  const newScore = currentScore + change;
  return Math.max(CREDIT_CONFIG.minScore, Math.min(CREDIT_CONFIG.maxScore, newScore));
}

export function getMaxBorrows(creditScore: number): number {
  for (const { minScore, maxBorrows } of CREDIT_CONFIG.borrowLimits) {
    if (creditScore >= minScore) {
      return maxBorrows;
    }
  }
  return 0;
}

export function getCreditLevel(creditScore: number): string {
  if (creditScore >= 90) return '优秀';
  if (creditScore >= 80) return '良好';
  if (creditScore >= 70) return '中等';
  if (creditScore >= 60) return '及格';
  if (creditScore >= 40) return '较差';
  return '很差';
}

export function getCreditInfo(creditScore: number, currentBorrows: Borrow[]): CreditInfo {
  const activeBorrows = currentBorrows.filter(b => b.status === 'borrowing' || b.status === 'overdue').length;
  const maxBorrows = getMaxBorrows(creditScore);
  const canBorrow = creditScore >= CREDIT_CONFIG.minBorrowScore && activeBorrows < maxBorrows;
  let reason: string | undefined;

  if (creditScore < CREDIT_CONFIG.minBorrowScore) {
    reason = `信用分不足${CREDIT_CONFIG.minBorrowScore}分，无法借用工具`;
  } else if (activeBorrows >= maxBorrows) {
    reason = `已达到最大借用数量（${maxBorrows}件），请先归还后再申请`;
  }

  return {
    score: creditScore,
    level: getCreditLevel(creditScore),
    maxBorrows,
    currentBorrows: activeBorrows,
    canBorrow,
    reason,
  };
}

export function getCreditLevelColor(creditScore: number): string {
  if (creditScore >= 90) return 'text-green-600 bg-green-100';
  if (creditScore >= 80) return 'text-primary-600 bg-primary-100';
  if (creditScore >= 70) return 'text-blue-600 bg-blue-100';
  if (creditScore >= 60) return 'text-yellow-600 bg-yellow-100';
  if (creditScore >= 40) return 'text-orange-600 bg-orange-100';
  return 'text-red-600 bg-red-100';
}
