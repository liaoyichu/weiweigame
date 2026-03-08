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

## 2026-03-01 (commit 后继续完善：音效 + 移动端触控)
- 已按用户要求先完成全量提交：`0c36a7a`（包含 index.html、REQUIREMENTS.md、progress.md 及当前工作区其他文件）。

### 音效系统加强（Web Audio API）
- 引擎轰鸣从单振荡器升级为分层引擎：
  - 低频层 `engineOscLow`（sawtooth）
  - 高频层 `engineOscHigh`（triangle）
  - 低频 LFO 轻微调制（模拟发动机抖动感）
- 风声系统完善：
  - 保留噪声源 + 高通滤波
  - 新增 `windGain` 全局节点，音量随速度连续变化
- 更新联动逻辑：
  - `updateAudio()` 根据 `targetThrottle` + `speed` 同步更新引擎频率、双层增益、风噪频率和风噪增益
- 起飞提示音：
  - 继续保留起飞音效 `playTakeoffSound()`，在起飞状态过渡时触发

### 移动端触控流畅度优化
- 输入平滑：
  - 摇杆引入目标值 `joyTargetX/joyTargetY`，实际 `joyX/joyY` 在 update 中插值跟随，降低抖动
  - 油门引入 `throttleInput`，实际 `targetThrottle` 插值跟随，拖拽更顺滑
- 指针锁定：
  - 为摇杆和油门分别增加 `pointerId` 绑定，避免多指串扰
- UI 同步：
  - 键盘/脚本调油门时，`#throttle-knob` 视觉位置自动同步

### 状态输出增强（便于测试）
- `render_game_to_text` 增补：
  - 控制层：`throttleInput`, `joyTargetX`, `joyTargetY`
  - 音频层：`audio.ready`, `contextState`, `takeoffPlayed`, `engineLowHz`, `engineHighHz`, `windHz`, `windGain`

### 本轮测试验证
- 语法：提取内联脚本后 `node --check` 通过。
- develop-web-game 客户端：命令执行通过，`output/web-game/state-*.json` 正常更新。
- 音效联动测试（Playwright + SwiftShader）：
  - 起飞前：`engineLowHz ~70`, `engineHighHz ~120`, `windGain ~0.0128`
  - 加速飞行后：`engineLowHz ~203.79`, `engineHighHz ~359.66`, `windGain ~0.1315`
  - `audioReady=true`, `contextState=running`, `takeoffPlayed=true`
  - 产物：`output/audio-check.png`
- 移动端触控测试（iPhone 12 仿真 + pointer 拖拽）：
  - 摇杆/油门样本序列呈平滑渐变（非突跳）
  - 释放后摇杆归中，油门维持当前输入（符合该游戏控制设计）
  - 产物：`output/mobile-touch-check.png`

## 2026-03-01 (闪烁问题专项修复)
- 用户反馈游戏画面闪烁，按 4 类常见原因逐项排查并修复：
  1. Renderer 配置：
     - `WebGLRenderer` 明确设置 `alpha: false`、`preserveDrawingBuffer: true`、`premultipliedAlpha: false`、`logarithmicDepthBuffer: true`。
     - 显式 `setClearColor(0x83c8f2, 1)`，避免背景透明/清屏不一致导致闪帧感。
  2. 渲染循环同步：
     - 保持单一 `requestAnimationFrame` 主循环，增加 `rafId` 管理。
     - 页面从后台恢复时重置 `lastTs`（`visibilitychange`），避免大时间步引发视觉跳变。
  3. Z-fighting（深度冲突）：
     - 地面下移到 `y=-1.2`，网格下移到 `y=-0.75`。
     - 跑道抬升到 `y=0.08` 并启用 `polygonOffset`。
     - 跑道白虚线/黄边线抬升到 `y=0.12`，设置 `depthWrite:false + polygonOffset + renderOrder`，避免与跑道面冲突闪烁。
     - 相机裁剪面优化：`near: 1`、`far: 70000`，提升深度精度。
  4. InstancedMesh / 渲染顺序：
     - 对 `houses/poles/bulbs/clouds` 设 `frustumCulled = false`，避免实例大范围场景中边界剔除抖动。

