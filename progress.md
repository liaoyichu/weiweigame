Original prompt: 你是一个专业的 Web 游戏开发者。我们需要为 6 岁的访客“惟惟”修复并增强她的“飞机模拟器”游戏。

## 2026-03-01
- 重写 `index.html`，修复开始前不渲染导致的黑屏/白屏风险，改为持续渲染。
- 强化光照（Hemisphere + 双 Directional）并重建程序化飞机，保证模型在相机前方可见。
- 增加调试日志：初始化、尺寸变化、运行状态定期日志。
- 保留并优化移动端摇杆/油门（pointer 事件、钳制、回中、被动监听配置）。
- 加入 Web Audio API 音效：引擎声、风声、起飞提示音。
- 增加 `window.render_game_to_text` 与 `window.advanceTime(ms)`，方便自动化验证。

## TODO / Next
- 已准备执行 Playwright 截图验证，检查最终可见性与 UI 布局。
- 验证受限：沙箱禁止本地端口监听（`python3 -m http.server 8012` bind 被拒），且 `npx playwright screenshot` 因无法访问 npm registry 安装 playwright 而失败。
- 修复移动端开始失败：在 `#start-screen` 内新增显式 `#start-btn`，启动入口改为 `click` 主逻辑 + `touchstart` 快速响应，移除 `pointerdown` 启动路径与过渡态依赖。
- `startGame()` 调整为优先尝试 `audioCtx.resume()`，再按需 `initAudio()` 并再次 `resume()`，点击后立即 `display: none` 隐藏开始层。
- 保持 An-225 关键特征代码（6 发动机、双垂尾）与世界边界 `50000`、既有音效更新逻辑不变。
- 验证尝试：沙箱仍禁止本地端口监听（`python3 -m http.server` 绑定失败）；`develop-web-game` Playwright 客户端执行失败，原因是本机缺少 `playwright` 包且当前环境无法在线安装。
- 静态回归核对通过：开始入口仅保留 `#start-btn` 的 `click/touchstart`，开始后立即隐藏遮罩；An-225 结构与 50000 范围逻辑未改。

## 2026-03-01 (本轮修复)
- 按新需求修复移动端启动链路：`triggerStartFromButton` 去掉 `preventDefault`；新增 `window.addEventListener('click', ...)` 兜底启动。
- 重构 `startGame()`：先强制切换 `gameStarted=true` 并隐藏开始层，再在 `try...catch` 内尝试 `initAudio()` 与 `audioCtx.resume()`，确保音频失败不阻断开局。
- 新增跑道：在 `y=0` 添加大尺寸深色跑道平面与白色中线。
- 飞机初始位置改为跑道起点：`planeGroup.position.set(0, 6, runwayLength * 0.44)`，保持朝向沿跑道向前（-Z）。
- 保持 An-225 模型构建代码与世界边界 `50000` 不变。
- 验证尝试：执行用户指定命令 `npx playwright screenshot --viewport-size 1280,720 http://127.0.0.1:8012 ...` 失败，原因是当前环境网络受限，`npx` 无法从 npm 下载 Playwright（`ENOTFOUND registry.npmjs.org`）。

## 2026-03-01 (本轮追加修复)
- 将所有 DOM 引用统一上移到脚本顶部：`gameRootEl/startScreenEl/startTipEl/startBtnEl/joy/stick/throttle/throttleKnob/altEl/spdEl`，避免任何 TDZ 风险，彻底消除 `Cannot access startScreenEl before initialization` 根因。
- `startGame()` 强化为幂等入口：重复触发直接返回，开始时立即隐藏开始层并标记状态；音频初始化/恢复失败仅记录日志，不阻断进入飞行。
- 跑道中线从实线改为白色虚线：新增 `dashGroup` + 多段 `PlaneGeometry`，视觉上更接近真实跑道标线。
- 继续保持飞机出生点位于跑道一端：`planeGroup.position.set(0, 6, runwayLength * 0.44)`。
- 语法自检：提取内联脚本后执行 `node --check` 通过。
- 服务验证：`python3 -m http.server 8012` 与备用端口 `9000` 均因沙箱权限失败（`PermissionError: [Errno 1] Operation not permitted`）。
- 截图验证：按 `npx playwright` 路径尝试（含 `file://` 方案），受限于网络策略无法安装 playwright（`ENOTFOUND registry.npmjs.org/playwright`），未能在此环境产出截图文件。

