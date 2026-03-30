# 🤖 AIBug 自动修复平台

> AI 驱动的智能 Bug 分析与自动修复系统

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D16-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.18-green.svg)](https://expressjs.com/)

---

## ✨ 特性

- 🤖 **AI 自动分析** - 智能分析 Bug 描述，自动定位问题代码
- 🎯 **精准定位** - 自动识别问题文件和行号
- 🔧 **自动修复** - 生成修复方案，一键应用修复
- 📊 **项目管理** - 支持多项目管理，按项目维度查看 Bug
- 👥 **用户系统** - 三种角色权限（管理员/开发/测试）
- 📱 **响应式设计** - 支持 PC 和移动端访问
- 🔒 **安全可靠** - JWT 认证，权限控制

---

## 🚀 快速开始

### 环境要求

- Node.js >= 16
- npm >= 8
- Git

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/YOUR_USERNAME/aibug.git
cd aibug

# 2. 安装依赖
npm install

# 3. 配置项目
cp config/config.example.js config/config.js
# 编辑 config/config.js 修改项目路径等配置

# 4. 启动服务
npm start

# 5. 访问系统
# 浏览器打开：http://localhost:3000
```

### ⚠️ 安全提示

1. **修改默认密码** - 首次登录后请立即修改默认账户密码
2. **保护配置文件** - `config/config.js` 包含本地路径，不要提交到 Git
3. **生产环境** - 使用强密码，配置 HTTPS，限制访问 IP
4. **数据库备份** - 定期备份 `data/aibug.db` 文件

### 默认账户

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 👨‍💼 管理员 | admin | admin123 | 所有权限 |
| 👨‍💻 开发 | developer | dev123 | 项目配置、Git 操作 |
| 🧪 测试 | tester | test123 | 提交和查看 Bug |

⚠️ **首次使用请修改默认密码！**

---

## 📖 功能说明

### 1. Bug 管理

- **提交 Bug** - 填写标题、描述、优先级
- **自动分析** - AI 分析 Bug，定位代码位置
- **修复方案** - 生成修复代码，显示代码对比
- **一键修复** - 确认后自动应用修复
- **状态跟踪** - 待处理 → 分析中 → 待修复 → 已修复

### 2. 项目管理

- **多项目支持** - 支持父项目/子项目结构
- **项目切换** - 顶部选择器快速切换项目
- **Git 集成** - 显示当前分支、最近提交
- **分支管理** - 查看和切换 Git 分支
- **代码拉取** - 一键拉取最新代码

### 3. 用户权限

- **管理员** - 所有权限，包括用户管理
- **开发者** - 项目配置、Git 操作、Bug 修复
- **测试人员** - 提交 Bug、查看分析结果

---

## 📁 项目结构

```
aibug/
├── config/
│   └── config.js          # 配置文件
├── public/
│   ├── index.html         # 登录页面
│   ├── dashboard.html     # 主仪表板
│   └── css/               # 样式文件
├── skills/                # AI 技能（可选）
├── auth.js                # 用户认证模块
├── database.js            # 数据库操作
├── git-client.js          # Git 操作模块
├── openclaw-client.js     # AI 分析模块
├── scheduler.js           # 定时任务
├── server.js              # 主服务器
├── package.json           # 依赖配置
└── README.md              # 本文件
```

---

## ⚙️ 配置说明

### 项目配置 (config/config.js)

```javascript
module.exports = {
  // 服务器配置
  server: {
    port: 3000,           // 服务端口
    host: '0.0.0.0'       // 监听地址
  },

  // OpenClaw 配置
  openclaw: {
    pollInterval: 5,      // 轮询间隔（分钟）
    autoFix: false        // 是否自动修复
  },

  // 项目源码配置
  projects: [
    {
      id: 1,
      name: '示例项目',
      display_name: '示例项目',
      path: '/path/to/your/project',
      branch: 'main',
      type: 'flutter'
    }
  ]
};
```

### 环境变量（可选）

```bash
# .env 文件
PORT=3000
JWT_SECRET=your-secret-key
```

---

## 🔌 API 接口

### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/me` | 获取当前用户 |

### Bug 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bugs` | 获取 Bug 列表 |
| GET | `/api/bugs/:id` | 获取 Bug 详情 |
| POST | `/api/bugs` | 创建 Bug |
| PUT | `/api/bugs/:id` | 更新 Bug |
| DELETE | `/api/bugs/:id` | 删除 Bug |
| POST | `/api/bugs/:id/analyze` | 分析 Bug |
| POST | `/api/bugs/:id/fix` | 应用修复 |

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/current-project` | 获取当前项目 |
| POST | `/api/current-project` | 切换项目 |
| GET | `/api/projects/:id/branches` | 获取分支列表 |
| POST | `/api/projects/:id/checkout` | 切换分支 |
| POST | `/api/projects/:id/pull` | 拉取代码 |

---

## 🛠️ 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（自动重启）
npm run dev

# 生产环境启动
npm start
```

### 添加新项目

编辑 `config/config.js`，在 `projects` 数组中添加：

```javascript
{
  id: 4,
  name: '新项目名称',
  display_name: '新项目名称',
  path: '/path/to/project',
  branch: 'main',
  type: 'flutter'  // flutter/ios/nodejs 等
}
```

### 自定义 AI 分析

修改 `openclaw-client.js` 中的 `analyzeBug()` 和 `generateFix()` 函数。

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Bug

1. 搜索是否已有相同 Issue
2. 使用 Bug 报告模板
3. 提供详细复现步骤

### 提交代码

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 2 空格缩进
- 函数名使用驼峰命名
- Commit message 清晰明了

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

---

## 📞 联系方式

- **作者**: 文鑫
- **邮箱**: 407755824@qq.com
- **项目**: AIBug 自动修复平台

---

## 🙏 致谢

感谢以下开源项目：

- [Express](https://expressjs.com/) - Web 框架
- [Bootstrap](https://getbootstrap.com/) - UI 框架
- [better-sqlite3](https://github.com/JoshuaWise/better-sqlite3) - 数据库
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - JWT 认证

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star！**

Made with ❤️ by 文鑫

</div>
