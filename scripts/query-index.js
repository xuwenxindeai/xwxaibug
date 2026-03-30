#!/usr/bin/env node
/**
 * 项目索引查询工具
 * 根据关键词搜索相关的文件、类、方法
 */

const index = require('../project-index.json');

/**
 * 搜索索引
 * @param {string} query - 搜索关键词
 * @param {string} projectName - 项目名称（可选）
 * @returns {Array} 匹配结果
 */
function search(query, projectName = null) {
  const queryLower = query.toLowerCase();
  const results = [];
  
  const projects = projectName 
    ? [index.projects[projectName]].filter(Boolean)
    : Object.values(index.projects);
  
  for (const project of projects) {
    for (const file of project.files) {
      let score = 0;
      const matches = {
        classes: [],
        methods: [],
        keywords: []
      };
      
      // 匹配类名
      for (const cls of file.classes) {
        if (cls.toLowerCase().includes(queryLower)) {
          score += 10;
          matches.classes.push(cls);
        }
      }
      
      // 匹配方法名
      for (const method of file.methods) {
        if (method.toLowerCase().includes(queryLower)) {
          score += 5;
          matches.methods.push(method);
        }
      }
      
      // 匹配关键词
      for (const keyword of file.keywords) {
        if (keyword.includes(queryLower)) {
          score += 3;
          matches.keywords.push(keyword);
        }
      }
      
      if (score > 0) {
        results.push({
          project: project.name,
          path: file.path,
          score,
          matches
        });
      }
    }
  }
  
  // 按分数排序
  return results.sort((a, b) => b.score - a.score);
}

/**
 * 智能匹配 Bug 描述到文件
 * @param {string} bugDescription - Bug 描述
 * @param {string} projectName - 项目名称
 * @returns {Object} 最佳匹配
 */
function matchBug(bugDescription, projectName = null) {
  // 提取 Bug 描述中的关键词
  const keywords = bugDescription
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
    .split(/[\s,，.]+/)
    .filter(w => w.length >= 2);
  
  console.log('🔍 提取关键词:', keywords);
  
  // 搜索每个关键词
  const allResults = [];
  for (const keyword of keywords) {
    const results = search(keyword, projectName);
    allResults.push(...results);
  }
  
  // 聚合分数
  const aggregated = {};
  for (const result of allResults) {
    const key = `${result.project}/${result.path}`;
    if (!aggregated[key]) {
      aggregated[key] = {
        ...result,
        totalScore: 0,
        matchedKeywords: []
      };
    }
    aggregated[key].totalScore += result.score;
    aggregated[key].matchedKeywords.push(...result.matches.keywords);
  }
  
  // 转换为数组并排序
  const sorted = Object.values(aggregated)
    .sort((a, b) => b.totalScore - a.totalScore);
  
  return {
    keywords,
    results: sorted.slice(0, 10), // 返回前 10 个匹配
    bestMatch: sorted[0] || null
  };
}

// CLI 模式
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('用法：node query-index.js <关键词> [项目名称]');
    console.log('示例：');
    console.log('  node query-index.js "认证老师"');
    console.log('  node query-index.js "login" "网校 iOS"');
    process.exit(0);
  }
  
  const query = args[0];
  const projectName = args[1];
  
  console.log(`🔍 搜索：${query}`);
  if (projectName) console.log(`📁 项目：${projectName}`);
  console.log('');
  
  const results = search(query, projectName);
  
  console.log(`找到 ${results.length} 个匹配:\n`);
  for (const result of results.slice(0, 20)) {
    console.log(`分数：${result.score}`);
    console.log(`项目：${result.project}`);
    console.log(`路径：${result.path}`);
    if (result.matches.classes.length > 0) {
      console.log(`类：${result.matches.classes.join(', ')}`);
    }
    if (result.matches.methods.length > 0) {
      console.log(`方法：${result.matches.methods.slice(0, 5).join(', ')}...`);
    }
    console.log('');
  }
}

module.exports = { search, matchBug };
