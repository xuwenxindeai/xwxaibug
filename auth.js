// 用户认证模块
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = 'aibug-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

// 用户操作
const userOps = {
  // 验证用户登录
  login: (username, password) => {
    const user = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return { success: false, error: '用户名或密码错误' };
    }
    
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return { success: false, error: '用户名或密码错误' };
    }
    
    // 生成 Token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    // 保存会话
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.db.prepare(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(user.id, token, expiresAt);
    
    // 更新最后登录时间
    db.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    
    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email
        }
      }
    };
  },

  // 验证 Token
  verifyToken: (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 检查会话是否存在且未过期
      const session = db.db.prepare(`
        SELECT * FROM sessions 
        WHERE token = ? AND expires_at > CURRENT_TIMESTAMP
      `).get(token);
      
      if (!session) {
        return { valid: false, error: '会话已过期' };
      }
      
      return { valid: true, data: decoded };
    } catch (e) {
      return { valid: false, error: 'Token 无效' };
    }
  },

  // 登出
  logout: (token) => {
    db.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return { success: true };
  },

  // 获取当前用户
  getCurrentUser: (token) => {
    const result = userOps.verifyToken(token);
    if (!result.valid) {
      return null;
    }
    
    const user = db.db.prepare(`
      SELECT id, username, role, email, created_at, last_login 
      FROM users WHERE id = ?
    `).get(result.data.userId);
    
    return user;
  },

  // 获取所有用户
  getAllUsers: () => {
    return db.db.prepare(`
      SELECT id, username, role, email, created_at, last_login 
      FROM users
    `).all();
  },

  // 创建用户
  createUser: (username, password, role, email) => {
    const existing = db.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return { success: false, error: '用户名已存在' };
    }
    
    const hash = bcrypt.hashSync(password, 10);
    const result = db.db.prepare(`
      INSERT INTO users (username, password_hash, role, email)
      VALUES (?, ?, ?, ?)
    `).run(username, hash, role, email);
    
    return { success: true, data: { id: result.lastInsertRowid } };
  },

  // 更新用户
  updateUser: (id, data) => {
    const fields = [];
    const values = [];
    
    if (data.role) {
      fields.push('role = ?');
      values.push(data.role);
    }
    if (data.email) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.password) {
      fields.push('password_hash = ?');
      values.push(bcrypt.hashSync(data.password, 10));
    }
    
    if (fields.length === 0) {
      return { success: false, error: '没有要更新的字段' };
    }
    
    values.push(id);
    
    db.db.prepare(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);
    
    return { success: true };
  },

  // 删除用户
  deleteUser: (id) => {
    db.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    db.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    return { success: true };
  }
};

// 权限检查中间件
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未授权' });
  }
  
  const token = authHeader.substring(7);
  const result = userOps.verifyToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ success: false, error: result.error });
  }
  
  req.user = result.data;
  next();
};

// 角色权限检查
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }
    next();
  };
};

module.exports = {
  userOps,
  requireAuth,
  requireRole,
  JWT_SECRET
};
