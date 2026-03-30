// SQLite 数据库模块
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');

// 确保数据目录存在
const dataDir = path.dirname(config.database.path);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库
const db = new Database(config.database.path);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表结构
function initDatabase() {
  // Bug 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS bugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      project_id INTEGER,
      project_name TEXT,
      file_path TEXT,
      line_number INTEGER,
      ai_analysis TEXT,
      ai_fix_code TEXT,
      ai_fix_applied INTEGER DEFAULT 0,
      original_code_snippet TEXT,
      fixed_code_snippet TEXT,
      code_changes TEXT,
      snippet_start_line INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      fixed_at DATETIME
    )
  `);

  // 项目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      branch TEXT,
      type TEXT,
      enabled INTEGER DEFAULT 1
    )
  `);

  // 分析日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bug_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bug_id) REFERENCES bugs(id)
    )
  `);

  // 初始化默认项目
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO projects (id, name, path, branch, type, enabled)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  config.projects.forEach(project => {
    stmt.run(project.id, project.name, project.path, project.branch, project.type);
  });

  console.log('✅ 数据库初始化完成');
}

// Bug 相关操作
const bugOps = {
  // 获取所有 Bug
  getAll: () => {
    return db.prepare('SELECT * FROM bugs ORDER BY created_at DESC').all();
  },

  // 获取未处理的 Bug
  getPending: () => {
    return db.prepare(`
      SELECT * FROM bugs 
      WHERE status IN ('pending', 'analyzing') 
      ORDER BY created_at ASC
    `).all();
  },

  // 获取单个 Bug
  getById: (id) => {
    return db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
  },

  // 创建 Bug
  create: (bug) => {
    const stmt = db.prepare(`
      INSERT INTO bugs (title, description, status, priority, project_id, project_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      bug.title,
      bug.description,
      bug.status || 'pending',
      bug.priority || 'medium',
      bug.project_id || null,
      bug.project_name || null
    );
    return result.lastInsertRowid;
  },

  // 更新 Bug 状态
  updateStatus: (id, status, analysis = null, fixCode = null) => {
    const stmt = db.prepare(`
      UPDATE bugs 
      SET status = ?, 
          ai_analysis = ?, 
          ai_fix_code = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(status, analysis, fixCode, id);
  },

  // 标记为已修复
  markAsFixed: (id) => {
    const stmt = db.prepare(`
      UPDATE bugs 
      SET status = 'fixed',
          ai_fix_applied = 1,
          fixed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  },

  // 更新文件路径和行号
  updateLocation: (id, filePath, lineNumber) => {
    const stmt = db.prepare(`
      UPDATE bugs 
      SET file_path = ?, 
          line_number = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(filePath, lineNumber, id);
  }
};

// 日志相关操作
const logOps = {
  add: (bugId, action, details) => {
    const stmt = db.prepare(`
      INSERT INTO analysis_logs (bug_id, action, details)
      VALUES (?, ?, ?)
    `);
    return stmt.run(bugId, action, details);
  },

  getByBugId: (bugId) => {
    return db.prepare(`
      SELECT * FROM analysis_logs 
      WHERE bug_id = ? 
      ORDER BY created_at DESC
    `).all(bugId);
  }
};

module.exports = {
  db,
  initDatabase,
  bugs: bugOps,
  logs: logOps
};
