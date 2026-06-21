import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Borrow, Tool } from '../../shared/types.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM borrows';
    const params: unknown[] = [];

    if (status && status !== 'all') {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt DESC';

    const borrows = db.prepare(sql).all(...params) as Borrow[];
    res.json({ success: true, data: borrows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    res.json({ success: true, data: borrow });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { toolId, borrowerName, borrowerRoom, borrowerPhone, borrowDate, expectedReturnDate } = req.body;
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId) as Tool | undefined;
    if (!tool) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }
    if (tool.stock <= 0) {
      res.status(400).json({ success: false, error: '工具库存不足' });
      return;
    }

    const start = new Date(borrowDate);
    const end = new Date(expectedReturnDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const totalRent = days * tool.dailyRent;

    const info = db.prepare(`
      INSERT INTO borrows (toolId, toolName, borrowerName, borrowerRoom, borrowerPhone, borrowDate, expectedReturnDate, status, totalRent)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(toolId, tool.name, borrowerName, borrowerRoom, borrowerPhone, borrowDate, expectedReturnDate, totalRent);

    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(info.lastInsertRowid) as Borrow;
    res.json({ success: true, data: borrow, message: '借用申请已提交' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { status, actualReturnDate } = req.body;
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }

    const newStatus = status ?? borrow.status;

    if (newStatus === 'approved' && borrow.status === 'pending') {
      const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(borrow.toolId) as Tool | undefined;
      if (tool && tool.stock > 0) {
        db.prepare('UPDATE tools SET stock = stock - 1 WHERE id = ?').run(borrow.toolId);
      }
    }

    if (newStatus === 'returned' && borrow.status === 'borrowing') {
      db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(borrow.toolId);
      db.prepare('UPDATE deposits SET status = ? WHERE borrowId = ? AND type = ?').run('completed', borrow.id, 'refund');
    }

    db.prepare(`
      UPDATE borrows SET status = ?, actualReturnDate = COALESCE(?, actualReturnDate)
      WHERE id = ?
    `).run(newStatus, actualReturnDate || null, req.params.id);

    const updated = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow;
    res.json({ success: true, data: updated, message: '状态已更新' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
