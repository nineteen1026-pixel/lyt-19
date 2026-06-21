import db from '../db/database.js';
import type { User, Borrow, DamageSeverity } from '../../shared/types.js';
import {
  calculateReturnScoreChange,
  calculateDamagePenalty,
  updateCreditScore,
  getCreditInfo,
  getMaxBorrows,
  CREDIT_CONFIG,
} from '../../shared/credit.js';

export function getUserCreditScore(userId: number): number {
  const user = db.prepare('SELECT creditScore FROM users WHERE id = ?').get(userId) as { creditScore: number } | undefined;
  return user?.creditScore ?? CREDIT_CONFIG.initialScore;
}

export function updateUserCreditScore(userId: number, scoreChange: number): number {
  const currentScore = getUserCreditScore(userId);
  const newScore = updateCreditScore(currentScore, scoreChange);
  db.prepare('UPDATE users SET creditScore = ? WHERE id = ?').run(newScore, userId);
  return newScore;
}

export function handleReturnCreditUpdate(borrow: Borrow): number {
  if (!borrow.userId || !borrow.actualReturnDate) return 0;

  const scoreChange = calculateReturnScoreChange(
    borrow.expectedReturnDate,
    borrow.actualReturnDate
  );

  if (scoreChange !== 0) {
    return updateUserCreditScore(borrow.userId, scoreChange);
  }
  return getUserCreditScore(borrow.userId);
}

export function handleDamageCreditUpdate(borrowId: number, severity: DamageSeverity): number {
  const borrow = db.prepare('SELECT userId FROM borrows WHERE id = ?').get(borrowId) as { userId: number | null } | undefined;
  if (!borrow?.userId) return 0;

  const scoreChange = calculateDamagePenalty(severity);
  if (scoreChange !== 0) {
    return updateUserCreditScore(borrow.userId, scoreChange);
  }
  return getUserCreditScore(borrow.userId);
}

export function getUserCreditInfo(userId: number) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) return null;

  const currentBorrows = db.prepare(`
    SELECT * FROM borrows 
    WHERE userId = ? AND status IN ('pending', 'borrowing', 'overdue')
  `).all(userId) as Borrow[];

  return getCreditInfo(user.creditScore, currentBorrows);
}

export function checkBorrowEligibility(userId: number): {
  canBorrow: boolean;
  reason?: string;
  maxBorrows: number;
  currentBorrows: number;
  creditScore: number;
} {
  const creditInfo = getUserCreditInfo(userId);
  if (!creditInfo) {
    return {
      canBorrow: false,
      reason: '用户不存在',
      maxBorrows: 0,
      currentBorrows: 0,
      creditScore: 0,
    };
  }

  return {
    canBorrow: creditInfo.canBorrow,
    reason: creditInfo.reason,
    maxBorrows: creditInfo.maxBorrows,
    currentBorrows: creditInfo.currentBorrows,
    creditScore: creditInfo.score,
  };
}

export function checkApproveEligibility(userId: number, borrowId: number): {
  canApprove: boolean;
  reason?: string;
  maxBorrows: number;
  occupiedAfterApprove: number;
  creditScore: number;
} {
  const user = db.prepare('SELECT creditScore FROM users WHERE id = ?').get(userId) as { creditScore: number } | undefined;
  if (!user) {
    return {
      canApprove: false,
      reason: '用户不存在',
      maxBorrows: 0,
      occupiedAfterApprove: 0,
      creditScore: 0,
    };
  }

  const { creditScore } = user;
  const maxBorrows = getMaxBorrows(creditScore);

  if (creditScore < CREDIT_CONFIG.minBorrowScore) {
    return {
      canApprove: false,
      reason: `信用分不足${CREDIT_CONFIG.minBorrowScore}分，无法借用工具`,
      maxBorrows,
      occupiedAfterApprove: 0,
      creditScore,
    };
  }

  const otherActiveCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM borrows
    WHERE userId = ?
      AND id != ?
      AND status IN ('pending', 'borrowing', 'overdue')
  `).get(userId, borrowId) as { count: number };

  const occupiedAfterApprove = otherActiveCount.count + 1;

  if (occupiedAfterApprove > maxBorrows) {
    return {
      canApprove: false,
      reason: `批准后借用数量（${occupiedAfterApprove}件）将超过信用分允许的上限（${maxBorrows}件）`,
      maxBorrows,
      occupiedAfterApprove,
      creditScore,
    };
  }

  return {
    canApprove: true,
    maxBorrows,
    occupiedAfterApprove,
    creditScore,
  };
}