- 已先提交修复 commit：`63e7b0d`（满足“修完先 commit”要求）。

### 修复后测试
- `develop-web-game` 客户端回归执行通过（无运行报错）。
- 桌面与移动端（iPhone 12 仿真）连续 10 帧截图对比：
  - 产物：`output/flicker-desktop-*.png`、`output/flicker-mobile-*.png`、`output/flicker-meta.json`、`output/flicker-diff.json`
  - 控制台/页面错误：`desktopErrors=[]`、`mobileErrors=[]`
  - 视觉检查：跑道/地面/标线无明显深度冲突闪烁，画面稳定。

## 2026-03-01 (An-225 模型升级)
- 先尝试在线免费模型路径：
  - 从公开页面解析到可直连 GLB：`https://s3-eu-west-1.amazonaws.com/fetchcfd/original/file-1755720206320.glb`
  - 在代码中加入 `GLTFLoader`，实现“外部模型优先加载”。
- 增加兜底机制：
  - 若外部 GLB 因网络/兼容问题加载失败，自动回退到高精度程序化 An-225，不影响可玩性。

### 程序化 An-225 细化项
- 机身改为 Lathe 流线体（非简单圆柱），并加机头鼓包与背部驼峰。
- 高置机翼改为分段建模，带下反角趋势。
- 双垂直尾翼 + 尾平面重做。
- 六台发动机吊舱（3x2）加入挂架、进气口与风扇盘。
- 起落架细化：前起落架 + 多组主起落架轮组。
- 机窗细节新增。
- 涂装维持白色机身 + 蓝黄条纹。

### 验证
- 语法检查：`node --check` 通过。
- `develop-web-game` 客户端回归执行通过。
- Playwright 截图与状态验证：
  - `output/model-before-start.png`
  - `output/model-after-start.png`
  - `output/model-flight.png`
  - `output/model-state.json`（`modelSource: procedural`，飞行状态正常，错误数 0）

## 2026-03-01 (切换为真实 A380 GLB 模型)
- 按用户指定改为加载真实 GLB：
  - `https://raw.githubusercontent.com/Ysurac/FlightAirMap-3dmodels/master/a380/glTF2/A380.glb`
- 保留程序化模型 fallback：GLB 失败时自动回退。
- 新增加载提示浮层 `#model-loading`：
  - 显示加载进度（可用时）
  - 成功提示“已加载真实 3D 机模 (A380)”
  - 失败提示并自动消隐
- 修正 GLB 归一化算法（避免模型偏移/比例异常）：
  - 先统一朝向
  - 按水平尺寸缩放并限幅
  - 旋转后重新居中
  - 底部对齐到机身基准高度
- `render_game_to_text` 增加 `modelLoading` 状态，便于自动化验证加载提示行为。

### 验证结果
- 语法检查通过。
- Playwright 验证：`modelSource: external_glb`，无页面报错。
- 产物：
  - `output/a380-loading-early.png`
  - `output/a380-loading-late.png`
  - `output/a380-after-start.png`
  - `output/a380-flight.png`
  - `output/a380-state.json`

## 2026-03-08 (碰撞爆炸与解体)
- 按用户要求新增失事系统：
  - 飞机撞到建筑时立即爆炸解体。
  - 飞机撞到地面时按场景区分：非跑道触地直接爆炸；跑道上高速/姿态失控硬着陆也会爆炸；跑道低速落地仍允许正常滑跑。
- 新增可视化解体效果：
  - 失事时隐藏完整机体，生成 28 个碎片并带抛射/落地回弹动画。
  - 新增坠毁爆炸音效。
