import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Deposit } from '../../shared/types.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const deposits = db.prepare('SELECT * FROM deposits ORDER BY createdAt DESC').all() as Deposit[];
    res.json({ success: true, data: deposits });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { borrowId, amount, type, remark } = req.body;
    const info = db.prepare(`
      INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark)
      VALUES (?, ?, ?, 'pending', 0, ?)
    `).run(borrowId, amount, type, remark || '');

    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(info.lastInsertRowid) as Deposit;
    res.json({ success: true, data: deposit, message: '押金记录已创建' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { status, deductedAmount, remark } = req.body;
    const existing = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id) as Deposit | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '押金记录不存在' });
      return;
    }
    db.prepare(`
      UPDATE deposits SET status = ?, deductedAmount = ?, remark = ?
      WHERE id = ?
    `).run(
      status ?? existing.status,
      deductedAmount ?? existing.deductedAmount,
      remark ?? existing.remark,
      req.params.id
    );

    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.id) as Deposit;
    res.json({ success: true, data: deposit, message: '押金已更新' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