## 2026-03-01 (本轮彻底修复与升级)
- 彻底移除 `THREE.CapsuleGeometry`：An-225 机身驼峰改为 `CylinderGeometry + SphereGeometry` 组合，兼容 Three.js r128。
- 启动链路重构：`window.startGame = function startGame(){...}` 提前定义为全局；开始按钮绑定 `onclick + pointerup + touchend`，开始遮罩绑定 `click + pointerup`，并统一走 `triggerStart()`，确保触发稳定。
- 新增正式机场跑道：原点附近超大深灰跑道（`22000 x 1200`），保留白色中线并新增左右黄色边线。
- 新增真实环境：
  - 程序化房屋 200 栋（不同体量/高度的长方体）
  - 小汽车 100 辆（彩色方块，部分静止、部分移动）
  - 路灯 100 组（细长圆柱 + 发光球）
- 新增降落逻辑：
  - 低空且不在跑道上：施加轻微阻力，并提示“请对准跑道降落”
  - 在跑道上低空接地：速度快速平滑衰减，进入“跑道滑跑减速”状态
- 新增 HUD 状态文本 `#land-status`，显示待命/飞行/非跑道阻力/跑道减速状态。
- 静态验证：提取内联脚本后执行 `node --check` 通过。
- 自动化验证受限：环境缺少 `playwright` 包，且网络受限无法安装，无法执行 `develop-web-game` Playwright 客户端做截图回归。

## 2026-03-01 (本轮按当前需求优化 + 实测)
- 性能优化（渲染开销下降）：
  - 建筑改为 `THREE.InstancedMesh`（200 实例）。
  - 路灯改为两组 `THREE.InstancedMesh`（灯杆 100 + 灯泡 100）。
  - 云层改为 `THREE.InstancedMesh`（220 实例）。
  - 渲染像素比上限从 `2` 调整为 `1.75`，移动端/高 DPR 设备更稳。
- 飞行与降落逻辑优化（对齐需求）：
  - 新增起飞门槛常量：`TAKEOFF_SPEED_THRESHOLD` 与 `TAKEOFF_PITCH_UP_MIN`。
  - 近地且在跑道上时，未达到“速度阈值+抬头输入”会抑制升力，状态提示 `抬头才能起飞`。
  - 在跑道上且持续推油门时允许滑跑加速；油门不足时进入 `跑道滑跑减速`。
  - 非跑道低空接地增加颠簸与阻力，并保持最低滑移速度，提示对准跑道降落。
  - 世界边界改为常量化包裹：`WORLD_RADIUS = 50000`。
- 可感知反馈增强：
  - 机头新增程序化“螺旋桨”装饰并随油门旋转，提升儿童可见反馈。
  - `render_game_to_text` 补充 `worldRadius/fullscreen/landingState/onRunway` 字段。
  - 键盘新增 `F` 全屏切换。

### 本轮测试记录
- 语法检查：
  - 提取内联脚本后执行 `node --check` 通过。
- develop-web-game 客户端：
  - 命令执行成功，输出 `output/web-game/state-*.json`（可读取）。
  - 该客户端在当前环境生成的 `shot-*.png` 为黑图（canvas 捕获链路问题），但未产出 `errors-*.json`。
- 补充 Playwright 交互测试（带 SwiftShader 参数）：
  - 产物：`output/manual-before-start.png`、`output/manual-after-start.png`、`output/manual-after-state.json`。
  - 可见性通过：开始页可见，点击开始后进入 3D 飞行画面，HUD 正常。
- 行为对比测试（键盘场景，5 秒）：
  - `throttle_only` => `y: 1.2`, `landingState: 抬头才能起飞`（不离地，符合需求）。
  - `throttle_plus_pitchup` => `y: 1376.8`, `landingState: 飞行中`（成功离地，符合需求）。

### TODO / Next
- 若要让 `develop-web-game` 客户端截图不再黑屏，可在其脚本中优先使用 `page.screenshot`（或为 WebGL 画布启用更稳妥捕获路径），当前游戏逻辑本身已通过手工 Playwright 截图验证可见。
