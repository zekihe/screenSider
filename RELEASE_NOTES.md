# Screen Recorder - Release Notes

## Version 1.0.0 (2026-01-07)

### 📋 版本概述
这是Screen Recorder的稳定版发布，使用Electron + React + electron-vite进行了全面重构，提升了代码质量和可维护性。

### ✨ 主要功能
- **核心录制功能**：全屏录制、窗口录制、音频录制、摄像头画中画
- **重构架构**：使用React组件化开发，提升代码复用性
- **现代化构建**：采用electron-vite作为构建工具，提升开发效率
- **路由管理**：实现异步路由加载，优化应用性能
- **代码质量**：集成ESLint和Prettier，保证代码规范
- **安全通信**：使用contextBridge进行主进程与渲染进程的安全通信

### 🚀 版本变更
1. **架构重构**
   - 使用React替代纯HTML开发，采用组件化架构
   - 引入electron-vite作为现代化构建工具
   - 实现异步路由加载，提升应用性能
   - 优化项目目录结构，提高代码可维护性

2. **功能优化**
   - 重构录制控制逻辑，增强稳定性
   - 优化摄像头画中画窗口实现
   - 改进设置窗口的用户体验
   - 增强错误处理机制

3. **代码质量提升**
   - 集成ESLint进行代码质量检查
   - 使用Prettier保证代码格式一致性
   - 修复潜在的安全问题
   - 优化主进程与渲染进程的通信方式

### 📦 安装说明

```bash
# 克隆仓库
git clone <repository-url>
cd screen-recorder-pro

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建应用（所有平台）
npm run build

# 构建特定平台
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### 🖥️ 支持平台
- **macOS** (Intel/Apple Silicon)
- **Windows** (Windows 10及以上)
- **Linux** (Ubuntu/Debian/Fedora等主流发行版)

---

# Screen Recorder - Release Notes

## Version 1.0.0 (2026-01-07)

### 📋 Version Overview
This is the stable release of Screen Recorder, fully refactored using Electron + React + electron-vite, improving code quality and maintainability.

### ✨ Key Features
- **Core Recording**: Fullscreen recording, window recording, audio recording, camera picture-in-picture
- **Architecture**: React component-based development for better code reusability
- **Modern Build**: electron-vite as build tool for improved development efficiency
- **Routing**: Asynchronous route loading for optimized app performance
- **Code Quality**: ESLint and Prettier integration for code standards
- **Secure Communication**: contextBridge for safe main/renderer process communication

### 🚀 Version Changes
1. **Architecture Refactoring**
   - Replaced pure HTML with React for component-based development
   - Introduced electron-vite as modern build tool
   - Implemented asynchronous route loading for better performance
   - Optimized project structure for improved maintainability

2. **Feature Optimization**
   - Refactored recording control logic for enhanced stability
   - Improved camera picture-in-picture window implementation
   - Enhanced settings window user experience
   - Strengthened error handling mechanisms

3. **Code Quality Improvements**
   - Integrated ESLint for code quality checking
   - Used Prettier for consistent code formatting
   - Fixed potential security issues
   - Optimized main/renderer process communication

### 📦 Installation Instructions

```bash
# Clone the repository
git clone <repository-url>
cd screen-recorder-pro

# Install dependencies
npm install

# Start development mode
npm run dev

# Build application (all platforms)
npm run build

# Build specific platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### 🖥️ Supported Platforms
- **macOS** (Intel/Apple Silicon)
- **Windows** (Windows 10 and above)
- **Linux** (Ubuntu/Debian/Fedora and other mainstream distributions)

---

## Version 0.0.2 (2026-01-04)

### 📋 版本概述
这是Screen Recorder的第二个小版本发布，主要包含打包配置优化和项目配置更新。

### ✨ 主要功能
- **屏幕录制**：支持全屏录制和特定窗口录制
- **窗口切换**：录制过程中可切换录制窗口
- **音频支持**：麦克风音频录制，可随时开启/关闭
- **摄像头画中画**：摄像头实时画面叠加，可随时开启/关闭
- **格式选择**：支持MP4和WebM格式，默认MP4格式
- **设置窗口**：独立的格式设置窗口，简约扁平化设计
- **跨平台支持**：支持macOS、Windows和Linux平台

