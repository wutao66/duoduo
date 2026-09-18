/** 精灵单帧宽度。 */
const CELL_WIDTH = 192;
/** 精灵单帧高度。 */
const CELL_HEIGHT = 208;
/** 判定为拖动操作所需的最小距离。 */
const DRAG_THRESHOLD = 4;
/** 鼠标靠近宠物中心时使用待机动画的半径。 */
const LOOK_DEAD_ZONE = 42;
/** 各动画状态的行号、帧数和帧时长。 */
const ANIMATIONS = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  right: { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  left: { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, durations: [140, 140, 140, 280] },
  jumping: { row: 4, durations: [140, 140, 140, 140, 280] }
};
/** 绘制桌宠的画布。 */
const canvas = document.querySelector('#pet');
/** 画布二维绘制上下文。 */
const context = canvas.getContext('2d');
/** 完整精灵表图片。 */
const spriteSheet = new Image();
/** 当前动画状态。 */
let animationName = 'idle';
/** 当前动画帧下标。 */
let frameIndex = 0;
/** 当前帧开始显示的时间。 */
let frameStartedAt = 0;
/** 当前一次性动作结束的时间。 */
let actionEndsAt = 0;
/** 当前显示比例。 */
let currentScale = 1;
/** 当前鼠标观察方向对应的精灵格。 */
let lookCell = null;
/** 当前拖动操作的信息。 */
let dragState = null;
/** 最近一次拖动的水平方向。 */
let dragDirection = 'right';
/** 鼠标位置轮询是否正在执行。 */
let pointerPollPending = false;

/**
 * 根据窗口尺寸调整高清画布。
 * @returns {void}
 */
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
}

/**
 * 从精灵表绘制指定格子。
 * @param {number} row 行号。
 * @param {number} column 列号。
 * @returns {void}
 */
function drawCell(row, column) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    spriteSheet,
    column * CELL_WIDTH,
    row * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT,
    0,
    0,
    canvas.width,
    canvas.height
  );
}

/**
 * 切换循环动画并从第一帧开始播放。
 * @param {'idle'|'right'|'left'|'waving'|'jumping'} name 动画名称。
 * @param {number} now 当前高精度时间。
 * @returns {void}
 */
function switchAnimation(name, now) {
  if (animationName === name) {
    return;
  }
  animationName = name;
  frameIndex = 0;
  frameStartedAt = now;
}

/**
 * 播放一次指定动作，结束后恢复自然状态。
 * @param {'waving'|'jumping'} name 动作名称。
 * @returns {void}
 */
function playAction(name) {
  const now = performance.now();
  const duration = ANIMATIONS[name].durations.reduce((total, value) => total + value, 0);
  actionEndsAt = now + duration;
  animationName = name;
  frameIndex = 0;
  frameStartedAt = now;
}

/**
 * 推进当前动画帧。
 * @param {number} now 当前高精度时间。
 * @returns {void}
 */
function advanceAnimation(now) {
  const animation = ANIMATIONS[animationName];
  if (now - frameStartedAt < animation.durations[frameIndex]) {
    return;
  }
  frameStartedAt = now;
  frameIndex = (frameIndex + 1) % animation.durations.length;
}

/**
 * 选择当前时刻应该展示的动作。
 * @param {number} now 当前高精度时间。
 * @returns {void}
 */
function updateAnimationState(now) {
  if (actionEndsAt > now) {
    return;
  }
  actionEndsAt = 0;
  if (dragState?.moved) {
    switchAnimation(dragDirection, now);
    return;
  }
  switchAnimation('idle', now);
}

/**
 * 持续绘制桌宠动画。
 * @param {number} now 当前高精度时间。
 * @returns {void}
 */
function render(now) {
  updateAnimationState(now);
  advanceAnimation(now);

  if (!dragState && actionEndsAt === 0 && lookCell) {
    drawCell(lookCell.row, lookCell.column);
  } else {
    const animation = ANIMATIONS[animationName];
    drawCell(animation.row, frameIndex);
  }
  window.requestAnimationFrame(render);
}

/**
 * 将鼠标相对宠物的方向换算为 16 向观察格。
 * @param {{x: number, y: number}} cursor 鼠标屏幕坐标。
 * @param {{x: number, y: number, width: number, height: number}} bounds 窗口范围。
 * @returns {{row: number, column: number}|null} 观察方向格或待机状态。
 */
