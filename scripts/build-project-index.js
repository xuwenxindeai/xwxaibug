#!/usr/bin/env node
/**
 * 项目代码索引构建工具
 * 扫描项目文件，提取类名、方法名、关键词
 */

const fs = require('fs');
const path = require('path');

// 配置
const PROJECTS = [
  {
    id: 2,
    name: '网校 iOS',
    path: '/Users/xwxgs/Desktop/AIBug/workspace/netschool',
    extensions: ['.m', '.h', '.swift'],
    excludeDirs: ['Pods', 'Vendors', '.git', 'build']
  },
  {
    id: 3,
    name: '网校服务端',
    path: '/Users/xwxgs/Desktop/AIBug/workspace/NetSService/artgem-online-school-app',
    extensions: ['.java', '.js', '.ts'],
    excludeDirs: ['node_modules', '.git', 'dist', 'build', 'target', '.mvn']
  }
];

/**
 * 扫描项目文件
 */
function scanFiles(projectPath, extensions, excludeDirs) {
  const files = [];
  
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!excludeDirs.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(path.relative(projectPath, fullPath));
        }
      }
    }
  }
  
  walk(projectPath);
  return files;
}

/**
 * 从 Objective-C 文件提取类名和方法
 */
function extractObjCInfo(filePath, content) {
  const info = {
    classes: [],
    methods: [],
    keywords: []
  };
  
  // 提取类名：@interface ClassName 或 @implementation ClassName
  const classRegex = /@(?:interface|implementation)\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    info.classes.push(match[1]);
  }
  
  // 提取方法名：- (returnType)methodName 或 + (returnType)methodName
  const methodRegex = /[-+]\s*\([^)]*\)\s*(\w+)/g;
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    if (!['init', 'alloc', 'new', 'description', 'dealloc'].includes(methodName)) {
      info.methods.push(methodName);
    }
  }
  
  // 提取关键词（从文件名）
  const fileName = path.basename(filePath, path.extname(filePath));
  info.keywords = fileName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 2);
  
  return info;
}

/**
 * 从 Java 文件提取信息
 */
function extractJavaInfo(filePath, content) {
  const info = {
    classes: [],
    methods: [],
    keywords: []
  };
  
  // 提取类名：public class ClassName 或 class ClassName
  const classRegex = /(?:public\s+)?(?:class|interface|enum|@interface)\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    info.classes.push(match[1]);
  }
  
  // 提取方法名：public void methodName( 或 private String methodName(
  const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<\w+>)?)?\s+(\w+)\s*\(/g;
  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    if (!['if', 'for', 'while', 'switch', 'catch', 'toString', 'equals', 'hashCode'].includes(methodName)) {
      info.methods.push(methodName);
    }
  }
  
  // 提取关键词
  const fileName = path.basename(filePath, path.extname(filePath));
  info.keywords = fileName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 2);
  
  return info;
}

/**
 * 从 JavaScript/TypeScript 文件提取信息
 */
function extractJSInfo(filePath, content) {
  const info = {
    classes: [],
    methods: [],
    keywords: []
  };
  
  // 提取类名：class ClassName
  const classRegex = /class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    info.classes.push(match[1]);
  }
  
  // 提取函数名：function name( 或 const name = ( 或 name(
  const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(|(\w+)\s*\([^)]*\)\s*:)/g;
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1] || match[2] || match[3];
    if (funcName && !['if', 'for', 'while', 'switch', 'catch'].includes(funcName)) {
      info.methods.push(funcName);
    }
  }
  
  // 提取模块导出
  const exportRegex = /(?:module\.exports|export\s+(?:default|const|function))\s+(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    if (!info.classes.includes(match[1])) {
      info.classes.push(match[1]);
    }
  }
  
  // 提取关键词（从文件名）
  const fileName = path.basename(filePath, path.extname(filePath));
  info.keywords = fileName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 2);
  
  return info;
}

/**
 * 从 Swift 文件提取信息
 */
function extractSwiftInfo(filePath, content) {
  const info = {
    classes: [],
    methods: [],
    keywords: []
  };
  
  // 提取类名：class ClassName 或 struct StructName
  const classRegex = /(class|struct|enum|protocol|extension)\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    info.classes.push(match[2]);
  }
  
  // 提取方法名：func methodName
  const methodRegex = /func\s+(\w+)/g;
  while ((match = methodRegex.exec(content)) !== null) {
    info.methods.push(match[1]);
  }
  
  // 提取关键词
  const fileName = path.basename(filePath, path.extname(filePath));
  info.keywords = fileName
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 2);
  
  return info;
}

/**
 * 构建项目索引
 */
function buildIndex() {
  console.log('🚀 开始构建项目索引...\n');
  
  const index = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    projects: {}
  };
  
  for (const project of PROJECTS) {
    console.log(`📁 扫描 ${project.name}...`);
    
    // 扫描文件
    const files = scanFiles(project.path, project.extensions, project.excludeDirs);
    console.log(`   找到 ${files.length} 个源文件`);
    
    // 提取信息
    const fileInfo = [];
    let totalClasses = 0;
    let totalMethods = 0;
    
    for (const file of files) {
      const fullPath = path.join(project.path, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const ext = path.extname(file);
      
      let info;
      if (['.m', '.h'].includes(ext)) {
        info = extractObjCInfo(file, content);
      } else if (ext === '.java') {
        info = extractJavaInfo(file, content);
      } else if (['.js', '.ts'].includes(ext)) {
        info = extractJSInfo(file, content);
      } else if (ext === '.swift') {
        info = extractSwiftInfo(file, content);
      }
      
      if (info && (info.classes.length > 0 || info.methods.length > 0)) {
        fileInfo.push({
          path: file,
          ...info
        });
        totalClasses += info.classes.length;
        totalMethods += info.methods.length;
      }
    }
    
    index.projects[project.name] = {
      id: project.id,
      path: project.path,
      type: project.extensions.join(','),
      fileCount: files.length,
      indexedFiles: fileInfo.length,
      totalClasses,
      totalMethods,
      files: fileInfo
    };
    
    console.log(`   ✅ 索引 ${fileInfo.length} 个文件，${totalClasses} 个类，${totalMethods} 个方法\n`);
  }
  
  // 保存索引
  const outputPath = path.join(__dirname, '..', 'project-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');
  
  console.log(`📊 索引已保存到：${outputPath}`);
  console.log(`💾 文件大小：${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
  
  return index;
}

// 执行
if (require.main === module) {
  buildIndex();
}

module.exports = { buildIndex };
