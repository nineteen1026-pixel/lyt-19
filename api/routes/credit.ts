import { Router, type Request, type Response } from 'express';
import { authMiddleware, getCurrentUserId } from './auth.js';
import { getUserCreditInfo, checkBorrowEligibility } from '../utils/credit.js';

const router = Router();

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: '未登录，请先登录' });
      return;
    }

    const creditInfo = getUserCreditInfo(userId);
    if (!creditInfo) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    res.json({ success: true, data: creditInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/eligibility', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: '未登录，请先登录' });
      return;
    }

    const eligibility = checkBorrowEligibility(userId);
    res.json({ success: true, data: eligibility });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
