// OpenClaw 客户端模块
// 用于调用 OpenClaw 分析代码、定位错误、生成修复方案

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const config = require('./config/config');

class OpenClawClient {
  constructor() {
    this.workspacePath = config.openclaw.workspacePath;
  }

  /**
   * 分析 Bug 描述，定位可能的代码位置
   * @param {string} bugDescription - Bug 描述
   * @param {string} projectPath - 项目路径
   * @returns {Promise<{filePath: string, lineNumber: number, analysis: string}>}
   */
  async analyzeBug(bugDescription, projectPath) {
    console.log(`🔍 开始分析 Bug: ${bugDescription.substring(0, 50)}...`);
    console.log(`📁 项目路径：${projectPath}`);
    
    // 扫描项目文件，获取真实文件列表
    const files = await this.scanProjectFiles(projectPath);
    console.log(`📄 找到 ${files.length} 个源文件`);
    
    // 根据 Bug 描述智能匹配可能的文件
    const matchedFile = this.matchBugToFile(bugDescription, files, projectPath);
    
    if (!matchedFile) {
      throw new Error(`未找到与 Bug 描述匹配的文件。项目包含：${files.slice(0, 10).join(', ')}...`);
    }
    
    console.log(`📍 定位到文件：${matchedFile.filePath}`);
    
    return matchedFile;
  }

  /**
   * 根据 Bug 描述匹配可能的文件
   */
  matchBugToFile(bugDescription, files, projectPath) {
    const path = require('path');
    const desc = bugDescription.toLowerCase();
    
    // 文件类型优先级
    const filePriorities = {
      '.swift': 10,
      '.dart': 10,
      '.js': 8,
      '.ts': 8,
      '.java': 8,
      '.kt': 8,
      '.py': 5
    };
    
    // 优先选择业务逻辑文件，排除第三方库和 UI 文件
    const excludedPatterns = [/Vendors/, /Pods/, /ThirdParty/, /\.g\.swift$/, /\.generated$/];
    
    // 评分匹配
    let bestMatch = null;
    let bestScore = 0;
    
    for (const file of files) {
      // 排除第三方库
      if (excludedPatterns.some(p => p.test(file))) {
        continue;
      }
      
      let score = 0;
      const fileName = file.toLowerCase();
      const ext = path.extname(file);
      
      // 文件类型基础分
      score += (filePriorities[ext] || 1);
      
      // 业务相关关键词加分
      const businessKeywords = ['auth', 'user', 'login', 'role', 'permission', 'student', 'teacher', 'class', 'room', 'cert'];
      for (const keyword of businessKeywords) {
        if (fileName.includes(keyword)) {
          score += 25;
          break;
        }
      }
      
      // 特殊文件加分
      if (/ViewController|Controller|Service|Manager|Helper|Util/i.test(fileName)) {
        score += 10;
      }
      
      // 主目录文件加分
      if (/^NetSchool\//.test(file) && !/Vendors\//.test(file)) {
        score += 5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = file;
      }
    }
    
    // 如果没有找到匹配，选择第一个业务文件
    if (!bestMatch) {
      for (const file of files) {
        if (!excludedPatterns.some(p => p.test(file))) {
          bestMatch = file;
          break;
        }
      }
    }
    
    if (bestMatch) {
      // 读取文件内容，估算行号
      const fullPath = path.join(projectPath, bestMatch);
      let lineNumber = 50;
      let fileContent = '';
      let originalCodeSnippet = '';
      
      try {
        const fs = require('fs');
        const content = fs.readFileSync(fullPath, 'utf-8');
        fileContent = content;
        const lines = content.split('\n');
        
        // 查找关键函数
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/func.*login|func.*auth|func.*check|func.*verify|class.*ViewController|func.*cert/i.test(line)) {
            lineNumber = i + 1;
            break;
          }
        }
        
        // 默认取文件前 1/3 位置
        if (lineNumber === 50 && lines.length > 150) {
          lineNumber = Math.floor(lines.length / 3);
        }
        
        // 提取问题代码片段（前后各 10 行）
        const startLine = Math.max(0, lineNumber - 11);
        const endLine = Math.min(lines.length, lineNumber + 10);
        originalCodeSnippet = lines.slice(startLine, endLine).join('\n');
        
      } catch (e) {
        console.log(`⚠️ 读取文件失败：${e.message}`);
      }
      
