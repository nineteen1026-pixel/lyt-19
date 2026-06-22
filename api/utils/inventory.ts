import db from '../db/database.js';

export function getLockedCount(toolId: number): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM waitlist
    WHERE toolId = ? AND status = 'notified'
  `).get(toolId) as { count: number };
  return result.count;
}

export function getAvailableStock(toolId: number): number {
  const tool = db.prepare('SELECT stock FROM tools WHERE id = ?').get(toolId) as { stock: number } | undefined;
  if (!tool) return 0;
  const locked = getLockedCount(toolId);
  return Math.max(0, tool.stock - locked);
}

export function checkAvailableStock(toolId: number, needed: number = 1): { available: boolean; actualStock: number; availableStock: number; lockedCount: number } {
  const tool = db.prepare('SELECT stock FROM tools WHERE id = ?').get(toolId) as { stock: number } | undefined;
  if (!tool) return { available: false, actualStock: 0, availableStock: 0, lockedCount: 0 };
  const lockedCount = getLockedCount(toolId);
  const availableStock = Math.max(0, tool.stock - lockedCount);
  return {
    available: availableStock >= needed,
    actualStock: tool.stock,
    availableStock,
    lockedCount,
  };
}

export function lockStockForWaitlist(toolId: number): boolean {
  const { available } = checkAvailableStock(toolId, 1);
  if (!available) return false;
  db.prepare('UPDATE tools SET stock = stock - 1 WHERE id = ?').run(toolId);
  return true;
}

export function releaseLockedStock(toolId: number): void {
  db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(toolId);
}
