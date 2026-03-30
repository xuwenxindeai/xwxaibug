// 定时轮询服务
// 自动扫描未处理的 Bug，调用 OpenClaw 分析并修复

const schedule = require('node-schedule');
const db = require('./database');
const openclaw = require('./openclaw-client');
const config = require('./config/config');
const fs = require('fs');
const path = require('path');

class BugPoller {
  constructor() {
    this.isRunning = false;
    this.pollInterval = config.openclaw.pollInterval; // 分钟
  }

  /**
   * 启动轮询服务
   */
  start() {
    console.log(`🕐 启动 Bug 轮询服务，间隔：${this.pollInterval} 分钟`);
    
    // 每分钟检查一次
    schedule.scheduleJob('* * * * *', async () => {
      if (this.isRunning) {
        console.log('⏳ 上一轮分析仍在进行中，跳过本次轮询');
        return;
      }
      
      await this.poll();
    });

    console.log('✅ 轮询服务已启动');
  }

  /**
   * 执行一次轮询
   */
  async poll() {
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('\n📋 开始轮询未处理的 Bug...');
      
      // 获取所有未处理的 Bug
      const pendingBugs = db.bugs.getPending();
      
      if (pendingBugs.length === 0) {
        console.log('✨ 没有未处理的 Bug');
        return;
      }
      
      console.log(`📊 发现 ${pendingBugs.length} 个待处理 Bug`);
      
      // 逐个处理
      for (const bug of pendingBugs) {
        await this.processBug(bug);
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ 轮询完成，耗时：${duration}秒`);
      
    } catch (error) {
      console.error('❌ 轮询出错:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 处理单个 Bug
   */
  async processBug(bug) {
    console.log(`\n🐛 处理 Bug #${bug.id}: ${bug.title}`);
    
    try {
      // 更新状态为分析中
      db.bugs.updateStatus(bug.id, 'analyzing');
      db.logs.add(bug.id, 'status_change', '开始分析');
      
      // 获取项目路径
      const project = config.projects.find(p => p.id === bug.project_id);
      if (!project) {
        throw new Error('未找到关联的项目配置');
      }
      
      console.log(`📁 项目：${project.name} (${project.path})`);
      
      // 步骤 1: 分析 Bug，定位代码位置
      console.log('🔍 步骤 1: 分析 Bug 定位代码...');
      const analysis = await openclaw.analyzeBug(bug.description, project.path);
      
      // 保存分析结果
      db.bugs.updateLocation(bug.id, analysis.filePath, analysis.lineNumber);
      db.logs.add(bug.id, 'analysis', JSON.stringify(analysis));
      
      console.log(`📍 定位到：${analysis.filePath}:${analysis.lineNumber}`);
      console.log(`💡 分析：${analysis.analysis}`);
      
      // 步骤 2: 生成修复代码
      console.log('🔧 步骤 2: 生成修复代码...');
      const fixResult = await openclaw.generateFix(
        analysis.filePath,
        analysis.lineNumber,
        analysis.analysis,
        project.path
      );
      
      console.log('📊 修复结果:', JSON.stringify({
        hasFixCode: !!fixResult.fixCode,
        hasSnippet: !!fixResult.fixedCodeSnippet,
        hasChanges: !!fixResult.changes
      }, null, 2));
      
      // 保存修复代码和代码片段
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
      
      db.logs.add(bug.id, 'fix_generated', JSON.stringify(fixResult));
      
      console.log(`✅ 修复方案已生成`);
      console.log(`📝 说明：${fixResult.description}`);
      
      // 步骤 3: 如果启用自动修复，直接应用
      if (config.openclaw.autoFix) {
        console.log('🚀 步骤 3: 自动应用修复...');
        
        const applyResult = await openclaw.applyFix(
          analysis.filePath,
          fixResult.fixCode,
          project.path
        );
        
        // 标记为已修复
        db.bugs.markAsFixed(bug.id);
        db.logs.add(bug.id, 'fix_applied', JSON.stringify(applyResult));
        
        console.log(`✅ Bug #${bug.id} 已自动修复！`);
        console.log(`💾 备份：${applyResult.backupPath}`);
      } else {
        console.log('⏸️ 自动修复已禁用，等待手动确认');
      }
      
    } catch (error) {
      console.error(`❌ Bug #${bug.id} 处理失败：${error.message}`);
      db.bugs.updateStatus(bug.id, 'error', error.message);
      db.logs.add(bug.id, 'error', error.message);
    }
  }

  /**
   * 手动触发一次轮询
   */
  async triggerManual() {
    if (this.isRunning) {
      return { success: false, message: '轮询已在运行中' };
    }
    
    await this.poll();
    return { success: true, message: '轮询完成' };
  }
}

module.exports = new BugPoller();