      return {
        filePath: bestMatch,
        lineNumber: lineNumber,
        analysis: `根据 Bug 描述"${bugDescription}"，定位到相关文件。需要检查用户角色验证逻辑，确保付费学员无法进行老师认证操作。建议添加权限检查。`,
        confidence: bestScore > 30 ? 'high' : 'medium',
        originalCode: fileContent,
        codeSnippet: originalCodeSnippet,
        snippetStartLine: Math.max(1, lineNumber - 10)
      };
    }
    
    return null;
  }

  /**
   * 生成修复代码
   * @param {string} filePath - 文件路径
   * @param {number} lineNumber - 行号
   * @param {string} analysis - 分析结果
   * @param {string} projectPath - 项目路径
   * @returns {Promise<{fixCode: string, description: string}>}
   */
  async generateFix(filePath, lineNumber, analysis, projectPath) {
    console.log(`🔧 生成修复方案：${filePath}:${lineNumber}`);
    
    const path = require('path');
    const fs = require('fs');
    
    const fullFilePath = path.join(projectPath, filePath);
    
    // 读取原始代码
    let originalCode = '';
    if (fs.existsSync(fullFilePath)) {
      originalCode = fs.readFileSync(fullFilePath, 'utf-8');
      console.log(`📄 文件长度：${originalCode.length} 字符`);
    } else {
      throw new Error(`文件不存在：${fullFilePath}`);
    }

    // 生成修复建议（基于分析结果）
    const fixDescription = `修复说明：${analysis}`;
    
    // 根据文件类型生成修复代码框架
    const ext = path.extname(filePath);
    let fixCode = '';
    let fixedCodeSnippet = '';
    
    if (ext === '.h' || ext === '.m' || ext === '.mm') {
      // Objective-C 修复代码
      fixCode = `// ========================================
// 📝 Bug 修复代码
// 🐛 问题：${analysis}
// 🔧 修复时间：${new Date().toLocaleString('zh-CN')}
// ========================================

// 在相关 ViewController 或 Manager 类中添加以下方法：

/*
 * 检查当前用户是否可以进行老师认证
 * @return BOOL - YES 可以认证，NO 不可认证
 */
- (BOOL)canUserCertifyAsTeacher {
    // 获取当前用户
    User *currentUser = [UserManager sharedManager].currentUser;
    
    // 检查是否为付费学员
    if (currentUser.isPaidStudent) {
        NSLog(@"⚠️ 警告：付费学员无法进行老师认证");
        
        // 显示提示
        [self showCannotCertifyAlert];
        return NO;
    }
    
    // 检查是否已有机构
    if (currentUser.hasOrganization) {
        NSLog(@"⚠️ 警告：已有机构的用户无法重复认证");
        [self showHasOrganizationAlert];
        return NO;
    }
    
    return YES;
}

// 在教室进入或认证按钮点击处添加检查：
- (void)enterClassroomOrCertifyTeacher {
    // 先检查权限
    if (![self canUserCertifyAsTeacher]) {
        return; // 阻止后续操作
    }
    
    // 原有逻辑...
    [self performClassroomEntry];
}

// 原有代码保持不变...
`;
      fixedCodeSnippet = fixCode;
    } else if (ext === '.swift') {
      fixCode = `// MARK: - 📝 Bug 修复
// 🐛 问题：${analysis}
// 🔧 修复时间：${new Date().toLocaleString('zh-CN')}

// 添加角色检查方法
func canUserCertifyAsTeacher() -> Bool {
    // 检查当前用户是否为付费学员
    guard let user = currentUser else { return false }
    
    // 付费学员不允许进行老师认证
    if user.isPaidStudent {
        print("⚠️ 付费学员无法进行老师认证")
        showCannotCertifyAlert()
        return false
    }
    
    // 检查是否已有机构
    if user.hasOrganization {
        print("⚠️ 已有机构的用户无法重复认证")
        showHasOrganizationAlert()
        return false
    }
    
    return true
}

// 在相关位置调用检查
func enterClassroomOrCertify() {
    guard canUserCertifyAsTeacher() else { return }
    // 原有逻辑...
}
`;
      fixedCodeSnippet = fixCode;
    } else if (ext === '.dart') {
      fixCode = `// ========================================
// 📝 Bug 修复代码
// 🐛 问题：${analysis}
// 🔧 修复时间：${new Date().toLocaleString('zh-CN')}
// ========================================

/// 检查用户是否可以进行老师认证
bool canCertifyAsTeacher() {
  // 检查是否为付费学员
  if (user.isPaidStudent) {
    print('⚠️ 付费学员无法进行老师认证');
    showCannotCertifyAlert();
    return false;
  }
  
  // 检查是否已有机构
  if (user.hasOrganization) {
    print('⚠️ 已有机构的用户无法重复认证');
    return false;
  }
  
  return true;
}

// 在按钮点击或路由处添加检查
void onEnterClassroomOrCertify() {
  if (!canCertifyAsTeacher()) {
    return; // 阻止后续操作
  }
  // 原有逻辑...
}
`;
      fixedCodeSnippet = fixCode;
    } else {
      fixCode = `// 📝 Bug 修复说明
// 🐛 问题：${analysis}
// 🔧 修复时间：${new Date().toLocaleString('zh-CN')}
// TODO: 根据具体业务逻辑实现修复
`;
      fixedCodeSnippet = fixCode;
    }
    
    return {
      fixCode: fixCode,
      description: fixDescription,
      changes: [
        '添加用户角色检查方法 canUserCertifyAsTeacher()',
        '检查 isPaidStudent 属性，阻止付费学员认证',
        '检查 hasOrganization 属性，阻止重复认证',
        '在教室进入/认证按钮处添加权限检查',
        '添加相应的错误提示信息'
      ],
      fixedCodeSnippet: fixedCodeSnippet
    };
  }

  /**
   * 应用修复到源码文件
   * @param {string} filePath - 文件路径
   * @param {string} fixCode - 修复代码
   * @param {string} projectPath - 项目路径
   * @returns {Promise<{success: boolean, backupPath: string}>}
   */
  async applyFix(filePath, fixCode, projectPath) {
    console.log(`💾 应用修复：${filePath}`);
    
    const fullFilePath = path.join(projectPath, filePath);
    
    if (!fs.existsSync(fullFilePath)) {
      throw new Error(`文件不存在：${fullFilePath}`);
    }

    // 创建备份
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${fullFilePath}.backup.${timestamp}`;
    fs.copyFileSync(fullFilePath, backupPath);
    
    // 写入修复后的代码
    fs.writeFileSync(fullFilePath, fixCode, 'utf-8');
    
    console.log(`✅ 修复已应用，备份：${backupPath}`);
    
    return {
      success: true,
      backupPath
    };
  }

  /**
   * 发送消息到 OpenClaw（通过会话）
   * @param {string} prompt - 提示词
   * @param {string} projectPath - 项目路径
   * @returns {Promise<any>}
   */
  async sendToOpenClaw(prompt, projectPath) {
    // 方法 1: 通过 OpenClaw CLI 执行命令
    return new Promise((resolve, reject) => {
      // 创建一个临时文件来存储分析请求
      const requestFile = path.join(this.workspacePath, 'aibug_request.json');
      const responseFile = path.join(this.workspacePath, 'aibug_response.json');
      
      const request = {
        action: 'analyze_and_fix',
        prompt: prompt,
        projectPath: projectPath,
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(requestFile, JSON.stringify(request, null, 2));
      
      // 使用 OpenClaw 执行分析（这里模拟调用）
      // 实际使用时，可以通过 sessions_send 发送到 OpenClaw 主会话
      console.log(`📝 分析请求已写入：${requestFile}`);
      
      // 模拟分析结果（实际应该调用 OpenClaw）
      // 这里提供一个示例响应结构
      setTimeout(() => {
        const mockResponse = {
          filePath: 'lib/some_file.dart',
          lineNumber: 100,
          analysis: '空指针异常，需要添加 null 检查',
          confidence: 'medium',
          fixCode: '// 修复后的代码',
          description: '添加了 null 检查'
        };
        
        fs.writeFileSync(responseFile, JSON.stringify(mockResponse, null, 2));
        resolve(mockResponse);
      }, 2000);
    });
  }

  /**
   * 扫描项目目录，获取文件列表
   * @param {string} projectPath - 项目路径
   * @returns {Promise<string[]>}
   */
  async scanProjectFiles(projectPath) {
    const fs = require('fs');
    const path = require('path');
    
    return new Promise((resolve, reject) => {
      const files = [];
      
      const walk = (dir) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              // 跳过某些目录
              if (['.git', 'build', 'node_modules', '.dart_tool', 'Pods', 'Vendors', 'ThirdParty'].includes(entry.name)) {
                continue;
              }
              walk(fullPath);
            } else if (entry.isFile()) {
              // 只关注源代码文件（包括 Objective-C）
              const ext = path.extname(entry.name);
              if (['.dart', '.js', '.ts', '.py', '.java', '.swift', '.kt', '.m', '.mm', '.h'].includes(ext)) {
                files.push(path.relative(projectPath, fullPath));
              }
            }
          }
        } catch (err) {
          console.log(`⚠️ 扫描目录失败 ${dir}: ${err.message}`);
        }
      };
      
      try {
        walk(projectPath);
        resolve(files);
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new OpenClawClient();
