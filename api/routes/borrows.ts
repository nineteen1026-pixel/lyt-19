import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Borrow, Tool, Deposit, Damage, Waitlist } from '../../shared/types.js';
import { authMiddleware, getCurrentUserId } from './auth.js';
import { checkBorrowEligibility, handleReturnCreditUpdate, checkApproveEligibility } from '../utils/credit.js';
import { calculateReturnScoreChange } from '../../shared/credit.js';
import { notifyAllAvailableInQueue } from './waitlist.js';
import { checkAvailableStock } from '../utils/inventory.js';

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
    const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(userId) as { phone: string } | undefined;

    if (user) {
      db.prepare(`
        UPDATE borrows
        SET userId = ?
        WHERE borrowerPhone = ? AND userId IS NULL
      `).run(userId, user.phone);
    }

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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { name: string; room: string; phone: string; creditScore: number } | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
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

    const { toolId, borrowDate, expectedReturnDate } = req.body;
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId) as Tool | undefined;
    if (!tool) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }

    const stockInfo = checkAvailableStock(toolId, 1);
    if (!stockInfo.available) {
      if (stockInfo.lockedCount > 0) {
        res.status(400).json({
          success: false,
          error: `当前有 ${stockInfo.lockedCount} 件已被排队用户锁定预留，请稍后再试或加入排队`,
          data: stockInfo,
        });
      } else {
        res.status(400).json({
          success: false,
          error: '工具库存不足，您可以加入预约排队，归还后按顺序通知',
          data: stockInfo,
        });
      }
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
    res.json({
      success: true,
      data: borrow,
      message: '借用申请已提交',
      creditInfo: eligibility,
    });
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

    if (borrow.userId) {
      const eligibility = checkApproveEligibility(borrow.userId, borrow.id);
      if (!eligibility.canApprove) {
        db.prepare('UPDATE borrows SET status = ? WHERE id = ?').run('rejected', borrow.id);
        res.status(400).json({
          success: false,
          error: `借用资格校验未通过：${eligibility.reason || '无法借用'}，申请已自动拒绝`,
          data: { eligibility },
        });
        return;
      }
    }

    const stockInfo = checkAvailableStock(borrow.toolId, 1);
    if (!stockInfo.available) {
      if (stockInfo.lockedCount > 0) {
        res.status(400).json({
          success: false,
          error: `该工具当前有 ${stockInfo.lockedCount} 件已被排队用户预留，请稍后再批准`,
          data: stockInfo,
        });
      } else {
        res.status(400).json({
          success: false,
          error: '工具库存不足',
          data: stockInfo,
        });
      }
      return;
    }

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(borrow.toolId) as Tool | undefined;
    if (!tool) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }

    const outTradeNo = `DEP${borrow.id}${Date.now()}`;

    const updateBorrow = db.transaction(() => {
      db.prepare(`
        UPDATE borrows SET status = 'approved' WHERE id = ?
      `).run(borrow.id);
      db.prepare(`
        INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark, outTradeNo)
        VALUES (?, ?, 'collect', 'pending', 0, ?, ?)
      `).run(borrow.id, tool.depositAmount, `${tool.name} 借用押金（待支付）`, outTradeNo);
    });
    updateBorrow();

    const updated = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrow.id) as Borrow;
    const pendingDeposit = db.prepare('SELECT * FROM deposits WHERE borrowId = ? AND type = ? AND status = ? ORDER BY id DESC LIMIT 1')
      .get(borrow.id, 'collect', 'pending') as Deposit | undefined;

    res.json({
      success: true,
      data: updated,
      message: '已批准借用，请完成押金支付后自动出库',
      deposit: pendingDeposit,
    });
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

    const collectDeposit = db.prepare('SELECT * FROM deposits WHERE borrowId = ? AND type = ? ORDER BY id DESC LIMIT 1').get(borrow.id, 'collect') as Deposit | undefined;
    const depositAmount = collectDeposit ? collectDeposit.amount : (tool?.depositAmount || 0);
    const refundAmount = Math.max(0, depositAmount - totalDamageCompensation);

    const refundRemark = totalDamageCompensation > 0
      ? `退还押金，扣除损耗赔偿 ${totalDamageCompensation} 元（原路退款中）`
      : '全额退还押金（原路退款中）';

    const refundTransactionId = (() => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const random = Math.random().toString(36).slice(2, 10).toUpperCase();
      return `RF${date}${random}`;
    })();

    let refundDepositId: number | undefined;

    const returnBorrow = db.transaction(() => {
      db.prepare('UPDATE tools SET stock = stock + 1 WHERE id = ?').run(borrow.toolId);
      db.prepare(`
        UPDATE borrows SET status = 'returned', actualReturnDate = date('now', 'localtime') WHERE id = ?
      `).run(borrow.id);

      const info = db.prepare(`
        INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark, payChannel, transactionId, refundTransactionId, refundTime)
        VALUES (?, ?, 'refund', 'refunding', ?, ?, ?, ?, ?, NULL)
      `).run(
        borrow.id,
        refundAmount,
        totalDamageCompensation,
        refundRemark,
        collectDeposit?.payChannel || 'wechat',
        collectDeposit?.transactionId || '',
        refundTransactionId,
      );
      refundDepositId = Number(info.lastInsertRowid);
    });
    returnBorrow();

    let refundSuccess = false;
    let refundMessage = '';
    try {
      const result = db.transaction(() => {
        const refundDep = db.prepare('SELECT * FROM deposits WHERE id = ?').get(refundDepositId) as Deposit | undefined;
        if (refundDep && refundDep.status === 'refunding' && refundDep.refundTransactionId) {
          db.prepare(`UPDATE deposits SET status = 'completed', refundTime = datetime('now', 'localtime') WHERE id = ?`)
            .run(refundDep.id);
          return true;
        }
        return false;
      })();
      refundSuccess = result;
      refundMessage = refundSuccess
        ? `原路退款 ¥${refundAmount.toFixed(2)} 已成功到账（${collectDeposit?.payChannel === 'alipay' ? '支付宝' : collectDeposit?.payChannel === 'balance' ? '余额' : '微信'}原路退回）`
        : '';
    } catch {
      refundMessage = '原路退款处理中，预计 1-3 个工作日内到账';
    }

    const updatedBorrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrow.id) as Borrow;

    let newCreditScore: number | undefined;
    let creditScoreChange: number | undefined;
    if (updatedBorrow.userId && updatedBorrow.actualReturnDate) {
      creditScoreChange = calculateReturnScoreChange(
        updatedBorrow.expectedReturnDate,
        updatedBorrow.actualReturnDate
      );
      newCreditScore = handleReturnCreditUpdate(updatedBorrow);
    }

    const finalRefundDeposit = refundDepositId
      ? (db.prepare('SELECT * FROM deposits WHERE id = ?').get(refundDepositId) as Deposit | undefined)
      : undefined;

    let message = '工具已归还';
    if (refundMessage) {
      message += `，${refundMessage}`;
    } else if (refundAmount > 0) {
      message += `，押金原路退款 ¥${refundAmount.toFixed(2)} 处理中`;
    }
    if (creditScoreChange !== undefined && creditScoreChange !== 0) {
      if (creditScoreChange > 0) {
        message += `，按时归还信用分 +${creditScoreChange}，当前信用分：${newCreditScore}`;
      } else {
        message += `，逾期归还信用分 ${creditScoreChange}，当前信用分：${newCreditScore}`;
      }
    } else if (newCreditScore !== undefined) {
      message += `，当前信用分：${newCreditScore}`;
    }

    const notifiedWaitlists = notifyAllAvailableInQueue(borrow.toolId);

    let waitlistInfo: { notified: Waitlist[]; count: number } | undefined;
    if (notifiedWaitlists.length > 0) {
      const names = notifiedWaitlists.map(n => n.userName).join('、');
      message += `，已通知 ${notifiedWaitlists.length} 位排队用户：${names}，请在24小时内取件`;
      waitlistInfo = { notified: notifiedWaitlists, count: notifiedWaitlists.length };
    } else {
      const waitingCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM waitlist
        WHERE toolId = ? AND status = 'waiting'
      `).get(borrow.toolId) as { count: number };
      if (waitingCount.count > 0) {
        message += `，暂无可用库存分配给 ${waitingCount.count} 位排队用户`;
      }
    }

    res.json({
      success: true,
      data: updatedBorrow,
      message,
      creditInfo: newCreditScore !== undefined ? { newScore: newCreditScore, change: creditScoreChange } : undefined,
      waitlistInfo,
      refundInfo: finalRefundDeposit ? {
        deposit: finalRefundDeposit,
        refundAmount,
        deductedAmount: totalDamageCompensation,
        originalTransactionId: collectDeposit?.transactionId,
        payChannel: collectDeposit?.payChannel || 'wechat',
        refundTransactionId: finalRefundDeposit.refundTransactionId,
        refundSuccess,
      } : undefined,
    });
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
