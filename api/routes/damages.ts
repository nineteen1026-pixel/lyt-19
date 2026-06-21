import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Damage, DamageSeverity } from '../../shared/types.js';
import { handleDamageCreditUpdate } from '../utils/credit.js';
import { calculateDamagePenalty } from '../../shared/credit.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const damages = db.prepare('SELECT * FROM damages ORDER BY createdAt DESC').all() as Damage[];
    res.json({ success: true, data: damages });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const damage = db.prepare('SELECT * FROM damages WHERE id = ?').get(req.params.id) as Damage | undefined;
    if (!damage) {
      res.status(404).json({ success: false, error: '损耗记录不存在' });
      return;
    }
    res.json({ success: true, data: damage });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { borrowId, toolId, description, severity, compensationAmount, reportedBy, images } = req.body;
    const info = db.prepare(`
      INSERT INTO damages (borrowId, toolId, description, severity, compensationAmount, reportedBy, images)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(borrowId || 0, toolId, description, severity, compensationAmount || 0, reportedBy || '管理员', images || '');

    if (borrowId && borrowId > 0) {
      db.prepare(`
        UPDATE deposits SET status = 'deducted', deductedAmount = ?, remark = ?
        WHERE borrowId = ? AND type = 'collect'
      `).run(compensationAmount || 0, `损耗赔偿扣除 ${compensationAmount || 0} 元`, borrowId);
    }

    let newCreditScore: number | undefined;
    let creditScoreChange: number | undefined;
    if (borrowId && borrowId > 0 && severity) {
      creditScoreChange = calculateDamagePenalty(severity as DamageSeverity);
      newCreditScore = handleDamageCreditUpdate(borrowId, severity as DamageSeverity);
    }

    const damage = db.prepare('SELECT * FROM damages WHERE id = ?').get(info.lastInsertRowid) as Damage;

    let message = '损耗登记成功';
    if (creditScoreChange !== undefined && creditScoreChange !== 0 && newCreditScore !== undefined) {
      message += `，信用分 ${creditScoreChange}，当前信用分：${newCreditScore}`;
    }

    res.json({
      success: true,
      data: damage,
      message,
      creditInfo: newCreditScore !== undefined ? { newScore: newCreditScore, change: creditScoreChange } : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
