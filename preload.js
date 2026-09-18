const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  /** 获取窗口、鼠标和缩放信息。 */
  getContext: () => ipcRenderer.invoke('pet:get-context'),
  /** 移动桌宠窗口。 */
  moveWindow: (x, y) => ipcRenderer.send('pet:move-window', x, y),
  /** 显示桌宠右键菜单。 */
  showMenu: () => ipcRenderer.send('pet:show-menu'),
  /** 监听显示比例变化。 */
  onScaleChanged: (callback) => {
    const listener = (_event, scale) => callback(scale);
    ipcRenderer.on('pet:scale-changed', listener);
    return () => ipcRenderer.removeListener('pet:scale-changed', listener);
  }
});