- 新增重开链路：
  - 爆炸后约 `1.15s` 自动恢复开始层，按钮文案改为“重新起飞”。
  - 点击后重置飞机位置、姿态、油门、碎片与失事状态。
- 为自动化验证补充调试钩子：
  - `window.__debugFlight.resetFlightState()`
  - `window.__debugFlight.setPlaneState(...)`
  - `window.__debugFlight.sampleBuilding(index)`
- 状态输出增强：
  - `render_game_to_text` 新增 `crash.active/reason/restartReady/timer/debrisCount/verticalSpeed`

### 本轮测试
- 语法检查：
  - 提取内联脚本后用 `vm.Script` 编译，通过。
- develop-web-game 客户端基础回归：
  - `output/web-game-crash-base/state-0.json`
  - 验证开始后不会误判为起飞前即坠毁。
- Playwright 定点碰撞验证：
  - 建筑碰撞：`output/building-crash.png`，`output/crash-tests.json` 中 `buildingState.crash.active=true`
  - 地面碰撞：`output/ground-crash.png`，`output/crash-tests.json` 中 `groundState.crash.active=true`
- 重开验证：
  - 爆炸后 `restartReady=true`
  - 再次点击开始后恢复到出生点，`crash.active=false`

## 2026-03-08 (爆炸视觉反馈加强)
- 按用户要求继续强化“爆炸解体”的可见性：
  - 新增 `#crash-flash` 全屏橙白闪光层。
  - 新增独立爆炸特效组：火球 + 黑烟团，和碎片分离更新。
  - 新增失事镜头：坠毁时相机立即切到斜上方爆炸视角，并带短时震动。
- 建筑碰撞视觉修正：
  - 建筑撞击不再把爆炸中心埋在楼体内部。
  - 现在会在撞击楼体外侧角落生成爆炸中心，画面中可稳定看到火球和烟雾。
- 状态输出继续增强：
  - `render_game_to_text.crash` 新增 `flash/shake/explosionCount`

### 本轮测试
- 语法检查：
  - 提取内联脚本后用 `vm.Script` 编译，通过。
- 建筑爆炸特效截图：
  - `output/building-crash-fx-early.png`
  - `output/building-crash-fx.json`
  - 验证点：画面可见火球、黑烟、碎片；状态里 `flash>0`、`shake>0`
- 重开回归：
  - 地面坠毁后仍可通过“重新起飞”恢复，`crash.active=false`

## 2026-03-08 (飞机选择 + 真实 An-225)
- 新增开始页机型选择功能：
  - 默认选中 `A380`
  - 可切换到 `An-225 梦想号`
  - 开始按钮在机模加载期间禁用，避免“选中的飞机还没切过来就开始”
- 机模加载逻辑重构为“按机型配置加载”：
  - `A380` 继续使用真实 GLB：`FlightAirMap-3dmodels/a380`
  - `An-225` 切换为真实 GLB：`https://s3-eu-west-1.amazonaws.com/fetchcfd/original/file-1755720206320.glb`
  - 程序化 An-225 仅保留为失败时兜底，不再作为默认展示
- 状态输出增强：
  - `render_game_to_text.plane` 新增 `selectedKey/activeKey/selectedName`
  - `render_game_to_text.modelLoading` 新增 `pendingPlaneKey/loading`
  - `window.__debugFlight` 新增 `isPlaneLoading()` 与 `selectPlane(key)`
- 交互修正：
  - 开始层不再整屏点击即起飞，避免点击机型卡时误触发开局

### 本轮测试
- 语法检查：
  - 提取内联脚本后用 `vm.Script` 编译，通过。
- develop-web-game 客户端基础回归：
  - `output/web-game-plane-select-base/state-0.json`
  - 验证默认仍为 `A380`，`modelSource=external_a380`
