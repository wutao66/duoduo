# 多多桌宠

这是一个独立的 Electron 桌面宠物，不依赖 Codex。它直接读取项目中的
`spritesheet.webp`，支持待机、注视鼠标、拖动、挥手、跳跃、缩放和位置记忆。

## 本地运行

首次使用先安装依赖：

```bash
npm install
```

如果 Electron 下载时出现 `unable to get local issuer certificate`，不要关闭
SSL 校验。在 macOS/Linux 终端改用可正常验证证书的 Electron 镜像重试：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

启动桌宠：

```bash
npm start
```

操作方式：

- 拖动多多：移动桌宠。
- 单击多多：挥手。
- 双击多多：跳跃。
- 移动鼠标：多多会看向鼠标。
- 右键多多：调整大小、置顶、重置位置或退出。

## 生成安装包

在 macOS 上生成 DMG：

```bash
npm run dist:mac
```

在 Windows 10/11 x64 上生成 EXE 安装包：

```bash
npm run dist:win
```

生成结果位于 `dist` 目录。该命令固定生成兼容主流 Intel/AMD Windows
电脑的 x64 安装包。请在 Windows 环境中执行，避免 macOS 交叉打包所需的
Wine、签名工具和架构差异。

## 没有 Windows 电脑时生成 EXE

项目包含 `.github/workflows/build-windows.yml`，可以使用 GitHub 免费提供的
Windows 构建环境：

1. 在 GitHub 创建一个仓库并上传本项目，确认 `node_modules` 和 `dist` 没有上传。
2. 打开仓库的 **Actions** 页面。
3. 选择 **Build Windows Installer**。
4. 点击 **Run workflow**。
5. 构建完成后，在页面底部下载 `duoduo-windows-x64`。

下载并解压后即可得到 `.exe` 安装包。未购买 Windows 代码签名证书时，安装
程序会显示“未知发布者”，但不影响熟人之间测试使用。

未签名的 macOS 应用首次打开时可能被 Gatekeeper 拦截。公开分发时需要配置
Apple Developer ID 签名和公证；仅在熟人之间测试时，可以在 Finder 中右键应用并选择“打开”。
