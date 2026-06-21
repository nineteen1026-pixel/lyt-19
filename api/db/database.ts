import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'tool_share.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      image TEXT DEFAULT '',
      description TEXT DEFAULT '',
      depositAmount REAL NOT NULL DEFAULT 0,
      dailyRent REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available',
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS borrows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toolId INTEGER NOT NULL,
      toolName TEXT NOT NULL,
      borrowerName TEXT NOT NULL,
      borrowerRoom TEXT NOT NULL,
      borrowerPhone TEXT NOT NULL,
      borrowDate TEXT NOT NULL,
      expectedReturnDate TEXT NOT NULL,
      actualReturnDate TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      totalRent REAL NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (toolId) REFERENCES tools(id)
    );

    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrowId INTEGER NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deductedAmount REAL NOT NULL DEFAULT 0,
      remark TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (borrowId) REFERENCES borrows(id)
    );

    CREATE TABLE IF NOT EXISTS damages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrowId INTEGER NOT NULL,
      toolId INTEGER NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      compensationAmount REAL NOT NULL DEFAULT 0,
      reportedBy TEXT NOT NULL,
      images TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (borrowId) REFERENCES borrows(id),
      FOREIGN KEY (toolId) REFERENCES tools(id)
    );
  `);

  const toolCount = (db.prepare('SELECT COUNT(*) as count FROM tools').get() as { count: number }).count;
  if (toolCount === 0) {
    seedData();
  }
}

function seedData() {
  const insertTool = db.prepare(`
    INSERT INTO tools (name, category, image, description, depositAmount, dailyRent, stock, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
  `);

  const tools = [
    ['电钻', '电动工具', '🔌', '博世手持电钻，含多种钻头，适合家庭打孔安装', 200, 10, 2],
    ['人字梯', '登高工具', '🪜', '2米铝合金人字梯，稳固防滑', 150, 5, 3],
    ['扳手套装', '手动工具', '🔧', '多功能扳手套装，含多种规格套筒扳手', 100, 5, 2],
    ['手推车', '搬运工具', '🛒', '折叠式手推车，承重100kg，适合搬运重物', 100, 8, 2],
    ['打气筒', '五金工具', '🎈', '高压打气筒，适合自行车、球类充气', 30, 2, 3],
    ['万用表', '测量工具', '📏', '数字万用表，可测电压、电流、电阻', 80, 5, 1],
    ['针线包', '生活工具', '🧵', '家用针线套装，含多种颜色线和针', 20, 1, 5],
    ['急救箱', '医疗用品', '🩹', '家庭基础急救箱，含创可贴、消毒液、绷带等', 50, 3, 2],
  ];

  const insertMany = db.transaction((toolList: typeof tools) => {
    for (const tool of toolList) {
      insertTool.run(...tool);
    }
  });
  insertMany(tools);

  const insertBorrow = db.prepare(`
    INSERT INTO borrows (toolId, toolName, borrowerName, borrowerRoom, borrowerPhone, borrowDate, expectedReturnDate, status, totalRent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const borrowDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const expectedDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  insertBorrow.run(
    1, '电钻', '张三', '3栋2单元501', '13800138001',
    borrowDate.toISOString().slice(0, 10),
    expectedDate.toISOString().slice(0, 10),
    'borrowing',
    30
  );

  insertBorrow.run(
    4, '手推车', '李四', '5栋1单元203', '13800138002',
    borrowDate.toISOString().slice(0, 10),
    expectedDate.toISOString().slice(0, 10),
    'pending',
    24
  );

  const insertDeposit = db.prepare(`
    INSERT INTO deposits (borrowId, amount, type, status, remark)
    VALUES (?, ?, 'collect', 'completed', ?)
  `);
  insertDeposit.run(1, 200, '借用电钻押金');

  const insertDamage = db.prepare(`
    INSERT INTO damages (borrowId, toolId, description, severity, compensationAmount, reportedBy, images)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertDamage.run(1, 2, '梯子底部防滑垫磨损', 'minor', 10, '管理员', '');
}

initDatabase();

export default db;