- Playwright 机型切换验证：
  - `output/plane-picker-a380.png`
  - `output/plane-picker-an225.png`
  - `output/plane-picker-an225-started.png`
  - `output/plane-picker-state.json`
  - 验证点：
    - 默认机型为 `A380`
    - 切到 `An-225` 后，开始前和开始后状态均为 `activeKey=an225`
    - `An-225` 使用真实外部模型：`modelSource=external_an225`

## 2026-03-08 (An-225 朝向修正)
- 用户反馈 `An-225` 起飞后前后反了。
- 已将 `An-225` 机型配置的 `rotationY` 从 `Math.PI` 改为 `0`，使其与 `A380` 一样保持机头朝跑道前方。
- 语法检查：内联脚本编译通过。
- 说明：这次是单参数修正；重复 Playwright 远程加载验证时出现等待超时，因此未在本轮留下新的稳定截图产物。

## 2026-03-08 (海边城市场景改造)
- 按用户要求把原先单一草地场景改成“海边城市”布局：
  - 新增右侧外海与前方海湾水面
  - 新增连续沙滩/浪花带
  - 新增远山山脊
  - 新增 CBD 高楼组与跑道两侧近景天际线
  - 普通城区保留并改成更偏城市配色
- 城市采样改为基于海岸线的陆地区域生成，避免建筑刷到海里。
- 低空追尾镜头略微抬高并后拉，尝试让地貌层次更容易进入画面。

### 本轮测试
- 语法检查：内联脚本编译通过。
- 截图产物：
  - `output/coastal-city-before-start.png`
  - `output/coastal-city-after-start.png`
  - `output/coastal-city-before-start-v2.png`
  - `output/coastal-city-after-start-v5.png`
  - `output/coastal-city-state.json`
- 说明：海面、海岸线、楼群已进入场景生成逻辑；主视角下的“山海层次”仍可继续加强，尤其是默认低空跑道镜头的可见性还能再调。

## 2026-03-08 (地表真实感加强)
- 将原先单色地面改为程序化地形网格：
  - 基于多频正弦噪声生成轻微起伏
  - 按海岸距离区分海滩、湿地、草地与内陆颜色
  - 跑道周边自动压平，避免视觉上顶穿跑道
- 去掉不真实的 `GridHelper`。
- 新增城市地表贴片与道路贴片，让 CBD/城区脚下不再只有单色平面。

### 本轮测试
- 语法检查：内联脚本编译通过。
- 截图产物：
  - `output/terrain-realistic-before.png`
  - `output/terrain-realistic-after.png`
- 结果：地面已从纯平面升级为带层次的程序化地表；低空跑道视角下跑道仍然占画面主体，但边缘陆地和地表分区已经更自然。

## 2026-03-08 (山体碰撞精度加强)
- 将山体碰撞从“未旋转的粗略椭圆”改成“按山体自身朝向旋转后的椭圆山坡”判定。
- 山体边界数据新增 `rotationY / baseY / peakY`，碰撞计算改为先转到山体局部坐标，再按坡面高度求命中。
- 山体爆炸视觉点也改成沿局部坡面外推，爆炸不再只按轴对齐方向偏移。
- 调试接口新增 `window.__debugFlight.sampleMountain(index)`，便于自动化脚本抽样验证山体点位。

### 本轮测试
- 语法检查：内联脚本编译通过。
- Playwright 定向验证通过：
  - 找到一个旧算法 `oldNormalized=0.9804` 的斜角样本点，新算法下不会误判爆炸。
  - 在同一座山的有效坡面点放置飞机，成功触发 `撞上山体，飞机解体了`。
- 截图与状态产物：
  - `output/mountain-precision-miss.png`
  - `output/mountain-precision-crash.png`
  - `output/mountain-precision-analysis.json`
- 说明：`develop-web-game` 自带客户端本轮未能直接点击开始按钮，因为默认 `A380` 外部模型加载期间按钮会短时保持 disabled；已用定向 Playwright 脚本完成等价验证。
