// AIBug 自动修复平台 - 主服务器

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./database');
const scheduler = require('./scheduler');
const openclaw = require('./openclaw-client');
const config = require('./config/config');

const app = express();

// 请求日志中间件
app.use((req, res, next) => {
  const now = new Date().toLocaleString('zh-CN');
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.connection.remoteAddress;
  const ua = req.headers['user-agent'] || '-';
  const device = ua.includes('Mobile') ? '📱 手机' : (ua.includes('Safari') ? '💻 Mac/iOS' : '🖥️ 电脑');
  console.log(`[${now}] ${device} ${ip} → ${req.method} ${req.path}`);
  next();
});

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 确保日志目录存在
const logsDir = path.join(__dirname, config.logging.path);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ==================== API 路由 ====================

// 获取所有 Bug
app.get('/api/bugs', (req, res) => {
  try {
    const bugs = db.bugs.getAll();
    res.json({ success: true, data: bugs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个 Bug
app.get('/api/bugs/:id', (req, res) => {
  try {
    const bug = db.bugs.getById(req.params.id);
    if (!bug) {
      return res.status(404).json({ success: false, error: 'Bug 不存在' });
    }
    
    const logs = db.logs.getByBugId(req.params.id);
    res.json({ success: true, data: { ...bug, logs } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建 Bug
app.post('/api/bugs', (req, res) => {
  try {
    const { title, description, priority, project_id, project_name } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ success: false, error: '标题和描述必填' });
    }
    
    const id = db.bugs.create({
      title,
      description,
      priority: priority || 'medium',
      project_id,
      project_name
    });
    
    db.logs.add(id, 'created', `Bug 创建：${title}`);
    
    // 🚀 新增机制：自动触发分析（如果有项目 ID）
    if (project_id) {
      console.log(`🆕 Bug #${id} 已创建，自动触发分析...`);
      
      // 异步执行分析，不阻塞响应
      (async () => {
        try {
          const bug = db.bugs.getById(id);
          const project = config.projects.find(p => p.id === project_id);
          
          if (!project) {
            console.log(`⚠️ Bug #${id}: 未找到项目配置，跳过自动分析`);
            return;
          }
          
          // 等待 2 秒，确保 Bug 已完全创建
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log(`🔍 Bug #${id}: 开始自动分析...`);
          db.bugs.updateStatus(id, 'analyzing');
          
          const analysis = await openclaw.analyzeBug(bug.description, project.path);
          db.bugs.updateLocation(id, analysis.filePath, analysis.lineNumber);
          
          const fixResult = await openclaw.generateFix(
            analysis.filePath,
            analysis.lineNumber,
            analysis.analysis,
            project.path
          );
          
          // 保存完整数据
          const stmt = db.db.prepare(`
            UPDATE bugs 
            SET status = ?, 
                ai_analysis = ?, 
                ai_fix_code = ?,
                original_code_snippet = ?,
                fixed_code_snippet = ?,
                code_changes = ?,
                snippet_start_line = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);
          stmt.run(
            'ready_to_fix',
            analysis.analysis,
            fixResult.fixCode,
            analysis.codeSnippet || analysis.originalCode || '',
            fixResult.fixedCodeSnippet || fixResult.fixCode || '',
            JSON.stringify(fixResult.changes || []),
            analysis.snippetStartLine || 1,
            id
          );
          
          db.logs.add(id, 'auto_analyzed', `自动分析完成：${analysis.filePath}`);
          console.log(`✅ Bug #${id}: 自动分析完成！`);
          
        } catch (error) {
          console.error(`❌ Bug #${id} 自动分析失败:`, error.message);
          db.bugs.updateStatus(id, 'error', error.message);
          db.logs.add(id, 'auto_analyze_error', error.message);
        }
      })();
    }
    
    res.json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新 Bug 状态
app.put('/api/bugs/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.bugs.updateStatus(req.params.id, status);
    db.logs.add(req.params.id, 'status_change', `状态更新为：${status}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新 Bug（完整信息）
app.put('/api/bugs/:id', (req, res) => {
  try {
    const { title, description, priority, status, project_id } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ success: false, error: '标题和描述必填' });
    }
    
    const stmt = db.db.prepare(`
      UPDATE bugs 
      SET title = ?, 
          description = ?, 
          priority = ?, 
          status = ?,
          project_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(title, description, priority, status, project_id || null, req.params.id);
    db.logs.add(req.params.id, 'edited', `Bug 被编辑：${title}`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除 Bug
app.delete('/api/bugs/:id', (req, res) => {
  try {
    db.db.prepare('DELETE FROM bugs WHERE id = ?').run(req.params.id);
    db.db.prepare('DELETE FROM analysis_logs WHERE bug_id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 应用修复
app.post('/api/bugs/:id/fix', async (req, res) => {
  try {
    const bug = db.bugs.getById(req.params.id);
    if (!bug) {
      return res.status(404).json({ success: false, error: 'Bug 不存在' });
    }
    
    if (!bug.ai_fix_code) {
      return res.status(400).json({ success: false, error: '没有可用的修复代码' });
    }
    
    const project = config.projects.find(p => p.id === bug.project_id);
    if (!project) {
      return res.status(400).json({ success: false, error: '项目配置不存在' });
    }
    
    // 应用修复
    const result = await openclaw.applyFix(
      bug.file_path,
      bug.ai_fix_code,
      project.path
    );
    
    // 标记为已修复
    db.bugs.markAsFixed(req.params.id);
    db.logs.add(req.params.id, 'fix_applied', JSON.stringify(result));
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发分析
app.post('/api/bugs/:id/analyze', async (req, res) => {
  try {
    const bug = db.bugs.getById(req.params.id);
    if (!bug) {
      return res.status(404).json({ success: false, error: 'Bug 不存在' });
    }
    
    const project = config.projects.find(p => p.id === bug.project_id);
    if (!project) {
      return res.status(400).json({ success: false, error: '项目配置不存在' });
    }
    
    // 异步执行分析
    (async () => {
      try {
        db.bugs.updateStatus(bug.id, 'analyzing');
        
        const analysis = await openclaw.analyzeBug(bug.description, project.path);
        db.bugs.updateLocation(bug.id, analysis.filePath, analysis.lineNumber);
        
        const fixResult = await openclaw.generateFix(
          analysis.filePath,
          analysis.lineNumber,
          analysis.analysis,
          project.path
        );
        
        // 保存完整数据（包括代码片段）
        const stmt = db.db.prepare(`
          UPDATE bugs 
          SET status = ?, 
              ai_analysis = ?, 
              ai_fix_code = ?,
              original_code_snippet = ?,
              fixed_code_snippet = ?,
              code_changes = ?,
              snippet_start_line = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        stmt.run(
          'ready_to_fix',
          analysis.analysis,
          fixResult.fixCode,
          analysis.codeSnippet || analysis.originalCode || '',
          fixResult.fixedCodeSnippet || fixResult.fixCode || '',
          JSON.stringify(fixResult.changes || []),
          analysis.snippetStartLine || 1,
          bug.id
        );
        
        console.log(`✅ Bug #${bug.id} 分析完成`);
      } catch (error) {
        console.error(`❌ Bug #${bug.id} 分析失败：`, error.message);
        db.bugs.updateStatus(bug.id, 'error', error.message);
      }
    })();
    
    res.json({ success: true, message: '分析已启动' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目列表
app.get('/api/projects', (req, res) => {
  try {
    const projects = db.db.prepare('SELECT * FROM projects WHERE enabled = 1').all();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取统计信息
app.get('/api/stats', (req, res) => {
  try {
    const stats = {
      total: db.db.prepare('SELECT COUNT(*) as count FROM bugs').get().count,
      pending: db.db.prepare("SELECT COUNT(*) as count FROM bugs WHERE status = 'pending'").get().count,
      analyzing: db.db.prepare("SELECT COUNT(*) as count FROM bugs WHERE status = 'analyzing'").get().count,
      ready_to_fix: db.db.prepare("SELECT COUNT(*) as count FROM bugs WHERE status = 'ready_to_fix'").get().count,
      fixed: db.db.prepare("SELECT COUNT(*) as count FROM bugs WHERE status = 'fixed'").get().count,
      error: db.db.prepare("SELECT COUNT(*) as count FROM bugs WHERE status = 'error'").get().count
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发轮询
app.post('/api/poll', async (req, res) => {
  try {
    const result = await scheduler.triggerManual();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 启动服务器 ====================

const PORT = config.server.port;

// 初始化数据库
db.initDatabase();

// 启动服务器
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 AIBug 自动修复平台已启动');
  console.log('📍 地址：http://localhost:' + PORT);
  console.log('📊 统计：http://localhost:' + PORT + '/api/stats');
  console.log('🐛 Bug 列表：http://localhost:' + PORT + '/api/bugs');
  console.log('='.repeat(50) + '\n');
  
  // 启动轮询服务
  scheduler.start();
});

module.exports = app;