function getLookCell(cursor, bounds) {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height * 0.42;
  const deltaX = cursor.x - centerX;
  const deltaY = cursor.y - centerY;
  if (Math.hypot(deltaX, deltaY) < LOOK_DEAD_ZONE * currentScale) {
    return null;
  }

  const degrees = (Math.atan2(deltaX, -deltaY) * 180 / Math.PI + 360) % 360;
  const direction = Math.round(degrees / 22.5) % 16;
  return direction < 8
    ? { row: 9, column: direction }
    : { row: 10, column: direction - 8 };
}

/**
 * 轮询鼠标位置并更新宠物观察方向。
 * @returns {Promise<void>}
 */
async function pollPointer() {
  if (pointerPollPending || dragState || actionEndsAt > performance.now()) {
    return;
  }
  pointerPollPending = true;
  try {
    const value = await window.desktopPet.getContext();
    if (value.bounds) {
      currentScale = value.scale;
      lookCell = getLookCell(value.cursor, value.bounds);
    }
  } finally {
    pointerPollPending = false;
  }
}

/**
 * 开始记录可能的桌宠拖动操作。
 * @param {PointerEvent} event 指针按下事件。
 * @returns {Promise<void>}
 */
async function handlePointerDown(event) {
  if (event.button !== 0) {
    return;
  }
  const value = await window.desktopPet.getContext();
  if (!value.bounds) {
    return;
  }
  canvas.setPointerCapture(event.pointerId);
  dragState = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    windowX: value.bounds.x,
    windowY: value.bounds.y,
    lastX: event.screenX,
    moved: false
  };
  document.body.classList.add('dragging');
}

/**
 * 根据指针移动更新桌宠窗口坐标。
 * @param {PointerEvent} event 指针移动事件。
 * @returns {void}
 */
function handlePointerMove(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }
  const deltaX = event.screenX - dragState.startX;
  const deltaY = event.screenY - dragState.startY;
  if (Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
    dragState.moved = true;
  }
  if (!dragState.moved) {
    return;
  }
  if (event.screenX !== dragState.lastX) {
    dragDirection = event.screenX > dragState.lastX ? 'right' : 'left';
  }
  dragState.lastX = event.screenX;
  window.desktopPet.moveWindow(dragState.windowX + deltaX, dragState.windowY + deltaY);
}

/**
 * 完成拖动；没有发生移动时播放挥手动作。
 * @param {PointerEvent} event 指针抬起事件。
 * @returns {void}
 */
function handlePointerUp(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }
  const moved = dragState.moved;
  dragState = null;
  document.body.classList.remove('dragging');
  if (!moved) {
    playAction('waving');
  }
}

/**
 * 双击桌宠时播放跳跃动作。
 * @param {MouseEvent} event 双击事件。
 * @returns {void}
 */
function handleDoubleClick(event) {
  if (event.button === 0) {
    playAction('jumping');
  }
}

/**
 * 阻止浏览器菜单并打开原生桌宠菜单。
 * @param {MouseEvent} event 右键菜单事件。
 * @returns {void}
 */
function handleContextMenu(event) {
  event.preventDefault();
  window.desktopPet.showMenu();
}

/**
 * 接收主进程发来的缩放变更并刷新画布。
 * @param {number} scale 新的显示比例。
 * @returns {void}
 */
function handleScaleChanged(scale) {
  currentScale = scale;
  window.requestAnimationFrame(resizeCanvas);
}

/**
 * 精灵表加载完成后启动动画循环。
 * @returns {void}
 */
function handleSpriteLoaded() {
  resizeCanvas();
  frameStartedAt = performance.now();
  window.requestAnimationFrame(render);
}

spriteSheet.addEventListener('load', handleSpriteLoaded);
spriteSheet.src = '../spritesheet.webp';
canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);
canvas.addEventListener('dblclick', handleDoubleClick);
window.addEventListener('contextmenu', handleContextMenu);
window.addEventListener('resize', resizeCanvas);
window.desktopPet.onScaleChanged(handleScaleChanged);
window.setInterval(pollPointer, 80);