### 🚀 版本变更
1. **项目配置优化**
   - 更新项目名称为screen-recorder，更准确反映应用功能
   - 调整版本号为0.0.2，遵循语义化版本规范
   - 统一更新package.json和package-lock.json配置

2. **打包配置完善**
   - 创建独立的build文件夹存放打包配置
   - 增加Windows平台打包支持（nsis、portable、zip格式）
   - 优化macOS打包配置（dmg、zip格式）
   - 增强Linux打包配置（AppImage、deb、rpm格式）

3. **视频格式功能优化**
   - 将格式选择功能从主工具栏迁移到独立设置窗口
   - 设置默认视频格式为MP4，提升用户体验
   - 保持对WebM格式的支持

4. **构建命令丰富**
   - 增加平台特定打包命令（npm run build:mac/win/linux）
   - 保持原有构建命令兼容性

### 📦 安装说明

```bash
# 克隆仓库
git clone <repository-url>
cd screen-recorder

# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建应用（所有平台）
npm run build

# 构建特定平台
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### 🖥️ 支持平台
- **macOS** (Intel/Apple Silicon)
- **Windows** (Windows 10及以上)
- **Linux** (Ubuntu/Debian/Fedora等主流发行版)

### 📝 使用说明
1. 启动应用后，点击录制按钮开始录制
2. 使用窗口切换按钮选择要录制的窗口
3. 点击麦克风按钮控制音频录制
4. 点击摄像头按钮控制画中画功能
5. 点击设置按钮可切换视频格式（MP4/WebM）
6. 再次点击录制按钮停止录制，视频自动保存

---

# Screen Recorder - Release Notes

## Version 0.0.2 (2026-01-04)

### 📋 Version Overview
This is the second minor release of Screen Recorder, mainly including packaging configuration optimization and project configuration updates.

### ✨ Key Features
- **Screen Recording**: Supports fullscreen and specific window recording
- **Window Switching**: Switch between recording windows during recording
- **Audio Support**: Microphone audio recording, can be enabled/disabled at any time
- **Camera Picture-in-Picture**: Real-time camera overlay, can be enabled/disabled at any time
- **Format Selection**: Supports MP4 and WebM formats, default MP4
- **Settings Window**: Independent format settings window with simple flat design
- **Cross-platform Support**: Supports macOS, Windows and Linux platforms

### 🚀 Version Changes
1. **Project Configuration Optimization**
   - Updated project name to screen-recorder to better reflect app functionality
   - Adjusted version number to 0.0.2 following semantic versioning
   - Unified updates to package.json and package-lock.json configurations

2. **Packaging Configuration Improvement**
   - Created independent build folder for packaging configuration
   - Added Windows platform packaging support (nsis, portable, zip formats)
   - Optimized macOS packaging configuration (dmg, zip formats)
   - Enhanced Linux packaging configuration (AppImage, deb, rpm formats)

3. **Video Format Function Optimization**
   - Migrated format selection from main toolbar to independent settings window
   - Set default video format to MP4 for better user experience
   - Maintained support for WebM format

4. **Build Command Enhancement**
   - Added platform-specific build commands (npm run build:mac/win/linux)
   - Maintained backward compatibility with existing build commands

### 📦 Installation Instructions

```bash
# Clone the repository
git clone <repository-url>
cd screen-recorder

# Install dependencies
npm install

# Start development mode
npm run dev

# Build application (all platforms)
npm run build

# Build specific platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### 🖥️ Supported Platforms
- **macOS** (Intel/Apple Silicon)
- **Windows** (Windows 10 and above)
- **Linux** (Ubuntu/Debian/Fedora and other mainstream distributions)

### 📝 Usage Instructions
1. After launching the application, click the record button to start recording
2. Use the window switch button to select the window to record
3. Click the microphone button to control audio recording
4. Click the camera button to control picture-in-picture functionality
5. Click the settings button to switch video format (MP4/WebM)
6. Click the record button again to stop recording, video will be saved automatically
