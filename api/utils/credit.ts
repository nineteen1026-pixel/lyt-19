import db from '../db/database.js';
import type { User, Borrow, DamageSeverity } from '../../shared/types.js';
import {
  calculateReturnScoreChange,
  calculateDamagePenalty,
  updateCreditScore,
  getCreditInfo,
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
    WHERE userId = ? AND status IN ('borrowing', 'overdue')
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
