// ==================== 精确 UI 渲染解析模块 ====================
// 用于解析 OC 代码并精确还原 UI 布局

const fs = require('fs');
const path = require('path');

// 预设 UI 模板库
const UI_TEMPLATES = {
  // Banner 轮播图
  'Banner': {
    type: 'UIBannerView',
    height: 282,
    template: 'banner',
    title: '轮播图',
    icon: '🖼️'
  },
  // 菜单网格
  'Menu': {
    type: 'UIMenuView',
    height: 120,
    template: 'menuGrid',
    title: '功能菜单',
    icon: '📱',
    items: 8
  },
  // 进入教室/直播入口
  'EnterRoom': {
    type: 'UIEnterRoomView',
    height: 320,
    template: 'enterRoom',
    title: '进入教室',
    icon: '🚪'
  },
  // 课表
  'ClassSchedule': {
    type: 'UIClassScheduleView',
    height: 180,
    template: 'schedule',
    title: '课程表',
    icon: '📅'
  },
  // 试听课
  'Trail': {
    type: 'UITrailView',
    height: 140,
    template: 'trail',
    title: '试听课',
    icon: '🎬'
  },
  // 学习计划
  'Plan': {
    type: 'UIPlanView',
    height: 160,
    template: 'plan',
    title: '学习计划',
    icon: '📋'
  },
  // 热门课件
  'HotCourseware': {
    type: 'UIHotCoursewareView',
    height: 200,
    template: 'courseware',
    title: '热门课件',
    icon: '📚'
  },
  // Section Header
  'SectionHeader': {
    type: 'UISectionHeaderView',
    height: 44,
    template: 'sectionHeader',
    title: '分区标题',
    icon: '📌'
  },
  // 创建房间
  'CreateRoom': {
    type: 'UICreateRoomView',
    height: 100,
    template: 'createRoom',
    title: '创建房间',
    icon: '➕'
  },
  // 预约直播
  'BookLiveRoom': {
    type: 'UIBookLiveRoomView',
    height: 100,
    template: 'bookLive',
    title: '预约直播',
    icon: '📹'
  },
  // TableView
  'Table': {
    type: 'UITableView',
    height: 400,
    template: 'tableView',
    title: '列表',
    icon: '📋'
  }
};

/**
 * 解析 Masonry 约束
 */
function parseMasonryConstraints(content, viewName) {
  const constraints = {
    top: null,
    bottom: null,
    left: null,
    right: null,
    width: null,
    height: null,
    centerX: null,
    centerY: null,
    offset: null
  };
  
  // 查找 viewName 的 mas_makeConstraints
  // 支持多种格式
  const patterns = [
    new RegExp(`${viewName}\\[mas_makeConstraints:\\s*\\^\\s*\\(\\s*\\{\\s*\\([^)]+\\)\\s*\\{([^}]+)\\}`, 's'),
    new RegExp(`${viewName}\\.mas_makeConstraints\\s*\\(\\s*\\(\\s*\\{\\s*\\([^)]+\\)\\s*\\{([^}]+)\\}`, 's'),
    new RegExp(`${viewName}\\s+\\^\\s*\\(MASConstraintMaker\\s*\\*make\\)\\s*\\{([^}]+)\\}`, 's')
  ];
  
  let constraintBlock = null;
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      constraintBlock = match[1];
      break;
    }
  }
  
  if (constraintBlock) {
    // 解析各个约束
    if (constraintBlock.includes('make.top')) constraints.top = 'top';
    if (constraintBlock.includes('make.bottom')) constraints.bottom = 'bottom';
    if (constraintBlock.includes('make.left')) constraints.left = 'left';
    if (constraintBlock.includes('make.right')) constraints.right = 'right';
    if (constraintBlock.includes('make.centerX')) constraints.centerX = 'centerX';
    if (constraintBlock.includes('make.centerY')) constraints.centerY = 'centerY';
    
    // 解析高度 - 支持多种格式
    const heightPatterns = [
      /make\.height\.equalTo\(@?(\d+(?:\.\d+)?)\)/,
      /make\.height\(\s*@?(\d+(?:\.\d+)?)\s*\)/,
      /make\.size\.equalTo\(CGSizeMake\([^,]+,\s*(\d+(?:\.\d+)?)\)/
    ];
    
    for (const pattern of heightPatterns) {
      const heightMatch = constraintBlock.match(pattern);
      if (heightMatch) {
        constraints.height = parseFloat(heightMatch[1]);
        break;
      }
    }
    
    // 解析宽度
    const widthMatch = constraintBlock.match(/make\.width\.equalTo\(@?(\d+(?:\.\d+)?)\)/);
    if (widthMatch) {
      constraints.width = parseFloat(widthMatch[1]);
    }
    
    // 解析 offset
    const offsetMatch = constraintBlock.match(/offset:\s*\(([^)]+)\)/);
    if (offsetMatch) {
      const offsets = offsetMatch[1].split(',').map(v => parseFloat(v.trim()));
      constraints.offset = {
        top: offsets[0] || 0,
        left: offsets[1] || 0,
        bottom: offsets[2] || 0,
        right: offsets[3] || 0
      };
    }
    
    // 解析 edges
    if (constraintBlock.includes('make.edges')) {
      constraints.edges = 'all';
    }
  }
  
  return constraints;
}

/**
 * 根据类名智能匹配 UI 模板
 */
