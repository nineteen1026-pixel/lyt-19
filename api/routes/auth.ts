import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { User, LoginResponse } from '../../shared/types.js';
import crypto from 'crypto';

const router = Router();

const PHONE_REGEX = /^1[3-9]\d{9}$/;
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;

interface TokenPayload {
  userId: number;
  role: string;
  exp: number;
}

const activeTokens = new Map<string, TokenPayload>();

function generateToken(userId: number, role: string): string {
  const payload: TokenPayload = {
    userId,
    role,
    exp: Date.now() + TOKEN_TTL,
  };
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, payload);
  return token;
}

function verifyToken(token: string): TokenPayload | null {
  const payload = activeTokens.get(token);
  if (!payload) return null;
  if (payload.exp < Date.now()) {
    activeTokens.delete(token);
    return null;
  }
  return payload;
}

export function authMiddleware(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登录，请先登录' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
    return;
  }
  (req as Request & { user?: TokenPayload }).user = payload;
  next();
}

export function getCurrentUserId(req: Request): number | null {
  const user = (req as Request & { user?: TokenPayload }).user;
  return user ? user.userId : null;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/send-code', (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone || !PHONE_REGEX.test(phone)) {
      res.status(400).json({ success: false, error: '请输入有效的手机号码' });
      return;
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO verification_codes (phone, code, expiresAt, used)
      VALUES (?, ?, ?, 0)
    `).run(phone, code, expiresAt);

    console.log(`[验证码] 手机号: ${phone}, 验证码: ${code} (5分钟内有效)`);

    res.json({
      success: true,
      message: '验证码已发送（开发模式：请查看控制台输出）',
      data: { debug: process.env.NODE_ENV !== 'production' ? code : undefined },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/login', (req: Request, res: Response) => {
  try {
    const { phone, code, name, room } = req.body;

    if (!phone || !PHONE_REGEX.test(phone)) {
      res.status(400).json({ success: false, error: '请输入有效的手机号码' });
      return;
    }
    if (!code || code.length !== 6) {
      res.status(400).json({ success: false, error: '请输入6位验证码' });
      return;
    }

    const verification = db.prepare(`
      SELECT * FROM verification_codes
      WHERE phone = ? AND code = ? AND used = 0
      ORDER BY createdAt DESC
      LIMIT 1
    `).get(phone, code) as { id: number; expiresAt: string } | undefined;

    if (!verification) {
      res.status(400).json({ success: false, error: '验证码错误或已使用' });
      return;
    }

    if (new Date(verification.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ success: false, error: '验证码已过期，请重新获取' });
      return;
    }

    db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(verification.id);

    let isNewUser = false;
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as User | undefined;

    if (!user) {
      if (!name || !name.trim()) {
        res.status(400).json({ success: false, error: '首次登录请填写姓名' });
        return;
      }
      if (!room || !room.trim()) {
        res.status(400).json({ success: false, error: '首次登录请填写房号' });
        return;
      }

      const info = db.prepare(`
        INSERT INTO users (phone, name, room, role)
        VALUES (?, ?, ?, 'resident')
      `).run(phone, name.trim(), room.trim());

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as User;
      isNewUser = true;
    } else if (name || room) {
      db.prepare(`
        UPDATE users
        SET name = COALESCE(?, name), room = COALESCE(?, room)
        WHERE id = ?
      `).run(name?.trim() || null, room?.trim() || null, user.id);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as User;
    }

    db.prepare(`
      UPDATE borrows
      SET userId = ?
      WHERE borrowerPhone = ? AND userId IS NULL
    `).run(user.id, phone);

    const token = generateToken(user.id, user.role);
    const result: LoginResponse = { user, token };
    res.json({ success: true, data: result, message: isNewUser ? '注册成功并已登录' : '登录成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    db.prepare(`
      UPDATE borrows
      SET userId = ?
      WHERE borrowerPhone = ? AND userId IS NULL
    `).run(userId, user.phone);

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/profile', authMiddleware, (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const { name, room } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name), room = COALESCE(?, room)
      WHERE id = ?
    `).run(name?.trim() || null, room?.trim() || null, userId);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
    res.json({ success: true, data: updated, message: '个人信息已更新' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      activeTokens.delete(token);
    }
    res.json({ success: true, message: '已退出登录' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
