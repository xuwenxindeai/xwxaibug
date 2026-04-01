// AIBug 自动修复平台 - 主服务器

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const db = require('./database');
const scheduler = require('./scheduler');
const openclaw = require('./openclaw-client');
const config = require('./config/config');
const auth = require('./auth');
const gitClient = require('./git-client');

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
app.use(cookieParser());

// 根路径重定向到登录页（在静态文件之前）
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// API 保护中间件（白名单）
const publicApis = ['/auth/login']; // 相对于 /api/ 的路径
app.use('/api/', (req, res, next) => {
  // 白名单 API 不需要认证
  if (publicApis.includes(req.path)) {
    return next();
  }
  
  // 检查 Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未授权，请先登录' });
  }
  
  const token = authHeader.substring(7);
  const result = auth.userOps.verifyToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ success: false, error: result.error });
  }
  
  req.user = result.data;
  next();
});

// 静态文件服务（放在最后）
app.use(express.static(path.join(__dirname, 'public')));

// 确保日志目录存在
const logsDir = path.join(__dirname, config.logging.path);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ==================== API 路由 ====================

// 获取所有 Bug（支持按父项目过滤）
app.get('/api/bugs', auth.requireAuth, (req, res) => {
  try {
    const { group_id } = req.query;
    let query;
    
    if (group_id) {
      // 获取该父项目下的所有子项目 ID
      const projects = db.db.prepare('SELECT * FROM projects WHERE enabled = 1 ORDER BY id').all();
      const grouped = {};
      projects.forEach(p => {
        const groupName = p.display_name || p.name;
        if (!grouped[groupName]) grouped[groupName] = [];
        grouped[groupName].push(p.id);
      });
      
      const groupNames = Object.keys(grouped);
      const selectedGroup = groupNames[group_id - 1];
      const childIds = grouped[selectedGroup] || [];
      
      if (childIds.length > 0) {
        const placeholders = childIds.map(() => '?').join(',');
        query = db.db.prepare(`SELECT * FROM bugs WHERE project_id IN (${placeholders}) ORDER BY created_at DESC`).all(...childIds);
      } else {
        query = [];
      }
    } else {
      query = db.db.prepare('SELECT * FROM bugs ORDER BY created_at DESC').all();
    }
    
    res.json({ success: true, data: query });
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
    const { title, description, priority = 'P2', project_id, project_name } = req.body;
    
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

// 获取当前选中的项目（从 Cookie 或默认第一个）
app.get('/api/current-project', auth.requireAuth, (req, res) => {
  try {
    const projects = db.db.prepare('SELECT * FROM projects WHERE enabled = 1 ORDER BY id').all();
    if (projects.length === 0) {
      return res.json({ success: true, data: null, all: [] });
    }
    
    // 按 display_name 分组
    const grouped = {};
    projects.forEach(p => {
      const groupName = p.display_name || p.name;
      if (!grouped[groupName]) {
        grouped[groupName] = {
          id: Object.keys(grouped).length + 1, // 生成父项目 ID
          display_name: groupName,
          children: []
        };
      }
      grouped[groupName].children.push({
        id: p.id,
        name: p.name,
        type: p.type,
        path: p.path,
        branch: p.branch,
        display_name: groupName
      });
    });
    
    const all = Object.values(grouped);
    
    // 从 Cookie 获取选中的父项目 ID，或默认第一个
    const selectedGroupId = req.cookies?.selectedGroupId ? parseInt(req.cookies.selectedGroupId) : 1;
    const selected = all.find(g => g.id === selectedGroupId) || all[0];
    
    res.json({ success: true, data: selected, all });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 切换当前项目（父项目）
app.post('/api/current-project', auth.requireAuth, (req, res) => {
  try {
    const { groupId } = req.body; // 父项目 ID
    const projects = db.db.prepare('SELECT * FROM projects WHERE enabled = 1 ORDER BY id').all();
    
    // 按 display_name 分组
    const grouped = {};
    projects.forEach(p => {
      const groupName = p.display_name || p.name;
      if (!grouped[groupName]) {
        grouped[groupName] = {
          id: Object.keys(grouped).length + 1,
          display_name: groupName,
          children: []
        };
      }
      grouped[groupName].children.push({ id: p.id, name: p.name, type: p.type, path: p.path, branch: p.branch });
    });
    
    const all = Object.values(grouped);
    const selected = all.find(g => g.id === parseInt(groupId)) || all[0];
    
    // 设置 Cookie（有效期 30 天）
    res.cookie('selectedGroupId', groupId, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.json({ success: true, data: selected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目列表
app.get('/api/projects', auth.requireAuth, (req, res) => {
  try {
    const projects = db.db.prepare('SELECT * FROM projects WHERE enabled = 1').all();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取统计信息（支持按父项目过滤）
app.get('/api/stats', auth.requireAuth, (req, res) => {
  try {
    const { group_id } = req.query;
    let where = '';
    let params = [];
    
    if (group_id) {
      // 获取该父项目下的所有子项目 ID
      const projects = db.db.prepare('SELECT * FROM projects WHERE enabled = 1 ORDER BY id').all();
      const grouped = {};
      projects.forEach(p => {
        const groupName = p.display_name || p.name;
        if (!grouped[groupName]) grouped[groupName] = [];
        grouped[groupName].push(p.id);
      });
      
      const groupNames = Object.keys(grouped);
      const selectedGroup = groupNames[group_id - 1];
      const childIds = grouped[selectedGroup] || [];
      
      if (childIds.length > 0) {
        const placeholders = childIds.map(() => '?').join(',');
        where = `WHERE project_id IN (${placeholders})`;
        params = childIds;
      }
    }
    
    const stats = {
      total: db.db.prepare(`SELECT COUNT(*) as count FROM bugs ${where}`).get(...params).count,
      pending: db.db.prepare(`SELECT COUNT(*) as count FROM bugs ${where ? where + ' AND' : 'WHERE'} status = 'pending'`).get(...params).count,
      analyzing: db.db.prepare(`SELECT COUNT(*) as count FROM bugs ${where ? where + ' AND' : 'WHERE'} status = 'analyzing'`).get(...params).count,
      ready_to_fix: db.db.prepare(`SELECT COUNT(*) as count FROM bugs ${where ? where + ' AND' : 'WHERE'} status = 'ready_to_fix'`).get(...params).count,
      fixed: db.db.prepare(`SELECT COUNT(*) as count FROM bugs ${where ? where + ' AND' : 'WHERE'} status = 'fixed'`).get(...params).count,
      error: db.db.prepare(`SELECT COUNT(*) as count FROM bugs ${where ? where + ' AND' : 'WHERE'} status = 'error'`).get(...params).count
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

// ==================== 用户认证 API ====================

// 用户登录
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码必填' });
    }
    
    const result = auth.userOps.login(username, password);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 用户登出
app.post('/api/auth/logout', auth.requireAuth, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  auth.userOps.logout(token);
  res.json({ success: true });
});

// 获取当前用户
app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  const user = auth.userOps.getCurrentUser(req.headers.authorization.substring(7));
  res.json({ success: true, data: user });
});

// 获取所有用户（仅管理员）
app.get('/api/users', auth.requireAuth, auth.requireRole('admin'), (req, res) => {
  const users = auth.userOps.getAllUsers();
  res.json({ success: true, data: users });
});

// 创建用户（仅管理员）
app.post('/api/users', auth.requireAuth, auth.requireRole('admin'), (req, res) => {
  try {
    const { username, password, role, email } = req.body;
    const result = auth.userOps.createUser(username, password, role, email);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 项目配置 API ====================

// 更新项目配置（仅管理员）
app.put('/api/projects/:id', auth.requireAuth, auth.requireRole('admin'), (req, res) => {
  try {
    const { branch } = req.body;
    const projectId = req.params.id;
    
    db.db.prepare(`
      UPDATE projects SET branch = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(branch, projectId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目 Git 分支列表（仅开发和管理员）
app.get('/api/projects/:id/branches', auth.requireAuth, auth.requireRole('developer', 'admin'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const branches = await gitClient.getAllBranches(project.path);
    const currentBranch = await gitClient.getCurrentBranch(project.path);
    
    res.json({
      success: true,
      data: {
        current: currentBranch,
        all: branches
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 切换项目分支（仅开发和管理员）
app.post('/api/projects/:id/checkout', auth.requireAuth, auth.requireRole('developer', 'admin'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const { branch } = req.body;
    const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const result = await gitClient.checkoutBranch(project.path, branch);
    
    if (result.success) {
      // 更新数据库中的分支
      db.db.prepare('UPDATE projects SET branch = ? WHERE id = ?').run(branch, projectId);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 拉取项目最新代码（仅开发和管理员）
app.post('/api/projects/:id/pull', auth.requireAuth, auth.requireRole('developer', 'admin'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const result = await gitClient.pull(project.path);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目状态（包含分支和提交记录）
app.get('/api/projects/:id/status', auth.requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const status = await gitClient.getRepoStatus(project.path);
    res.json({ success: true, data: status });
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
  console.log('🔐 默认账户：admin/admin123, tester/test123, developer/dev123');
  console.log('📊 统计：http://localhost:' + PORT + '/api/stats');
  console.log('🐛 Bug 列表：http://localhost:' + PORT + '/api/bugs');
  console.log('='.repeat(50) + '\n');
  
  // 启动轮询服务
  scheduler.start();
});

module.exports = app;

// ==================== UI 界面相关 API ====================

// 获取项目目录树（用于 UI 界面）
app.post('/api/ui/project-tree', auth.requireAuth, (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) return res.status(400).json({ success: false, error: '项目路径不能为空' });
    
    const tree = buildProjectTree(projectPath);
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 解析 VC 文件的 UI 结构
app.post('/api/ui/parse-vc', auth.requireAuth, (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: '文件路径不能为空' });
    
    const uiStructure = parseVCFile(filePath);
    res.json({ success: true, data: uiStructure });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 构建项目目录树
function buildProjectTree(rootPath, maxDepth = 10) {
  const path = require('path');
  const fs = require('fs');
  
  // 排除的目录
  const excludedDirs = [
    'node_modules', 'Pods', 'Carthage', 'Frameworks', '.git', 'build',
    'DerivedData', '.xcodeproj', '.xcworkspace', 'Tests', 'Test',
    'Vendors', 'protobuf', 'objectivec', '.xcassets', '.imageset',
    '.appiconset', '.colorset', '.launchimage'
  ];
  
  // 递归构建目录树
  function scanDir(dirPath, depth = 0) {
    if (depth > maxDepth) return null;
    
    const dirName = path.basename(dirPath);
    if (excludedDirs.includes(dirName)) return null;
    
    const node = {
      name: dirName,
      path: dirPath,
      type: 'folder',
      children: []
    };
    
    try {
      const items = fs.readdirSync(dirPath);
      items.forEach(item => {
        if (item.startsWith('.')) return;
        
        const itemPath = path.join(dirPath, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            const childNode = scanDir(itemPath, depth + 1);
            if (childNode) node.children.push(childNode);
          } else if (stat.isFile()) {
            // 只保留代码文件和资源文件
            const ext = path.extname(item).toLowerCase();
            if (['.m', '.mm', '.swift', '.h', '.hpp', '.cpp', '.cc', '.c', '.xib', '.storyboard'].includes(ext)) {
              node.children.push({
                name: item,
                path: itemPath,
                type: 'file'
              });
            }
          }
        } catch (e) {
          // 忽略无法访问的文件/目录
        }
      });
    } catch (e) {
      // 忽略无法访问的目录
    }
    
    // 按类型和名称排序：文件夹在前，文件在后
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    
    return node;
  }
  
  // 从根目录开始扫描
  const rootName = path.basename(rootPath);
  const rootNode = {
    name: rootName,
    path: rootPath,
    type: 'folder',
    children: []
  };
  
  try {
    const items = fs.readdirSync(rootPath);
    items.forEach(item => {
      if (item.startsWith('.')) return;
      
      const itemPath = path.join(rootPath, item);
      try {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          const childNode = scanDir(itemPath, 1);
          if (childNode) rootNode.children.push(childNode);
        }
      } catch (e) {
        // 忽略
      }
    });
  } catch (e) {
    throw new Error('无法读取项目目录：' + e.message);
  }
  
  // 排序
  rootNode.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  
  return rootNode;
}

// 解析 VC 文件
function parseVCFile(filePath, depth = 0) {
  const fs = require('fs');
  const path = require('path');
  
  // 防止无限递归
  if (depth > 3) {
    return {
      fileName: path.basename(filePath),
      filePath: filePath,
      parseTime: new Date().toISOString(),
      parseMethod: 'limited',
      ui: { navigationBar: null, elements: [] },
      debug: { message: '达到最大解析深度', reason: '避免循环引用', suggestion: '子视图嵌套不超过 3 层' }
    };
  }
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new Error('文件不存在：' + filePath);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const fileExt = path.extname(filePath).toLowerCase();
  
  const result = {
    fileName: fileName,
    filePath: filePath,
    parseTime: new Date().toISOString(),
    parseDepth: depth,
    ui: {
      navigationBar: null,
      elements: []
    }
  };
  
  // 如果是 .h 文件，尝试找对应的 .m 文件
  if (fileExt === '.h') {
    const mFilePath = filePath.replace('.h', '.m');
    if (fs.existsSync(mFilePath)) {
      return parseVCFile(mFilePath, depth);
    }
  }
  
  // 解析代码中的 UI 元素
  if (fileExt === '.m' || fileExt === '.mm') {
    // 1. 解析自定义视图属性（@property）
    const propertyRegex = /@property\s*\([^)]+\)\s*(NS\w+View|\w+View)\s*\*\s*(\w+)/g;
    let propMatch;
    
    while ((propMatch = propertyRegex.exec(content)) !== null) {
      const propType = propMatch[1];
      const propName = propMatch[2];
      
      result.ui.elements.push({
        type: 'SubviewHeader',
        name: propType,
        text: '📦 ' + propType + ' (' + propName + ')',
        layout: 'property'
      });
    }
    
    // 2. 检测 UITableView
    if (content.includes('UITableView')) {
      const tableViewMatch = content.match(/UITableView\s*\*\s*(\w+)/);
      result.ui.elements.push({
        type: 'UITableView',
        name: tableViewMatch ? tableViewMatch[1] : 'tableView',
        style: 'plain',
        layout: 'code'
      });
    }
    
    // 3. 检测 UICollectionView
    if (content.includes('UICollectionView')) {
      result.ui.elements.push({
        type: 'UICollectionView',
        name: 'collectionView',
        style: 'flow',
        layout: 'code'
      });
    }
    
    // 4. 检测 WKWebView
    if (content.includes('WKWebView')) {
      result.ui.elements.push({
        type: 'WKWebView',
        name: 'webView',
        url: 'https://...',
        layout: 'code'
      });
    }
    
    // 5. 解析导航栏标题
    const titleMatch = content.match(/self\.title\s*=\s*@"([^"]+)"/);
    if (titleMatch) {
      result.ui.navigationBar = { title: titleMatch[1] };
    }
    
    // 6. 解析 Masonry 布局的视图
    if (content.includes('mas_makeConstraints')) {
      const masonryRegex = /(\w+)\[mas_makeConstraints:/g;
      let match;
      
      while ((match = masonryRegex.exec(content)) !== null) {
        const beforeMatch = content.substring(Math.max(0, match.index - 50), match.index);
        const nameMatch = beforeMatch.match(/(\w+)\s*$/);
        
        if (nameMatch) {
          const viewName = nameMatch[1];
          const typeRegex = new RegExp(`(\\w+)\\s*\\*\\s*${viewName}\\s*[=;]`, 'g');
          const typeMatch = typeRegex.exec(content);
          
          if (typeMatch) {
            const viewType = typeMatch[1];
            
            if (viewType.includes('UILabel')) {
              result.ui.elements.push({ type: 'UILabel', name: viewName, layout: 'masonry' });
            } else if (viewType.includes('UIButton')) {
              result.ui.elements.push({ type: 'UIButton', name: viewName, layout: 'masonry' });
            } else if (viewType.includes('UITextField')) {
              result.ui.elements.push({ type: 'UITextField', name: viewName, layout: 'masonry' });
            } else if (viewType.includes('View')) {
              result.ui.elements.push({
                type: 'SubviewHeader',
                name: viewType,
                text: '📦 ' + viewType + ' (' + viewName + ')',
                layout: 'masonry'
              });
            }
          }
        }
      }
    }
  }
  
  // 占位数据
  if (result.ui.elements.length === 0 && !result.ui.navigationBar) {
    const viewName = fileName.replace(/\.m$/, '').replace(/ViewController/g, '');
    result.ui.navigationBar = { title: viewName || '页面', backTitle: '返回' };
    result.ui.elements = [
      { type: 'UILabel', text: '👋 欢迎使用 ' + viewName },
      { type: 'UITextField', placeholder: '请输入用户名...' },
      { type: 'UITextField', placeholder: '请输入密码...' },
      { type: 'UIButton', title: '🔐 登录' },
      { type: 'UITableView', style: 'plain' }
    ];
    result.parseMethod = 'placeholder';
    result.debug = {
      message: '未解析到实际 UI 代码，使用占位数据',
      reason: '可能是纯逻辑 VC 或使用 SwiftUI/Storyboard',
      suggestion: '建议检查代码中是否有 UIView 布局代码'
    };
  } else {
    result.parseMethod = result.parseMethod || 'mixed';
  }
  
  return result;
}

// ==================== Git 相关 API ====================

// 获取 Git 状态详情（含 Hash）
app.post('/api/git/status-detail', auth.requireAuth, async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) return res.status(400).json({ success: false, error: '项目路径不能为空' });
    
    const { execSync } = require('child_process');
    
    // 获取当前分支
    const branch = execSync(`git branch --show-current`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    
    // 获取当前 Hash
    const hash = execSync(`git rev-parse --short HEAD`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    
    // 获取提交记录
    const log = execSync(`git log -n 5 --pretty=format:"%h|%s|%ai"`, { cwd: projectPath, encoding: 'utf-8' });
    const commits = log.split('\n').map(line => {
      const [hash, message, time] = line.split('|');
      return { hash, message, time };
    });
    
    // 获取本地修改状态
    const status = execSync(`git status --porcelain`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    const hasLocalChanges = status.length > 0;
    
    res.json({
      success: true,
      data: {
        branch,
        hash,
        commits,
        hasLocalChanges,
        status: status || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取简化 Git 状态
app.post('/api/git/status', auth.requireAuth, async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) return res.status(400).json({ success: false, error: '项目路径不能为空' });
    
    const { execSync } = require('child_process');
    
    // 获取当前分支
    const branch = execSync(`git branch --show-current`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    
    // 获取提交记录
    const log = execSync(`git log -n 3 --pretty=format:"%h|%s|%ai"`, { cwd: projectPath, encoding: 'utf-8' });
    const commits = log.split('\n').map(line => {
      const [hash, message, time] = line.split('|');
      return { hash, message, time };
    });
    
    res.json({
      success: true,
      data: { branch, commits }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 拉取最新代码
app.post('/api/git/pull', auth.requireAuth, async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) return res.status(400).json({ success: false, error: '项目路径不能为空' });
    
    const { execSync } = require('child_process');
    
    // 执行 git pull
    const output = execSync(`git pull`, { cwd: projectPath, encoding: 'utf-8' });
    
    res.json({
      success: true,
      message: '代码拉取成功',
      output: output
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 可视化相关 API ====================

// 获取上次可视化结果（缓存）
app.get('/api/visualization/last', auth.requireAuth, (req, res) => {
  try {
    const { path: projectPath } = req.query;
    if (!projectPath) return res.status(400).json({ success: false, error: '项目路径不能为空' });
    
    const cache = db.db.prepare('SELECT * FROM visualization_cache WHERE project_path = ?').get(projectPath);
    
    if (cache) {
      res.json({
        success: true,
        data: JSON.parse(cache.raw_data),
        cached: true,
        cachedAt: cache.updated_at
      });
    } else {
      res.json({ success: false, error: '没有缓存数据', cached: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 生成可视化数据
app.post('/api/visualization/generate', auth.requireAuth, async (req, res) => {
  try {
    const { path: projectPath, type } = req.body;
    if (!projectPath) return res.status(400).json({ success: false, error: '项目路径不能为空' });
    
    const visualization = await generateVisualization(projectPath);
    
    // 保存到缓存
    const { execSync } = require('child_process');
    const gitHash = execSync(`git rev-parse HEAD`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    const gitBranch = execSync(`git branch --show-current`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    const gitStatus = execSync(`git status --porcelain`, { cwd: projectPath, encoding: 'utf-8' }).trim();
    const hasLocalChanges = gitStatus.length > 0 ? 1 : 0;
    
    db.db.prepare(`
      INSERT OR REPLACE INTO visualization_cache 
      (project_path, git_hash, git_branch, has_local_changes, raw_data, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(projectPath, gitHash, gitBranch, hasLocalChanges, JSON.stringify(visualization));
    
    res.json({ success: true, data: visualization });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 生成可视化数据（简化版）
async function generateVisualization(projectPath) {
  const fs = require('fs');
  const path = require('path');
  
  // 排除的目录
  const excludedDirs = ['Pods', 'Vendors', 'node_modules', '.git', 'build'];
  
  // 扫描代码文件
  function scanDir(dirPath) {
    const result = { files: [], modules: {} };
    
    try {
      const items = fs.readdirSync(dirPath);
      items.forEach(item => {
        if (item.startsWith('.') || excludedDirs.includes(item)) return;
        
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          const subResult = scanDir(itemPath);
          result.modules[item] = subResult.files;
          result.files.push(...subResult.files);
        } else if (item.endsWith('.m') || item.endsWith('.swift')) {
          result.files.push({
            name: item,
            path: itemPath,
            lines: fs.readFileSync(itemPath, 'utf-8').split('\n').length
          });
        }
      });
    } catch (e) {
      console.error('扫描目录失败:', e.message);
    }
    
    return result;
  }
  
  const scanResult = scanDir(projectPath);
  
  return {
    projectName: path.basename(projectPath),
    projectPath: projectPath,
    totalFiles: scanResult.files.length,
    totalLines: scanResult.files.reduce((sum, f) => sum + f.lines, 0),
    modules: Object.keys(scanResult.modules).length,
    files: scanResult.files.slice(0, 100), // 只返回前 100 个文件
    modules: scanResult.modules
  };
}
