// AIBug 配置文件示例
// 复制此文件为 config.js 并修改为你的实际配置

module.exports = {
  // 服务器配置
  server: {
    port: 3000,           // 服务端口
    host: '0.0.0.0'       // 监听地址（0.0.0.0 允许外部访问）
  },

  // 数据库配置
  database: {
    path: './data/aibug.db'  // SQLite 数据库路径
  },

  // OpenClaw 配置
  openclaw: {
    workspacePath: '/path/to/openclaw/workspace',  // OpenClaw 工作目录
    pollInterval: 5,      // 轮询间隔（分钟）
    autoFix: false        // 是否启用自动修复（false=需要手动确认）
  },

  // 项目源码配置
  projects: [
    {
      id: 1,
      name: '点评网客户端',
      display_name: '点评网项目',
      path: '/path/to/your/dianpingwang',  // 修改为你的项目路径
      branch: 'dev_1.2.0',
      type: 'flutter',
      parent_id: null
    },
    {
      id: 2,
      name: '网校 iOS',
      display_name: '网校项目',
      path: '/path/to/your/netschool',  // 修改为你的项目路径
      branch: 'dev',
      type: 'ios',
      parent_id: null
    },
    {
      id: 3,
      name: '网校服务端',
      display_name: '网校项目',
      path: '/path/to/your/NetSService',  // 修改为你的项目路径
      branch: 'master',
      type: 'nodejs',
      parent_id: 2
    }
  ],

  // 日志配置
  logging: {
    path: './logs',
    level: 'info'
  }
};