function matchUITemplate(viewType, viewName, constraints) {
  // 遍历预设模板
  for (const [key, template] of Object.entries(UI_TEMPLATES)) {
    // 匹配类名或变量名
    if (viewType.includes(key) || viewName.toLowerCase().includes(key.toLowerCase())) {
      return {
        ...template,
        viewType: viewType,
        viewName: viewName,
        constraints: constraints,
        // 使用 Masonry 解析的高度，如果没有则使用模板默认值
        height: constraints.height || template.height,
        renderType: 'precise'
      };
    }
  }
  
  // 特殊匹配：ImageView
  if (viewType.includes('ImageView') || viewName.toLowerCase().includes('image')) {
    return {
      type: 'UIImageView',
      viewType: viewType,
      viewName: viewName,
      constraints: constraints,
      height: constraints.height || 150,
      template: 'image',
      title: '图片',
      icon: '🖼️',
      renderType: 'precise'
    };
  }
  
  // 特殊匹配：Button
  if (viewType.includes('Button') || viewName.toLowerCase().includes('button')) {
    return {
      type: 'UIButton',
      viewType: viewType,
      viewName: viewName,
      constraints: constraints,
      height: constraints.height || 44,
      template: 'button',
      title: '按钮',
      icon: '🔘',
      renderType: 'precise'
    };
  }
  
  // 特殊匹配：Label
  if (viewType.includes('Label') || viewName.toLowerCase().includes('label')) {
    return {
      type: 'UILabel',
      viewType: viewType,
      viewName: viewName,
      constraints: constraints,
      height: constraints.height || 30,
      template: 'label',
      title: '文本',
      icon: '📝',
      renderType: 'precise'
    };
  }
  
  // 未匹配到模板，返回通用视图
  return {
    type: 'UICustomView',
    viewType: viewType,
    viewName: viewName,
    constraints: constraints,
    height: constraints.height || 100,
    template: 'custom',
    title: viewType.replace(/View$/, ''),
    icon: '📦',
    renderType: 'precise'
  };
}

/**
 * 解析视图层级（addSubview）
 */
function parseViewHierarchy(content) {
  const viewHierarchy = {};
  
  // 匹配 [parent addSubview:child]
  const addViewRegex = /\[([^[\]]+)\s+addSubview:(\w+)\]/g;
  let match;
  
  while ((match = addViewRegex.exec(content)) !== null) {
    const parentView = match[1].trim();
    const childView = match[2].trim();
    
    if (!viewHierarchy[parentView]) {
      viewHierarchy[parentView] = [];
    }
    viewHierarchy[parentView].push(childView);
  }
  
  return viewHierarchy;
}

/**
 * 解析导航栏标题
 */
function parseNavigationBar(content) {
  const titleMatch = content.match(/self\.title\s*=\s*@"([^"]+)"/);
  if (titleMatch) {
    return { title: titleMatch[1] };
  }
  
  // 尝试从文件名推断
  const fileNameMatch = content.match(/\/\/\s*(\w+\.m)/);
  if (fileNameMatch) {
    const fileName = fileNameMatch[1].replace('.m', '');
    return { title: fileName.replace(/VC$/, '') };
  }
  
  return null;
}

/**
 * 主解析函数
 */
function parseVCFilePrecise(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('文件不存在：' + filePath);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  
  const result = {
    fileName: fileName,
    filePath: filePath,
    parseTime: new Date().toISOString(),
    parseMethod: 'precise',
    ui: {
      navigationBar: null,
      elements: [],
      viewHierarchy: {}
    }
  };
  
  // 1. 解析自定义视图属性（@property）
  const propertyRegex = /@property\s*\([^)]+\)\s*(NS\w+View|\w+View)\s*\*\s*(\w+)/g;
  let propMatch;
  const viewProperties = [];
  
  while ((propMatch = propertyRegex.exec(content)) !== null) {
    const propType = propMatch[1];
    const propName = propMatch[2];
    viewProperties.push({ type: propType, name: propName });
  }
  
  // 2. 解析每个视图的 Masonry 约束并匹配模板
  viewProperties.forEach(prop => {
    const constraints = parseMasonryConstraints(content, prop.name);
    const template = matchUITemplate(prop.type, prop.name, constraints);
    
    // 添加到元素列表
    result.ui.elements.push(template);
  });
  
  // 3. 解析视图层级
  result.ui.viewHierarchy = parseViewHierarchy(content);
  
  // 4. 解析导航栏标题
  result.ui.navigationBar = parseNavigationBar(content);
  
  // 5. 如果没有解析到元素，使用占位数据
  if (result.ui.elements.length === 0) {
    const viewName = fileName.replace(/\.m$/, '').replace(/ViewController/g, '');
    result.ui.navigationBar = { title: viewName || '页面' };
    result.ui.elements = [
      { type: 'UILabel', text: '👋 欢迎使用 ' + viewName, template: 'placeholder', renderType: 'placeholder' },
      { type: 'UITableView', style: 'plain', template: 'placeholder', renderType: 'placeholder' }
    ];
    result.parseMethod = 'placeholder';
  }
  
  return result;
}

// 导出函数
module.exports = {
  parseVCFilePrecise,
  parseMasonryConstraints,
  matchUITemplate,
  parseViewHierarchy,
  parseNavigationBar,
  UI_TEMPLATES
};
