# AIBug 自动修复平台 🤖

AI 驱动的智能 Bug 分析与自动修复系统

## 架构

```
前端 Bug 表格 ←→ 后端轮询服务 ←→ OpenClaw ←→ 项目源码
```

## 功能特性

✅ **前端网页表格** - 测试人员可提交 Bug（标题、描述、状态）
✅ **后端定时轮询** - 自动扫描未处理的 Bug
✅ **OpenClaw 集成** - 分析项目代码、定位错误
✅ **AI 自动分析** - 生成一句话分析总结
✅ **AI 自动修复** - 生成修复代码并应用到源码
✅ **结果回填** - 分析结果自动回填到 Bug 表格
✅ **一键修复** - 开发人员可点击查看详情并应用修复
✅ **自动备份** - 修复前自动创建备份文件

## 技术栈

- **前端**: HTML + Bootstrap 5 + jQuery
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **定时任务**: node-schedule
- **AI**: OpenClaw

## 快速开始

### 1. 安装依赖

```bash
cd ~/Desktop/AIBug
npm install
```

### 2. 配置项目

编辑 `config/config.js` 文件，配置：

- 服务器端口（默认 3000）
- 项目源码路径
- OpenClaw workspace 路径
- 轮询间隔

### 3. 启动服务

```bash
npm start
```

### 4. 访问平台

打开浏览器访问：http://localhost:3000

## 项目结构

```
AIBug/
├── package.json          # 依赖配置
├── server.js            # Express 主服务器
├── scheduler.js         # 定时轮询服务
├── openclaw-client.js   # OpenClaw 客户端封装
├── database.js          # SQLite 数据库操作
├── config/
│   └── config.js        # 配置文件
├── public/
│   ├── index.html       # 前端页面
│   ├── css/             # 样式文件
│   └── js/              # 脚本文件
├── logs/                # 日志目录
└── data/
    └── aibug.db         # SQLite 数据库（自动创建）
```

## API 接口

### Bug 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/bugs | 获取所有 Bug |
| GET | /api/bugs/:id | 获取单个 Bug 详情 |
| POST | /api/bugs | 创建新 Bug |
| PUT | /api/bugs/:id/status | 更新 Bug 状态 |
| POST | /api/bugs/:id/analyze | 手动触发分析 |
| POST | /api/bugs/:id/fix | 应用修复 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 获取项目列表 |
| GET | /api/stats | 获取统计信息 |
| POST | /api/poll | 手动触发轮询 |

## 使用流程

### 测试人员

1. 访问 http://localhost:3000
2. 点击"提交 Bug"
3. 填写标题、描述、选择项目和优先级
4. 提交后等待 AI 分析

### AI 自动处理

1. 轮询服务检测到新 Bug
2. 调用 OpenClaw 分析代码
3. 定位错误位置（文件 + 行号）
4. 生成修复代码
5. 自动应用修复（如启用）

### 开发人员

1. 查看 Bug 列表
2. 点击 Bug 查看详情和 AI 分析
3. 确认修复方案
4. 点击"一键修复"应用（如未自动修复）

## 配置说明

### config/config.js

```javascript
{
  server: {
    port: 3000,        // 服务器端口
    host: 'localhost'
  },
  
  openclaw: {
    workspacePath: '/Users/xwxgs/.openclaw/workspace',
    pollInterval: 5,   // 轮询间隔（分钟）
    autoFix: true      // 是否自动修复
  },
  
  projects: [
    {
      id: 1,
      name: '项目名称',
      path: '/path/to/project',
      branch: 'dev',
      type: 'flutter'
    }
  ]
}
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 - 新提交的 Bug |
| analyzing | 分析中 - AI 正在分析代码 |
| ready_to_fix | 待修复 - 已生成修复方案 |
| fixed | 已修复 - 修复已应用 |
| error | 错误 - 分析或修复失败 |

## 注意事项

⚠️ **自动修复风险**: 启用 `autoFix: true` 后，系统会自动修改源码文件
- 系统会自动创建备份文件（`.backup.时间戳`）
- 建议在测试环境先验证
- 生产环境建议手动确认修复方案

⚠️ **OpenClaw 集成**: 需要确保 OpenClaw 正常运行
- 检查 OpenClaw Gateway 状态
- 确保有足够的权限访问项目源码

## 日志查看

日志文件位于 `logs/` 目录，可通过控制台查看实时日志：

```bash
# 查看最新日志
tail -f logs/*.log

# 或直接在启动时查看
npm start
```

## 开发模式

使用 nodemon 自动重启：

```bash
npm run dev
```

## 故障排查

### 服务无法启动

1. 检查端口是否被占用
2. 检查 Node.js 版本（建议 16+）
3. 重新安装依赖：`npm install`

### OpenClaw 调用失败

1. 检查 `config.js` 中的 workspace 路径
2. 确保 OpenClaw Gateway 正在运行
3. 检查项目源码路径是否正确

### 数据库错误

1. 删除 `data/aibug.db` 重新创建
2. 检查文件权限

## License

MIT
