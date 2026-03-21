# ✈️ 惟惟的超级大飞机

> 为 6 岁访客"惟惟"打造的 3D 飞行模拟游戏

## 🎮 游戏介绍

这是一款专为儿童设计的 3D 飞行模拟器，玩家可以选择不同的飞机模型，在开放世界中自由飞行探索。游戏包含海边城市、山脉、机场跑道等丰富场景。

## 🚀 快速开始

### 本地运行

```bash
# 启动 HTTP 服务器
python3 server.py

# 或使用任意 HTTP 服务器
python3 -m http.server 8080
```

然后在浏览器中访问：`http://localhost:8080`

## 🎯 操作说明

### 移动端（触控）
| 控制 | 操作 |
|------|------|
| 左侧油门 | 上下拖动控制速度 |
| 右侧摇杆 | 控制飞机俯仰与滚转 |

### 桌面端（键盘）
| 按键 | 功能 |
|------|------|
| ↑ / W | 增加油门 |
| ↓ / S | 减少油门 |
| ← / A | 向左滚转 |
| → / D | 向右滚转 |
| 空格 | 抬头（起飞关键） |
| Shift | 低头 |
| F | 全屏切换 |

## ✨ 核心特性

### 飞机选择
- **A380** - 默认机型，真实 3D 客机模型
- **An-225 梦想号** - 六发双垂尾货运巨机

### 场景元素
- 🏙️ 海边城市与 CBD 高楼群
- 🏔️ 程序化山体（带碰撞检测）
- 🌊 海面与沙滩
- 🛣️ 机场跑道与城市道路
- 🏠 200+ 栋程序化建筑
- 🚗 100+ 辆移动车辆
- ☁️ 动态云层

### 飞行系统
- 真实起飞逻辑（需达到速度阈值 + 抬头）
- 跑道降落检测
- 碰撞爆炸与解体效果
- 引擎轰鸣与风声音效（Web Audio API）

### 技术亮点
- Three.js r128 3D 渲染
- InstancedMesh 性能优化
- 程序化地形生成
- 移动端触控优化
- 外部 GLB 模型加载 + 兜底机制

## 📁 项目结构

```
weiweigame/
├── index.html          # 游戏主文件（HTML + CSS + JS）
├── server.py           # Python HTTP 服务器（带 CORS）
├── lib/
│   ├── three.min.js    # Three.js 核心库
│   └── GLTFLoader.js   # GLTF 模型加载器
├── assets/
│   ├── A380.glb        # A380 飞机模型
│   └── an225.glb       # An-225 飞机模型
├── output/             # 自动化测试截图输出
└── progress.md         # 开发进度日志
```

## 🛠️ 开发调试

### 调试接口

游戏暴露了以下全局调试接口：

```javascript
// 重置飞行状态
window.__debugFlight.resetFlightState()

// 设置飞机状态
window.__debugFlight.setPlaneState(x, y, z, vx, vy, vz)

// 选择飞机
window.__debugFlight.selectPlane('a380' | 'an225')

// 检查模型加载中
window.__debugFlight.isPlaneLoading()

// 采样建筑
window.__debugFlight.sampleBuilding(index)

// 采样山体
window.__debugFlight.sampleMountain(index)
```

### 状态输出

```javascript
// 获取游戏状态文本
const state = window.render_game_to_text()
console.log(state)
```

## 🧪 测试验证

使用 Playwright 进行自动化测试：

```bash
# 基础状态验证
npx playwright screenshot --viewport-size 1280,720 http://localhost:8080 output/screenshot.png

# 移动端仿真
npx playwright screenshot --viewport-size 390,844 --device-scale-factor 3 http://localhost:8080 output/mobile.png
```

## 📝 开发日志

详细开发记录请参阅 [progress.md](progress.md)

## 🎨 适配说明

- **移动端优先**：触控摇杆/油门针对手机优化
- **响应式设计**：支持各种屏幕尺寸
- **性能优化**：像素比限制 1.75，InstancedMesh 减少 Draw Call
- **兼容性**：支持 Three.js r128+

## ⚠️ 注意事项

1. 需要 HTTP 服务器运行（不能直接打开 HTML 文件）
2. 建议使用现代浏览器（Chrome/Edge/Safari）
3. 移动端建议使用 Safari 或 Chrome
4. 外部模型加载需要网络连接

---

**为惟惟打造** 🎈 祝飞行愉快！
