import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Borrow, Tool, Deposit, Damage } from '../../shared/types.js';
import { authMiddleware, getCurrentUserId } from './auth.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, userId } = req.query;
    let sql = 'SELECT * FROM borrows';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (userId) {
      conditions.push('userId = ?');
      params.push(Number(userId));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY createdAt DESC';

    const borrows = db.prepare(sql).all(...params) as Borrow[];
    res.json({ success: true, data: borrows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/mine', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const { status } = req.query;
    let sql = 'SELECT * FROM borrows WHERE userId = ?';
    const params: unknown[] = [userId];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
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

router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: '未登录，请先登录' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { name: string; room: string; phone: string } | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const { toolId, borrowDate, expectedReturnDate } = req.body;
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
      INSERT INTO borrows (toolId, toolName, userId, borrowerName, borrowerRoom, borrowerPhone, borrowDate, expectedReturnDate, status, totalRent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(toolId, tool.name, userId, user.name, user.room, user.phone, borrowDate, expectedReturnDate, totalRent);

    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(info.lastInsertRowid) as Borrow;
    res.json({ success: true, data: borrow, message: '借用申请已提交' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id/approve', (req: Request, res: Response) => {
  try {
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    if (borrow.status !== 'pending') {
      res.status(400).json({ success: false, error: '只有待审批的申请才能批准' });
      return;
    }

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(borrow.toolId) as Tool | undefined;
    if (!tool || tool.stock <= 0) {
      res.status(400).json({ success: false, error: '工具库存不足' });
      return;
    }

    const updateBorrow = db.transaction(() => {
      db.prepare('UPDATE tools SET stock = stock - 1 WHERE id = ?').run(borrow.toolId);
      db.prepare(`
        UPDATE borrows SET status = 'borrowing' WHERE id = ?
      `).run(borrow.id);
      db.prepare(`
        INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark)
        VALUES (?, ?, 'collect', 'completed', 0, ?)
      `).run(borrow.id, tool.depositAmount, `${tool.name} 借用押金`);
    });
    updateBorrow();

    const updated = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrow.id) as Borrow;
    res.json({ success: true, data: updated, message: '已批准借出，押金已收取' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id/reject', (req: Request, res: Response) => {
  try {
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    if (borrow.status !== 'pending') {
      res.status(400).json({ success: false, error: '只有待审批的申请才能拒绝' });
      return;
    }

    db.prepare('UPDATE borrows SET status = ? WHERE id = ?').run('rejected', borrow.id);
    const updated = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrow.id) as Borrow;
    res.json({ success: true, data: updated, message: '已拒绝申请' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id/return', (req: Request, res: Response) => {
  try {
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    if (borrow.status !== 'borrowing' && borrow.status !== 'overdue') {
      res.status(400).json({ success: false, error: '只有借用中的工具才能归还' });
      return;
    }

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(borrow.toolId) as Tool | undefined;

    const damages = db.prepare('SELECT * FROM damages WHERE borrowId = ?').all(borrow.id) as Damage[];
    const totalDamageCompensation = damages.reduce((sum, d) => sum + d.compensationAmount, 0);

    const collectDeposit = db.prepare('SELECT * FROM deposits WHERE borrowId = ? AND type = ?').get(borrow.id, 'collect') as Deposit | undefined;
    const depositAmount = collectDeposit ? collectDeposit.amount : (tool?.depositAmount || 0);
    const refundAmount = Math.max(0, depositAmount - totalDamageCompensation);

    const returnBorrow = db.transaction(() => {
      db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(borrow.toolId);
      db.prepare(`
        UPDATE borrows SET status = 'returned', actualReturnDate = date('now', 'localtime') WHERE id = ?
      `).run(borrow.id);
      db.prepare(`
        INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark)
        VALUES (?, ?, 'refund', 'completed', ?, ?)
      `).run(borrow.id, refundAmount, totalDamageCompensation,
        totalDamageCompensation > 0
          ? `退还押金，扣除损耗赔偿 ${totalDamageCompensation} 元`
          : '全额退还押金');
    });
    returnBorrow();

    const updated = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrow.id) as Borrow;
    res.json({ success: true, data: updated, message: '工具已归还，押金已结算' });
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

    db.prepare(`
      UPDATE borrows SET status = COALESCE(?, status), actualReturnDate = COALESCE(?, actualReturnDate)
      WHERE id = ?
    `).run(status || null, actualReturnDate || null, req.params.id);

    const updated = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.id) as Borrow;
    res.json({ success: true, data: updated, message: '状态已更新' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
