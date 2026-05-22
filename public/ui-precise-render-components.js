// ==================== 精确 UI 渲染组件 ====================

/**
 * 渲染 Banner 轮播图
 */
function renderBannerView(element) {
  const height = element.height || 282;
  return `
    <div style="height: ${height}px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin: 12px; overflow: hidden; position: relative;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 8px;">🎠</div>
        <div style="font-size: 16px; font-weight: 600;">${element.title || '轮播图'}</div>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${element.viewName || 'BannerView'}</div>
      </div>
      <!-- 分页指示器 -->
      <div style="position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px;">
        <div style="width: 8px; height: 8px; background: rgba(255,255,255,0.9); border-radius: 4px;"></div>
        <div style="width: 8px; height: 8px; background: rgba(255,255,255,0.5); border-radius: 4px;"></div>
        <div style="width: 8px; height: 8px; background: rgba(255,255,255,0.5); border-radius: 4px;"></div>
      </div>
    </div>
  `;
}

/**
 * 渲染菜单网格
 */
function renderMenuGrid(element) {
  const items = element.items || 8;
  const icons = ['📚', '📅', '👨‍🏫', '📊', '💬', '⚙️', '📁', '❓'];
  const labels = ['课件', '课表', '老师', '报告', '消息', '设置', '资料', '帮助'];
  
  return `
    <div style="background: white; border-radius: 12px; margin: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; display: flex; align-items: center;">
        <span style="margin-right: 6px;">${element.icon || '📱'}</span>
        ${element.title || '功能菜单'}
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
        ${Array.from({ length: items }).map((_, i) => `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              ${icons[i] || '📱'}
            </div>
            <div style="font-size: 11px; color: #666;">${labels[i] || '功能'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 渲染进入教室/直播入口
 */
function renderEnterRoomView(element) {
  return `
    <div style="height: ${element.height || 320}px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; margin: 12px; overflow: hidden; position: relative;">
      <!-- 背景装饰 -->
      <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
      <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
      
      <!-- 主要内容 -->
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; text-align: center; width: 80%;">
        <div style="font-size: 56px; margin-bottom: 12px;">🚪</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${element.title || '进入教室'}</div>
        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 24px;">${element.viewName || 'EnterRoomView'}</div>
        
        <!-- 进入按钮 -->
        <div style="background: white; color: #f5576c; padding: 14px 48px; border-radius: 28px; font-size: 18px; font-weight: 600; display: inline-block; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
          立即进入
        </div>
        
        <!-- 状态信息 -->
        <div style="margin-top: 20px; font-size: 12px; opacity: 0.8;">
          <span style="margin: 0 8px;">🟢 直播中</span>
          <span style="margin: 0 8px;">👥 128 人在线</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染课程表
 */
function renderSchedule(element) {
  const days = ['一', '二', '三', '四', '五', '六', '日'];
  const today = new Date().getDay() - 1;
  
  return `
    <div style="background: white; border-radius: 12px; margin: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>${element.icon || '📅'}</span>
          <span>${element.title || '课程表'}</span>
        </div>
        <div style="font-size: 12px; color: #999;">${element.viewName || 'ClassScheduleView'}</div>
      </div>
      
      <!-- 星期 -->
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px;">
        ${days.map((day, i) => `
          <div style="text-align: center; font-size: 12px; color: ${i === today ? '#667eea' : '#999'}; font-weight: ${i === today ? '600' : '400'};">
            ${i === today ? '今' : day}
          </div>
        `).join('')}
      </div>
      
      <!-- 课程卡片 -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 12px; color: white;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">数学提高班</div>
        <div style="font-size: 12px; opacity: 0.9;">今天 19:00-20:30</div>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">👨‍🏫 王老师</div>
      </div>
    </div>
  `;
}

/**
 * 渲染试听课
 */
function renderTrail(element) {
  return `
    <div style="height: ${element.height || 140}px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 12px; margin: 12px; overflow: hidden; position: relative; display: flex; align-items: center;">
      <div style="width: 120px; height: 100%; background: rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;">
        <div style="font-size: 48px;">🎬</div>
      </div>
      <div style="flex: 1; padding: 16px; color: white;">
        <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${element.title || '试听课'}</div>
        <div style="font-size: 12px; opacity: 0.9; margin-bottom: 8px;">${element.viewName || 'TrailView'}</div>
        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; font-size: 12px;">
          ✨ 免费试听
        </div>
      </div>
      <div style="padding-right: 16px;">
        <div style="width: 36px; height: 36px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #11998e; font-size: 16px;">
          ▶
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染学习计划
 */
function renderPlan(element) {
  const tasks = [
    { title: '完成第一章学习', progress: 100, color: '#38ef7d' },
    { title: '完成课后练习', progress: 60, color: '#667eea' },
    { title: '参加单元测试', progress: 0, color: '#f093fb' }
  ];
  
  return `
    <div style="height: ${element.height || 160}px; background: white; border-radius: 12px; margin: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow-y: auto;">
      <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <span>${element.icon || '📋'}</span>
        <span>${element.title || '学习计划'}</span>
        <span style="margin-left: auto; font-size: 12px; color: #999;">${element.viewName || 'PlanView'}</span>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${tasks.map(task => `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
              <span>${task.title}</span>
              <span>${task.progress}%</span>
            </div>
            <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
              <div style="width: ${task.progress}%; height: 100%; background: ${task.color}; border-radius: 3px; transition: width 0.3s;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 渲染热门课件
 */
function renderCourseware(element) {
  const courses = [
    { title: '数学提高班', students: 1280, icon: '📐' },
    { title: '英语强化班', students: 956, icon: '🔤' },
    { title: '物理竞赛班', students: 742, icon: '⚡' }
  ];
  
  return `
    <div style="height: ${element.height || 200}px; background: white; border-radius: 12px; margin: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow-y: auto;">
      <div style="font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <span>${element.icon || '📚'}</span>
        <span>${element.title || '热门课件'}</span>
        <span style="margin-left: auto; font-size: 12px; color: #999;">${element.viewName || 'HotCoursewareView'}</span>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${courses.map((course, i) => `
          <div style="display: flex; align-items: center; gap: 12px; padding: 8px; background: #f8f9fa; border-radius: 8px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ${course.icon}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 600; color: #333;">${course.title}</div>
              <div style="font-size: 12px; color: #999;">👥 ${course.students}人在学</div>
            </div>
            <div style="font-size: 12px; color: #667eea; font-weight: 600;">
              ${i === 0 ? '🔥 热门' : '查看详情'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 渲染分区标题
 */
function renderSectionHeader(element) {
  return `
    <div style="height: ${element.height || 44}px; display: flex; align-items: center; padding: 0 16px; background: #f8f9fa; margin: 8px 0;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 4px; height: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 2px;"></div>
        <div style="font-size: 14px; font-weight: 600; color: #333;">${element.title || '分区标题'}</div>
        <div style="font-size: 12px; color: #999; margin-left: 8px;">${element.viewName || 'SectionHeaderView'}</div>
      </div>
    </div>
  `;
}

/**
 * 渲染自定义视图
 */
function renderCustomView(element) {
  return `
    <div style="height: ${element.height || 100}px; background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%); border-radius: 12px; margin: 12px; display: flex; align-items: center; justify-content: center; border: 2px dashed #ccc;">
      <div style="text-align: center; color: #999;">
        <div style="font-size: 36px; margin-bottom: 8px;">${element.icon || '📦'}</div>
        <div style="font-size: 14px; font-weight: 600;">${element.title || element.viewType || '自定义视图'}</div>
        <div style="font-size: 12px; margin-top: 4px;">${element.viewName || 'CustomView'}</div>
        ${element.constraints && element.constraints.height ? `<div style="font-size: 11px; margin-top: 4px; color: #667eea;">高度：${element.constraints.height}px</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * 渲染 TableView
 */
function renderTableView(element) {
  const rowCount = element.rowCount || 5;
  
  return `
    <div style="background: white; border-radius: 12px; margin: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span>📋</span>
          <span style="font-size: 14px; font-weight: 600; color: #333;">列表</span>
        </div>
        <div style="font-size: 12px; color: #999;">${element.name || 'tableView'} · ${rowCount}项</div>
      </div>
      
      <div>
        ${Array.from({ length: Math.min(rowCount, 5) }).map((_, i) => `
          <div style="padding: 14px 16px; border-bottom: ${i < Math.min(rowCount, 5) - 1 ? '1px solid #f0f0f0' : 'none'}; display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px;">
              ${['📚', '📝', '📊', '👨‍🏫', '💬'][i]}
            </div>
            <div style="flex: 1;">
              <div style="font-size: 14px; font-weight: 600; color: #333;">列表项 ${i + 1}</div>
              <div style="font-size: 12px; color: #999; margin-top: 2px;">这是第${i + 1}项的描述内容</div>
            </div>
            <div style="font-size: 12px; color: #ccc;">›</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 渲染 ImageView
 */
function renderImageView(element) {
  return `
    <div style="height: ${element.height || 150}px; background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%); border-radius: 12px; margin: 12px; display: flex; align-items: center; justify-content: center;">
      <div style="text-align: center; color: #999;">
        <div style="font-size: 48px; margin-bottom: 8px;">🖼️</div>
        <div style="font-size: 14px;">${element.viewName || 'ImageView'}</div>
        ${element.constraints && element.constraints.height ? `<div style="font-size: 12px; margin-top: 4px; color: #667eea;">高度：${element.constraints.height}px</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * 渲染 Button
 */
function renderButton(element) {
  return `
    <div style="height: ${element.height || 44}px; margin: 12px; display: flex; align-items: center; justify-content: center;">
      <div style="width: 100%; max-width: 200px; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
        ${element.title || '按钮'}
      </div>
    </div>
  `;
}

/**
 * 渲染 Label
 */
function renderLabel(element) {
  return `
    <div style="margin: 12px; padding: 8px 16px;">
      <div style="font-size: 16px; font-weight: 600; color: #333;">
        ${element.text || element.title || '文本内容'}
      </div>
      <div style="font-size: 12px; color: #999; margin-top: 4px;">${element.viewName || 'Label'}</div>
    </div>
  `;
}

/**
 * 精确渲染主函数
 */
function renderUIElementPrecise(el) {
  // 根据 template 类型选择渲染函数
  const renderers = {
    'banner': renderBannerView,
    'menuGrid': renderMenuGrid,
    'enterRoom': renderEnterRoomView,
    'schedule': renderSchedule,
    'trail': renderTrail,
    'plan': renderPlan,
    'courseware': renderCourseware,
    'sectionHeader': renderSectionHeader,
    'createRoom': renderCustomView,
    'bookLive': renderCustomView,
    'tableView': renderTableView,
    'image': renderImageView,
    'button': renderButton,
    'label': renderLabel,
    'custom': renderCustomView,
    'placeholder': renderCustomView
  };
  
  const renderer = renderers[el.template] || renderCustomView;
  return renderer(el);
}

// 导出函数
if (typeof window !== 'undefined') {
  window.renderUIElementPrecise = renderUIElementPrecise;
}

// 如果是 Node.js 环境，导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderUIElementPrecise,
    renderBannerView,
    renderMenuGrid,
    renderEnterRoomView,
    renderSchedule,
    renderTrail,
    renderPlan,
    renderCourseware,
    renderSectionHeader,
    renderCustomView,
    renderTableView,
    renderImageView,
    renderButton,
    renderLabel
  };
}
