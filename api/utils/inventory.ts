import db from '../db/database.js';

export function getLockedCount(toolId: number): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM waitlist
    WHERE toolId = ? AND status = 'notified'
  `).get(toolId) as { count: number };
  return result.count;
}

export function getBorrowedCount(toolId: number): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM borrows
    WHERE toolId = ? AND status IN ('borrowing', 'overdue')
  `).get(toolId) as { count: number };
  return result.count;
}

export function getAvailableStock(toolId: number): number {
  const tool = db.prepare('SELECT stock FROM tools WHERE id = ?').get(toolId) as { stock: number } | undefined;
  if (!tool) return 0;
  return Math.max(0, tool.stock);
}

export function checkAvailableStock(toolId: number, needed: number = 1): {
  available: boolean;
  totalStock: number;
  availableStock: number;
  borrowedCount: number;
  lockedCount: number;
} {
  const tool = db.prepare('SELECT stock, totalStock FROM tools WHERE id = ?').get(toolId) as { stock: number; totalStock?: number } | undefined;
  if (!tool) {
    return {
      available: false,
      totalStock: 0,
      availableStock: 0,
      borrowedCount: 0,
      lockedCount: 0,
    };
  }

  const lockedCount = getLockedCount(toolId);
  const borrowedCount = getBorrowedCount(toolId);
  const availableStock = Math.max(0, tool.stock);

  return {
    available: availableStock >= needed,
    totalStock: tool.totalStock ?? (availableStock + borrowedCount + lockedCount),
    availableStock,
    borrowedCount,
    lockedCount,
  };
}

export function getWaitingCount(toolId: number): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM waitlist
    WHERE toolId = ? AND status = 'waiting'
  `).get(toolId) as { count: number };
  return result.count;
}

export function lockOneStock(toolId: number): boolean {
  const stockInfo = checkAvailableStock(toolId, 1);
  if (!stockInfo.available) return false;

  db.prepare('UPDATE tools SET stock = stock - 1 WHERE id = ?').run(toolId);
  return true;
}

export function releaseOneStock(toolId: number): void {
  db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(toolId);
}
