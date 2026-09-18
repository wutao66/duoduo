const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

/** 精灵单帧的原始宽度。 */
const CELL_WIDTH = 192;
/** 精灵单帧的原始高度。 */
const CELL_HEIGHT = 208;
/** 可供用户选择的显示比例。 */
const SCALE_OPTIONS = [0.75, 1, 1.25, 1.5];
/** 当前桌宠窗口。 */
let petWindow = null;
/** 当前桌宠显示比例。 */
let currentScale = 1;
/** 当前是否保持窗口置顶。 */
let alwaysOnTop = true;
/** 延迟保存窗口状态的定时器。 */
let saveTimer = null;

/**
 * 返回窗口状态文件路径。
 * @returns {string} 状态文件的绝对路径。
 */
function getStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

/**
 * 读取上次保存的窗口状态。
 * @returns {{x?: number, y?: number, scale?: number, alwaysOnTop?: boolean}} 已保存状态。
 */
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(getStatePath(), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * 将窗口状态写入用户数据目录。
 * @returns {void}
 */
function saveState() {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  const bounds = petWindow.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    scale: currentScale,
    alwaysOnTop
  };
  fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2));
}

/**
 * 合并短时间内连续产生的窗口状态保存请求。
 * @returns {void}
 */
function scheduleSaveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, 200);
}

/**
 * 计算指定比例对应的窗口尺寸。
 * @param {number} scale 显示比例。
 * @returns {{width: number, height: number}} 窗口宽高。
 */
function getWindowSize(scale) {
  return {
    width: Math.round(CELL_WIDTH * scale),
    height: Math.round(CELL_HEIGHT * scale)
  };
}

/**
 * 返回默认的右下角窗口位置。
 * @param {{width: number, height: number}} size 窗口尺寸。
 * @returns {{x: number, y: number}} 默认坐标。
 */
function getDefaultPosition(size) {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    x: area.x + area.width - size.width - 24,
    y: area.y + area.height - size.height - 24
  };
}

/**
 * 判断保存的坐标是否仍位于任意显示器内。
 * @param {number} x 窗口横坐标。
 * @param {number} y 窗口纵坐标。
 * @param {{width: number, height: number}} size 窗口尺寸。
 * @returns {boolean} 坐标是否可见。
 */
function isPositionVisible(x, y, size) {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return x < area.x + area.width
      && x + size.width > area.x
      && y < area.y + area.height
      && y + size.height > area.y;
  });
}

/**
 * 将窗口移动回主屏幕右下角。
 * @returns {void}
 */
function resetPosition() {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }
  const position = getDefaultPosition(petWindow.getBounds());
  petWindow.setPosition(position.x, position.y);
  scheduleSaveState();
}

/**
 * 更新桌宠尺寸，并保持窗口底部中心位置不变。
 * @param {number} scale 新的显示比例。
 * @returns {void}
 */
function setScale(scale) {
  if (!petWindow || petWindow.isDestroyed() || !SCALE_OPTIONS.includes(scale)) {
    return;
  }

  const oldBounds = petWindow.getBounds();
  const size = getWindowSize(scale);
  const x = Math.round(oldBounds.x + (oldBounds.width - size.width) / 2);
  const y = oldBounds.y + oldBounds.height - size.height;
  currentScale = scale;
  petWindow.setBounds({ x, y, ...size });
  petWindow.webContents.send('pet:scale-changed', scale);
  scheduleSaveState();
}

/**
 * 更新窗口置顶状态。
 * @param {boolean} value 是否置顶。
 * @returns {void}
 */
function setAlwaysOnTop(value) {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }
  alwaysOnTop = value;
  petWindow.setAlwaysOnTop(value, 'floating');
  scheduleSaveState();
}

/**
 * 弹出桌宠右键菜单。
 * @returns {void}
 */
function showPetMenu() {
  const scaleItems = SCALE_OPTIONS.map((scale) => ({
    label: `${Math.round(scale * 100)}%`,
    type: 'radio',
    checked: scale === currentScale,
    click: () => setScale(scale)
  }));
  const menu = Menu.buildFromTemplate([
    { label: '多多桌宠', enabled: false },
    { type: 'separator' },
    { label: '大小', submenu: scaleItems },
    {
      label: '保持置顶',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked)
    },
    { label: '重置位置', click: resetPosition },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);
  menu.popup({ window: petWindow });
}

/**
 * 创建透明桌宠窗口并恢复上次状态。
 * @returns {void}
 */
function createPetWindow() {
  const state = loadState();
  currentScale = SCALE_OPTIONS.includes(state.scale) ? state.scale : 1;
  alwaysOnTop = state.alwaysOnTop !== false;

  const size = getWindowSize(currentScale);
  const fallback = getDefaultPosition(size);
  const savedPositionIsVisible = Number.isFinite(state.x)
    && Number.isFinite(state.y)
    && isPositionVisible(state.x, state.y, size);

  petWindow = new BrowserWindow({
    x: savedPositionIsVisible ? state.x : fallback.x,
    y: savedPositionIsVisible ? state.y : fallback.y,
    ...size,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  petWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
  if (process.platform !== 'win32') {
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  petWindow.once('ready-to-show', () => petWindow.showInactive());
  petWindow.on('moved', scheduleSaveState);
  petWindow.on('closed', () => {
    petWindow = null;
  });
}

/**
 * 注册渲染页面使用的安全通信接口。
 * @returns {void}
 */
function registerIpcHandlers() {
  ipcMain.handle('pet:get-context', () => ({
    bounds: petWindow ? petWindow.getBounds() : null,
    cursor: screen.getCursorScreenPoint(),
    scale: currentScale
  }));
  ipcMain.on('pet:move-window', (_event, x, y) => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.setPosition(Math.round(x), Math.round(y));
    }
  });
  ipcMain.on('pet:show-menu', showPetMenu);
}

/**
 * 在 Electron 初始化完成后启动桌宠。
 * @returns {void}
 */
function handleReady() {
  registerIpcHandlers();
  createPetWindow();
}

app.whenReady().then(handleReady);

/**
 * 在所有窗口关闭时退出桌宠进程。
 * @returns {void}
 */
function handleAllWindowsClosed() {
  app.quit();
}

app.on('window-all-closed', handleAllWindowsClosed);
