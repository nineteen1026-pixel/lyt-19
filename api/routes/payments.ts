import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Deposit, Borrow, Tool } from '../../shared/types.js';

const router = Router();

function genTransactionId(prefix: string) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}${date}${random}`;
}

function processDepositNotifyInternal(outTradeNo: string, transactionId: string, payResult: string, payChannel: string) {
  const deposit = db.prepare('SELECT * FROM deposits WHERE outTradeNo = ?').get(outTradeNo) as Deposit | undefined;
  if (!deposit) {
    return { success: false, status: 404, error: '押金记录不存在' };
  }
  if (deposit.status !== 'pending') {
    return { success: true, status: 200, data: deposit, message: '该订单已处理，无需重复通知' };
  }
  if (payResult !== 'success') {
    return { success: false, status: 200, error: '支付失败，状态未变更' };
  }
  const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(deposit.borrowId) as Borrow | undefined;
  if (!borrow) {
    return { success: false, status: 404, error: '借用记录不存在' };
  }
  const payTransactionId = transactionId || genTransactionId('TX');
  const processPayment = db.transaction(() => {
    db.prepare(`
      UPDATE deposits SET status = 'completed', transactionId = ?, payChannel = ?, payTime = datetime('now', 'localtime')
      WHERE id = ?
    `).run(payTransactionId, payChannel, deposit.id);
    db.prepare('UPDATE tools SET stock = stock - 1 WHERE id = ?').run(borrow.toolId);
    db.prepare(`UPDATE borrows SET status = 'borrowing' WHERE id = ?`).run(borrow.id);
  });
  processPayment();
  const updatedDeposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(deposit.id) as Deposit;
  const updatedBorrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrow.id) as Borrow;
  return {
    success: true,
    status: 200,
    data: { deposit: updatedDeposit, borrow: updatedBorrow },
    message: '支付成功，工具已自动出库',
  };
}

function processRefundNotifyInternal(refundTransactionId: string, refundResult: string) {
  const deposit = db.prepare('SELECT * FROM deposits WHERE refundTransactionId = ?').get(refundTransactionId) as Deposit | undefined;
  if (!deposit) {
    return { success: false, status: 404, error: '退款记录不存在' };
  }
  if (deposit.status !== 'refunding') {
    return { success: true, status: 200, data: deposit, message: '该退款已处理，无需重复通知' };
  }
  if (refundResult !== 'success') {
    db.prepare(`UPDATE deposits SET status = 'refund_failed', remark = ? WHERE id = ?`)
      .run(`${deposit.remark || ''}（退款失败，请联系管理员）`.trim(), deposit.id);
    const failed = db.prepare('SELECT * FROM deposits WHERE id = ?').get(deposit.id) as Deposit;
    return { success: false, status: 200, error: '原路退款失败，请联系管理员处理', data: failed };
  }
  db.prepare(`UPDATE deposits SET status = 'completed', refundTime = datetime('now', 'localtime') WHERE id = ?`)
    .run(deposit.id);
  const updated = db.prepare('SELECT * FROM deposits WHERE id = ?').get(deposit.id) as Deposit;
  return { success: true, status: 200, data: updated, message: '原路退款成功' };
}

router.post('/deposit/create', (req: Request, res: Response) => {
  try {
    const { borrowId, payChannel = 'wechat' } = req.body;
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrowId) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    if (borrow.status !== 'approved') {
      res.status(400).json({ success: false, error: '该借用单当前状态不支持支付' });
      return;
    }
    let deposit = db.prepare('SELECT * FROM deposits WHERE borrowId = ? AND type = ? AND status = ? ORDER BY id DESC LIMIT 1')
      .get(borrowId, 'collect', 'pending') as Deposit | undefined;
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(borrow.toolId) as Tool | undefined;
    const depositAmount = tool?.depositAmount || 0;
    if (!deposit) {
      const outTradeNo = `DEP${borrowId}${Date.now()}`;
      const info = db.prepare(`
        INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark, outTradeNo, payChannel)
        VALUES (?, ?, 'collect', 'pending', 0, ?, ?, ?)
      `).run(borrowId, depositAmount, `${tool?.name || '工具'} 借用押金（待支付）`, outTradeNo, payChannel);
      deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(info.lastInsertRowid) as Deposit;
    } else if (!deposit.outTradeNo) {
      const outTradeNo = `DEP${borrowId}${Date.now()}`;
      db.prepare('UPDATE deposits SET outTradeNo = ?, payChannel = ?, remark = ? WHERE id = ?')
        .run(outTradeNo, payChannel, `${tool?.name || '工具'} 借用押金（待支付）`, deposit.id);
      deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(deposit.id) as Deposit;
    }
    res.json({
      success: true,
      data: {
        deposit,
        payInfo: {
          outTradeNo: deposit.outTradeNo,
          amount: deposit.amount,
          payChannel,
          description: `${tool?.name || '工具'}借用押金`,
          qrCodeUrl: `mock://pay/qrcode?outTradeNo=${deposit.outTradeNo}&amount=${deposit.amount}`,
          expireSeconds: 900,
        },
      },
      message: '支付订单已创建，请在15分钟内完成支付',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/deposit/notify', (req: Request, res: Response) => {
  try {
    const { outTradeNo, transactionId, payResult = 'success', payChannel = 'wechat' } = req.body;
    const result = processDepositNotifyInternal(outTradeNo, transactionId, payResult, payChannel);
    res.status(result.status).json({
      success: result.success,
      data: (result as any).data,
      error: (result as any).error,
      message: (result as any).message,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/deposit/mock-pay', (req: Request, res: Response) => {
  try {
    const { depositId, payChannel = 'wechat', simulateFail = false } = req.body;
    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(depositId) as Deposit | undefined;
    if (!deposit) {
      res.status(404).json({ success: false, error: '押金记录不存在' });
      return;
    }
    if (deposit.type !== 'collect') {
      res.status(400).json({ success: false, error: '只能对收取类型的押金进行支付' });
      return;
    }
    if (deposit.status !== 'pending') {
      res.status(400).json({ success: false, error: `当前押金状态为「${deposit.status}」，无法进行支付` });
      return;
    }
    if (simulateFail) {
      res.json({
        success: false,
        error: '模拟支付失败：余额不足或网络超时',
        data: { deposit, simulateResult: 'fail' },
      });
      return;
    }
    const result = processDepositNotifyInternal(
      deposit.outTradeNo || `DEP${deposit.borrowId}${Date.now()}`,
      genTransactionId('TX'),
      'success',
      payChannel,
    );
    res.status(result.status).json({
      success: result.success,
      data: (result as any).data,
      error: (result as any).error,
      message: (result as any).message,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/deposit/status/:depositId', (req: Request, res: Response) => {
  try {
    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(req.params.depositId) as Deposit | undefined;
    if (!deposit) {
      res.status(404).json({ success: false, error: '押金记录不存在' });
      return;
    }
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(deposit.borrowId) as Borrow | undefined;
    res.json({
      success: true,
      data: {
        deposit,
        borrowStatus: borrow?.status,
        isPayCompleted: deposit.status === 'completed',
        isBorrowActivated: borrow?.status === 'borrowing',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/refund/create', (req: Request, res: Response) => {
  try {
    const { borrowId, refundAmount, deductedAmount = 0, remark = '' } = req.body;
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(borrowId) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    const collectDeposit = db.prepare('SELECT * FROM deposits WHERE borrowId = ? AND type = ? ORDER BY id DESC LIMIT 1')
      .get(borrowId, 'collect') as Deposit | undefined;
    if (!collectDeposit) {
      res.status(400).json({ success: false, error: '未找到对应的收取押金记录，无法退款' });
      return;
    }
    const refundTransactionId = genTransactionId('RF');
    const actualRefundAmount = refundAmount !== undefined ? Number(refundAmount) : collectDeposit.amount - deductedAmount;
    const info = db.prepare(`
      INSERT INTO deposits (borrowId, amount, type, status, deductedAmount, remark, payChannel, transactionId, refundTransactionId, refundTime)
      VALUES (?, ?, 'refund', 'refunding', ?, ?, ?, ?, ?, NULL)
    `).run(
      borrowId,
      actualRefundAmount,
      deductedAmount,
      remark || '退还借用押金（原路退款中）',
      collectDeposit.payChannel || 'wechat',
      collectDeposit.transactionId || '',
      refundTransactionId,
    );
    const refundDeposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(info.lastInsertRowid) as Deposit;
    res.json({
      success: true,
      data: {
        refundDeposit,
        refundInfo: {
          refundTransactionId,
          amount: actualRefundAmount,
          deductedAmount,
          originalTransactionId: collectDeposit.transactionId,
          payChannel: collectDeposit.payChannel || 'wechat',
          expectedArriveTime: '1-3个工作日',
        },
      },
      message: '退款申请已提交，正在处理原路退款',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/refund/notify', (req: Request, res: Response) => {
  try {
    const { refundTransactionId, refundResult = 'success' } = req.body;
    const result = processRefundNotifyInternal(refundTransactionId, refundResult);
    res.status(result.status).json({
      success: result.success,
      data: (result as any).data,
      error: (result as any).error,
      message: (result as any).message,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/refund/mock-process', (req: Request, res: Response) => {
  try {
    const { refundDepositId, simulateFail = false } = req.body;
    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(refundDepositId) as Deposit | undefined;
    if (!deposit) {
      res.status(404).json({ success: false, error: '退款记录不存在' });
      return;
    }
    if (deposit.type !== 'refund') {
      res.status(400).json({ success: false, error: '只能对退还类型的押金进行退款处理' });
      return;
    }
    if (deposit.status !== 'refunding') {
      res.status(400).json({ success: false, error: `当前押金状态为「${deposit.status}」，无需处理退款` });
      return;
    }
    const result = processRefundNotifyInternal(
      deposit.refundTransactionId || '',
      simulateFail ? 'fail' : 'success',
    );
    res.status(result.status).json({
      success: result.success,
      data: (result as any).data,
      error: (result as any).error,
      message: (result as any).message,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/borrow/:borrowId/deposit-info', (req: Request, res: Response) => {
  try {
    const borrow = db.prepare('SELECT * FROM borrows WHERE id = ?').get(req.params.borrowId) as Borrow | undefined;
    if (!borrow) {
      res.status(404).json({ success: false, error: '借用记录不存在' });
      return;
    }
    const deposits = db.prepare('SELECT * FROM deposits WHERE borrowId = ? ORDER BY id ASC').all(req.params.borrowId) as Deposit[];
    const collectDeposit = deposits.find(d => d.type === 'collect');
    const refundDeposits = deposits.filter(d => d.type === 'refund');
    const totalRefunded = refundDeposits.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount, 0);
    const totalDeducted = deposits.reduce((s, d) => s + (d.deductedAmount || 0), 0);
    res.json({
      success: true,
      data: {
        borrow,
        collectDeposit,
        refundDeposits,
        summary: {
          shouldCollect: collectDeposit?.amount || 0,
          collected: collectDeposit?.status === 'completed' ? collectDeposit.amount : 0,
          totalDeducted,
          totalRefunded,
          pendingRefund: refundDeposits.find(d => d.status === 'refunding')?.amount || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
