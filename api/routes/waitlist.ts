import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Waitlist, Tool } from '../../shared/types.js';
import { authMiddleware, getCurrentUserId } from './auth.js';
import { checkBorrowEligibility } from '../utils/credit.js';
import { getAvailableStock, checkAvailableStock } from '../utils/inventory.js';
import type { Borrow } from '../../shared/types.js';

const router = Router();

function calculateQueuePosition(toolId: number, waitlistId: number): number {
  const result = db.prepare(`
    SELECT COUNT(*) as position
    FROM waitlist
    WHERE toolId = ? AND status = 'waiting' AND createdAt <= (SELECT createdAt FROM waitlist WHERE id = ?)
  `).get(toolId, waitlistId) as { position: number };
  return result.position;
}

function updateQueuePositions(toolId: number): void {
  const waitingItems = db.prepare(`
    SELECT id, createdAt
    FROM waitlist
    WHERE toolId = ? AND status = 'waiting'
    ORDER BY createdAt ASC
  `).all(toolId) as { id: number; createdAt: string }[];

  const updateStmt = db.prepare('UPDATE waitlist SET queuePosition = ? WHERE id = ?');
  waitingItems.forEach((item, index) => {
    updateStmt.run(index + 1, item.id);
  });
}

function processExpiredNotifications(toolId?: number): void {
  const now = new Date().toISOString();
  let sql = `
    SELECT * FROM waitlist
    WHERE status = 'notified' AND pickupExpiresAt < ?
  `;
  const params: unknown[] = [now];
  if (toolId !== undefined) {
    sql += ' AND toolId = ?';
    params.push(toolId);
  }
  const expiredItems = db.prepare(sql).all(...params) as Waitlist[];

  if (expiredItems.length === 0) return;

  const updateStatus = db.prepare(`
    UPDATE waitlist SET status = 'expired' WHERE id = ?
  `);
  const releaseStock = db.prepare(`
    UPDATE tools SET stock = stock + 1 WHERE id = ?
  `);

  expiredItems.forEach(item => {
    updateStatus.run(item.id);
    releaseStock.run(item.toolId);
    console.log(`[排队过期] 用户 ${item.userName} 未在取件时段内确认，已释放工具 ${item.toolName} 的锁定库存`);
  });
}

export function notifyNextInQueue(toolId: number): Waitlist | null {
  processExpiredNotifications(toolId);

  const nextItem = db.prepare(`
    SELECT * FROM waitlist
    WHERE toolId = ? AND status = 'waiting'
    ORDER BY createdAt ASC
    LIMIT 1
  `).get(toolId) as Waitlist | undefined;

  if (!nextItem) return null;

  const stockInfo = checkAvailableStock(toolId, 1);
  if (!stockInfo.available) {
    console.log(`[排队警告] 准备通知用户 ${nextItem.userName}，但工具 ${nextItem.toolName} 实际可用库存不足`);
    return null;
  }

  const pickupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const notifiedAt = new Date().toISOString();

  const processNotify = db.transaction(() => {
    db.prepare(`
      UPDATE tools SET stock = stock - 1 WHERE id = ?
    `).run(toolId);

    db.prepare(`
      UPDATE waitlist
      SET status = 'notified', notifiedAt = ?, pickupExpiresAt = ?
      WHERE id = ?
    `).run(notifiedAt, pickupExpiresAt, nextItem.id);
  });
  processNotify();

  console.log(`[排队通知] 工具 ${nextItem.toolName} 已归还并锁定库存，通知排队用户 ${nextItem.userName} (${nextItem.userPhone})，取件截止 ${new Date(pickupExpiresAt).toLocaleString('zh-CN')}`);

  updateQueuePositions(toolId);

  return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(nextItem.id) as Waitlist;
}

