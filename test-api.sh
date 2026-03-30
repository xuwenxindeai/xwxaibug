#!/bin/bash

# AIBug 平台测试脚本

BASE_URL="http://localhost:3000"

echo "🧪 AIBug 平台 API 测试"
echo "===================="
echo ""

# 1. 获取统计信息
echo "📊 获取统计信息..."
curl -s "$BASE_URL/api/stats" | jq .
echo ""

# 2. 获取项目列表
echo "📁 获取项目列表..."
curl -s "$BASE_URL/api/projects" | jq .
echo ""

# 3. 创建测试 Bug
echo "🐛 创建测试 Bug..."
curl -s -X POST "$BASE_URL/api/bugs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "登录页面空指针异常",
    "description": "用户在未输入密码的情况下点击登录按钮，应用崩溃。错误日志显示 NullPointerException 在 LoginActivity.java 第 156 行。",
    "project_id": 1,
    "project_name": "美术宝点评网",
    "priority": "high"
  }' | jq .
echo ""

# 4. 获取 Bug 列表
echo "📋 获取 Bug 列表..."
curl -s "$BASE_URL/api/bugs" | jq .
echo ""

# 5. 触发手动轮询
echo "🔄 触发手动轮询..."
curl -s -X POST "$BASE_URL/api/poll" | jq .
echo ""

echo "✅ 测试完成！"
echo ""
echo "📍 访问前端页面：http://localhost:3000"
