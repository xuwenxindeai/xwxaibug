# 🚀 AIBug 平台 - 快速启动指南

## ✅ 已完成

- [x] 项目结构创建
- [x] 所有代码文件生成
- [x] 依赖安装完成
- [x] 服务已启动运行

## 📍 访问地址

**前端页面**: http://localhost:3000

**API 接口**:
- http://localhost:3000/api/bugs - Bug 列表
- http://localhost:3000/api/stats - 统计信息
- http://localhost:3000/api/projects - 项目列表

## 🎯 立即体验

### 方法 1: 浏览器访问（推荐）

1. 打开浏览器访问 http://localhost:3000
2. 点击"提交 Bug"按钮
3. 填写 Bug 信息：
   - 标题：例如"登录页面崩溃"
   - 描述：详细描述问题
   - 项目：选择对应项目
   - 优先级：选择优先级
4. 提交后，系统会自动分析

### 方法 2: 使用测试脚本

```bash
cd ~/Desktop/AIBug
./test-api.sh
```

### 方法 3: 使用 curl

```bash
# 创建 Bug
curl -X POST http://localhost:3000/api/bugs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试 Bug",
    "description": "这是一个测试 Bug",
    "project_id": 1,
    "priority": "medium"
  }'

# 查看 Bug 列表
curl http://localhost:3000/api/bugs

# 触发分析
curl -X POST http://localhost:3000/api/poll
```

## 📋 功能演示流程

### 1️⃣ 提交 Bug
测试人员在网页上提交 Bug，包含标题、描述、项目、优先级

### 2️⃣ 自动轮询
后端每 5 分钟自动扫描未处理的 Bug（可手动触发"立即分析"）

### 3️⃣ AI 分析
OpenClaw 分析项目源码，定位错误位置和原因

### 4️⃣ 生成修复
AI 生成修复代码和说明

### 5️⃣ 应用修复
- 自动模式：直接应用修复（配置 `autoFix: true`）
- 手动模式：开发人员确认后点击"一键修复"

### 6️⃣ 完成
Bug 状态更新为"已修复"，备份文件已创建

## 🔧 配置说明

编辑 `config/config.js` 修改配置：

```javascript
{
  openclaw: {
    pollInterval: 5,    // 轮询间隔（分钟）
    autoFix: true       // 是否自动修复
  },
  
  projects: [
    {
      id: 1,
      name: '美术宝点评网',
      path: '/Users/xwxgs/Desktop/meishubao/dianpingwang/flutter/msbdianping',
      branch: 'dev_1.2.0',
      type: 'flutter'
    }
  ]
}
```

## 🛑 停止服务

找到进程并停止：

```bash
# 查找进程
ps aux | grep "node server.js"

# 停止进程
kill <PID>

# 或使用 pkill
pkill -f "node server.js"
```

## 📊 查看日志

服务运行日志直接在终端显示，或查看 `logs/` 目录

## ⚠️ 注意事项

1. **自动修复风险**: 启用 `autoFix` 后会自动修改源码，建议先在测试环境验证
2. **备份文件**: 每次修复都会创建备份（`.backup.时间戳`），可在 `logs/` 目录查看
3. **项目路径**: 确保 `config.js` 中的项目路径正确且可访问
4. **OpenClaw**: 确保 OpenClaw Gateway 正常运行

## 🎨 界面预览

- 顶部统计卡片：显示各状态 Bug 数量
- 操作栏：提交 Bug、刷新、立即分析、查看统计
- Bug 列表：表格展示所有 Bug，支持状态筛选
- 详情模态框：查看 AI 分析结果和修复代码

## 📞 遇到问题？

1. 检查服务是否运行：`curl http://localhost:3000/api/stats`
2. 查看控制台日志
3. 检查配置文件路径是否正确
4. 确保 Node.js 版本 >= 16

---

**祝使用愉快！** 🎉
