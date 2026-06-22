import { Router, type Request, type Response } from 'express';
import db from '../db/database.js';
import type { Tool } from '../../shared/types.js';
import { checkAvailableStock } from '../utils/inventory.js';

const router = Router();

function enrichToolStock(tool: Tool): Tool {
  const stockInfo = checkAvailableStock(tool.id, 1);
  return {
    ...tool,
    availableStock: stockInfo.availableStock,
    lockedCount: stockInfo.lockedCount,
  };
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, keyword } = req.query;
    let sql = 'SELECT * FROM tools WHERE 1=1';
    const params: unknown[] = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (keyword) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw);
    }
    sql += ' ORDER BY createdAt DESC';

    const tools = db.prepare(sql).all(...params) as Tool[];
    const enrichedTools = tools.map(enrichToolStock);
    res.json({ success: true, data: enrichedTools });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/categories', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT DISTINCT category FROM tools ORDER BY category').all() as { category: string }[];
    const categories = rows.map(r => r.category);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id) as Tool | undefined;
    if (!tool) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }
    res.json({ success: true, data: enrichToolStock(tool) });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, category, image, description, depositAmount, dailyRent, stock, status } = req.body;
    const info = db.prepare(`
      INSERT INTO tools (name, category, image, description, depositAmount, dailyRent, stock, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, image || '🛠️', description || '', depositAmount || 0, dailyRent || 0, stock || 1, status || 'available');

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(info.lastInsertRowid) as Tool;
    res.json({ success: true, data: enrichToolStock(tool), message: '工具添加成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { name, category, image, description, depositAmount, dailyRent, stock, status } = req.body;
    const existing = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id) as Tool | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }
    db.prepare(`
      UPDATE tools SET name = ?, category = ?, image = ?, description = ?, depositAmount = ?, dailyRent = ?, stock = ?, status = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      category ?? existing.category,
      image ?? existing.image,
      description ?? existing.description,
      depositAmount ?? existing.depositAmount,
      dailyRent ?? existing.dailyRent,
      stock ?? existing.stock,
      status ?? existing.status,
      req.params.id
    );

    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id) as Tool;
    res.json({ success: true, data: enrichToolStock(tool), message: '工具更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM tools WHERE id = ?').get(req.params.id) as Tool | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '工具不存在' });
      return;
    }
    db.prepare('DELETE FROM tools WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '工具删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
