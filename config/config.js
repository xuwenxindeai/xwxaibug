// AIBug 平台配置文件

module.exports = {
  // 服务器配置
  server: {
    port: 3000,
    host: '0.0.0.0'  // 监听所有网络接口，允许外部访问
  },

  // 数据库配置
  database: {
    path: './data/aibug.db'
  },

  // OpenClaw 配置
  openclaw: {
    // OpenClaw workspace 路径
    workspacePath: '/Users/xwxgs/.openclaw/workspace',
    // 轮询间隔（分钟）
    pollInterval: 5,
    // 是否启用自动修复
    autoFix: false  // 已关闭自动修复，需要手动确认修复
  },

  // 项目源码配置（需要分析的项目路径）
  projects: [
    {
      id: 1,
      name: '点评网客户端',
      display_name: '点评网项目',
      path: '/Users/xwxgs/Desktop/meishubao/dianpingwang/flutter/msbdianping',
      branch: 'dev_1.2.0',
      type: 'flutter',
      parent_id: null
    },
    {
      id: 2,
      name: '网校 iOS',
      display_name: '网校项目',
      path: '/Users/xwxgs/Desktop/meishubao/netschool',
      branch: 'dev',
      type: 'ios',
      parent_id: null
    },
    {
      id: 3,
      name: '网校服务端',
      display_name: '网校项目',
      path: '/Users/xwxgs/Desktop/meishubao/NetSService/artgem-online-school-app',
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
