import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { DashboardStats, Borrow, Deposit } from '../../shared/types.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const totalTools = (db.prepare('SELECT COUNT(*) as count FROM tools').get() as { count: number }).count;
    const borrowingCount = (db.prepare("SELECT COUNT(*) as count FROM borrows WHERE status IN ('approved','borrowing','overdue')").get() as { count: number }).count;
    const damageCount = (db.prepare('SELECT COUNT(*) as count FROM damages').get() as { count: number }).count;

    const deposits = db.prepare("SELECT * FROM deposits WHERE status = 'completed'").all() as Deposit[];
    let depositBalance = 0;
    for (const d of deposits) {
      if (d.type === 'collect') {
        depositBalance += d.amount - (d.deductedAmount || 0);
      } else {
        depositBalance -= d.amount;
      }
    }

    const recentBorrows = db.prepare('SELECT * FROM borrows ORDER BY createdAt DESC LIMIT 5').all() as Borrow[];

    const stats: DashboardStats = {
      totalTools,
      borrowingCount,
      depositBalance,
      damageCount,
      recentBorrows,
    };
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