function releaseAndNotifyNext(toolId: number): Waitlist | null {
  return notifyNextInQueue(toolId);
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { toolId, status } = req.query;
    let sql = 'SELECT * FROM waitlist WHERE 1=1';
    const params: unknown[] = [];

    if (toolId) {
      sql += ' AND toolId = ?';
      params.push(Number(toolId));
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt ASC';

    const waitlist = db.prepare(sql).all(...params) as Waitlist[];
    res.json({ success: true, data: waitlist });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/mine', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const { status } = req.query;
    let sql = 'SELECT * FROM waitlist WHERE userId = ?';
    const params: unknown[] = [userId];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt DESC';

    const waitlist = db.prepare(sql).all(...params) as Waitlist[];
    res.json({ success: true, data: waitlist });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/tool/:toolId/count', (req: Request, res: Response) => {
  try {
    const toolId = Number(req.params.toolId);
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM waitlist
      WHERE toolId = ? AND status IN ('waiting', 'notified')
    `).get(toolId) as { count: number };

    const userPosition = db.prepare(`
      SELECT queuePosition
      FROM waitlist
      WHERE toolId = ? AND status = 'waiting'
      ORDER BY createdAt ASC
      LIMIT 1
    `).get(toolId) as { queuePosition: number | null } | undefined;

    const available = getAvailableStock(toolId);

    res.json({
      success: true,
      data: {
        count: result.count,
        firstPosition: userPosition?.queuePosition || null,
        availableStock: available,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const waitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(req.params.id) as Waitlist | undefined;
    if (!waitlist) {
      res.status(404).json({ success: false, error: '排队记录不存在' });
      return;
    }
    res.json({ success: true, data: waitlist });
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { name: string; room: string; phone: string; creditScore: number } | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const eligibility = checkBorrowEligibility(userId);
    if (!eligibility.canBorrow) {
      res.status(400).json({
        success: false,
        error: eligibility.reason || '无法加入排队',
        data: eligibility,
      });
      return;
    }

    const { toolId, expectedBorrowDate, expectedReturnDate } = req.body;
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId) as Tool | undefined;
    if (!tool) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }

    const available = getAvailableStock(toolId);
    if (available > 0) {
      res.status(400).json({ success: false, error: `工具当前有 ${available} 件可用，请直接申请借用` });
      return;
    }

    const existingWaitlist = db.prepare(`
      SELECT * FROM waitlist
      WHERE toolId = ? AND userId = ? AND status IN ('waiting', 'notified')
    `).get(toolId, userId) as Waitlist | undefined;

    if (existingWaitlist) {
      res.status(400).json({ success: false, error: '您已在该工具的排队列表中' });
      return;
    }

    const info = db.prepare(`
      INSERT INTO waitlist (toolId, toolName, userId, userName, userRoom, userPhone, expectedBorrowDate, expectedReturnDate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting')
    `).run(toolId, tool.name, userId, user.name, user.room, user.phone, expectedBorrowDate, expectedReturnDate);

    const queuePosition = calculateQueuePosition(toolId, Number(info.lastInsertRowid));
    db.prepare('UPDATE waitlist SET queuePosition = ? WHERE id = ?').run(queuePosition, info.lastInsertRowid);

    const waitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(info.lastInsertRowid) as Waitlist;
    res.json({
      success: true,
      data: waitlist,
      message: `已成功加入排队，当前第 ${queuePosition} 位，工具归还后将按顺序通知`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id/cancel', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const waitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(req.params.id) as Waitlist | undefined;

    if (!waitlist) {
      res.status(404).json({ success: false, error: '排队记录不存在' });
      return;
    }

    if (waitlist.userId !== userId) {
      res.status(403).json({ success: false, error: '无权取消他人的排队' });
      return;
    }

    if (waitlist.status !== 'waiting' && waitlist.status !== 'notified') {
      res.status(400).json({ success: false, error: '该排队记录无法取消' });
      return;
    }

    const toolId = waitlist.toolId;
    const wasNotified = waitlist.status === 'notified';

    const processCancel = db.transaction(() => {
      db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run('cancelled', waitlist.id);

      if (wasNotified) {
        db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(toolId);
        console.log(`[排队取消] 用户 ${waitlist.userName} 放弃了工具 ${waitlist.toolName} 的取件资格，已释放锁定库存`);
      }
    });
    processCancel();

    updateQueuePositions(toolId);

    let nextNotified: Waitlist | null = null;
    let chainMessage = '';
    if (wasNotified) {
      nextNotified = releaseAndNotifyNext(toolId);
      if (nextNotified) {
        chainMessage = `，已自动通知下一位排队用户 ${nextNotified.userName}`;
      }
    }

    const updated = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlist.id) as Waitlist;
    res.json({
      success: true,
      data: updated,
      nextNotified,
      message: `已取消排队${chainMessage}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id/convert-to-borrow', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const waitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(req.params.id) as Waitlist | undefined;

    if (!waitlist) {
      res.status(404).json({ success: false, error: '排队记录不存在' });
      return;
    }

    if (waitlist.userId !== userId) {
      res.status(403).json({ success: false, error: '无权操作他人的排队' });
      return;
    }

    if (waitlist.status !== 'notified') {
      res.status(400).json({ success: false, error: '请等待工具归还并收到通知后再申请借用' });
      return;
    }

    if (waitlist.pickupExpiresAt && new Date(waitlist.pickupExpiresAt).getTime() < Date.now()) {
      db.transaction(() => {
        db.prepare('UPDATE waitlist SET status = ? WHERE id = ?').run('expired', waitlist.id);
        db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(waitlist.toolId);
      })();
      releaseAndNotifyNext(waitlist.toolId);
      res.status(400).json({ success: false, error: '取件时段已过期，资格已释放给下一位排队用户，请重新排队' });
      return;
    }

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(waitlist.toolId) as Tool | undefined;
    if (!tool) {
      res.status(400).json({ success: false, error: '工具不存在' });
      return;
    }

    const eligibility = checkBorrowEligibility(userId);
    if (!eligibility.canBorrow) {
      res.status(400).json({
        success: false,
        error: eligibility.reason || '无法借用',
        data: eligibility,
      });
      return;
    }

    const start = new Date(waitlist.expectedBorrowDate);
    const end = new Date(waitlist.expectedReturnDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
    const totalRent = days * tool.dailyRent;

    const convertToBorrow = db.transaction(() => {
      const borrowInfo = db.prepare(`
        INSERT INTO borrows (toolId, toolName, userId, borrowerName, borrowerRoom, borrowerPhone, borrowDate, expectedReturnDate, status, totalRent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        waitlist.toolId,
        waitlist.toolName,
        waitlist.userId,
        waitlist.userName,
        waitlist.userRoom,
        waitlist.userPhone,
        waitlist.expectedBorrowDate,
        waitlist.expectedReturnDate,
        totalRent,
      );

      db.prepare(`
        UPDATE waitlist
        SET status = 'borrowed', borrowId = ?
        WHERE id = ?
      `).run(borrowInfo.lastInsertRowid, waitlist.id);

      db.prepare(`
        INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark)
        VALUES (?, ?, 'collect', 'completed', 0, ?)
      `).run(borrowInfo.lastInsertRowid, tool.depositAmount, `${tool.name} 借用押金（排队取件，库存已锁定）`);

      db.prepare(`
        UPDATE borrows SET status = 'borrowing' WHERE id = ?
      `).run(borrowInfo.lastInsertRowid);

      return borrowInfo.lastInsertRowid;
    });

    const borrowId = convertToBorrow();
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrowId) as Borrow;
    const updatedWaitlist = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(waitlist.id) as Waitlist;

    console.log(`[排队取件] 用户 ${waitlist.userName} 已确认借用工具 ${waitlist.toolName}，库存已在通知时锁定，直接进入借用状态`);

    res.json({
      success: true,
      data: { borrow, waitlist: updatedWaitlist },
      message: '已确认取件，工具已为您保留，感谢使用共享工具！',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/notify-next/:toolId', (req: Request, res: Response) => {
  try {
    const toolId = Number(req.params.toolId);
    processExpiredNotifications(toolId);
    const notified = notifyNextInQueue(toolId);

    if (notified) {
      res.json({
        success: true,
        data: notified,
        message: `已通知用户 ${notified.userName}，请在24小时内取件（库存已锁定，独享借用资格）`,
      });
    } else {
      res.json({ success: true, message: '该工具暂无等待排队的用户' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
