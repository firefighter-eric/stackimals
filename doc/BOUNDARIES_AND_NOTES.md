# Stackimals 边界条件与开发注意事项

## 1. 系统边界

当前版本是纯客户端 2D 游戏：

| 层 | 职责 | 不应承担的职责 |
| --- | --- | --- |
| React 19 | HUD、按钮、状态提示、暂停/结果/错误模态 | 不保存逐帧坐标，不驱动物理循环 |
| typed bridge | 传递低频快照和 `move`、`rotate`、`drop`、`pause`、`resume`、`restart` 命令 | 不暴露 Matter body 给 React |
| Phaser 4.2.1 | Canvas、输入、场景生命周期、Tween、音频触发 | 不定义账号或服务器状态 |
| Matter Physics | 刚体、碰撞、重力、睡眠和堆叠结算 | 不直接决定产品文案或 UI |
| 纯 TypeScript core/AI | 随机队列、稳定判定、掉落责任、AI 候选选择 | 不依赖 React DOM 或 Phaser 渲染对象 |
| Vite/Vercel | ES2022 构建、静态资源和站点部署 | 当前没有 API、数据库或常驻服务 |

本项目不需要 Three.js。引入 3D 渲染会改变资产、相机、碰撞、性能和输入模型，必须作为新的产品范围评审。

Phaser 当前使用 `Phaser.AUTO`，由运行设备在 WebGL 和 Canvas 间选择可用 renderer；不能把 WebGL 可用当作唯一前提，也不能只在一种 renderer 上判断视觉正确。

仓库当前精确锁定 React `19.2.8`、React DOM `19.2.8`、Phaser `4.2.1`、TypeScript `7.0.2`、Vite `8.2.2` 和 Vitest `4.1.11`。Matter 随 Phaser 提供而不是单独安装。升级 Phaser 尤其要同步验证 Matter API、poly-decomp 路径、碰撞测试和画布渲染。

## 2. 坐标与场地边界

所有数值均为 `390 × 620` 逻辑画布中的像素，而不是设备 CSS 像素。

| 项目 | 当前值 | 行为 |
| --- | ---: | --- |
| 逻辑画布 | `390 × 620` | Phaser 使用 `RESIZE`，相机等比显示完整逻辑高度并在宽屏露出两侧空间 |
| 初始投放高度 | `y = 96` | 当前动物预览的纹理原点位置 |
| 危险线 | `y = 151` | 稳定后，任一 body 的 `bounds.min.y < 151` 判当前投放者失败 |
| 平台中心 | `(195, 548)` | 可见平台与静态碰撞体使用同一水平中心 |
| 平台碰撞体 | `294 × 24` | 静态矩形，顶部承接动物 |
| 合法水平轮廓 | `x = 34…356` | 旋转后的动物碰撞轮廓必须整体处于该范围 |
| 底部出界 | `bounds.min.y > 695` | 动物整体越过画布下方 `75` 像素缓冲区后判出界 |
| 左侧出界 | `bounds.max.x < -70` | 动物整体越过左侧缓冲区后判出界 |
| 右侧出界 | `bounds.min.x > 460` | 动物整体越过右侧缓冲区后判出界 |
| 键盘移动速度 | `150` 逻辑像素/秒 | 单帧输入 delta 最多按 `34ms` 计算，避免切回页面后跳变 |

注意：危险线判断使用真实物理 body 的顶边，而不是图片矩形；水平瞄准限制使用旋转后的碰撞轮廓，而不是未旋转 sprite 宽度。危险横线、落点竖线和落点框只是视觉辅助，首次使用默认关闭；设置开关不会改变危险线或碰撞判定。

## 3. 状态机与时间边界

核心阶段为：

```text
ready → player aiming → dropping/settling
      → AI thinking → dropping/settling
      → player aiming → … → game-over
```

核心阶段经 Scene 映射为 `humanAiming`、`humanSettling`、`aiThinking`、`aiSettling` 和 `gameOver`。`paused` 来自独立 boolean 覆盖态；`loading` 来自 React 初始快照；`error` 来自 React 捕获同步 mount 异常，它们都不是核心 `MatchPhase`。

必须保持以下约束：

1. 同一时间只能有一个当前投放者和一只当前预览动物。
2. `paused` 是覆盖状态；继续后必须恢复暂停前的核心阶段。
3. `game-over` 是终态；除重开外的输入全部忽略。
4. 重开必须递增局 generation，取消旧 AI timer/Tween，并重新创建两条队列和 AI 随机源。
5. 玩家窗口失焦时，必须释放持续按下的左右移动与旋转命令。
6. React StrictMode 会执行挂载清理验证；bridge 的 mount/dispose 必须幂等，不能生成两个 Phaser 实例或重复监听器。

### 稳定判定

- 线速度上限：`0.12` Matter 像素/模拟步。
- 角速度上限：`0.018` 弧度/模拟步。
- 所有 body 必须连续安静 `850ms` 才算稳定。
- 从投放开始最多等待 `8000ms`；持续运动到超时则当前投放者失败。
- Matter 已 sleeping 的 body 直接视为安静。
- 缺失速度数据不能被当作稳定证据。
- 正常换手还要求当前投放至少触发过一次 `collisionstart`；只有低速但从未接触，不能直接算成功稳定。

稳定窗口必须是连续的；期间任何 body 再次移动，都要重新累计。

## 4. Matter 物理边界

当前世界配置：

- 重力：`x = 0`、`y = 1.05`。
- runner：目标 `60fps`，单渲染帧最多补 `3` 次更新，最大帧时间 `50ms`。
- solver：position `10`、velocity `8`、constraint `4` 次迭代。
- animal body：启用 sleeping，sleep threshold `20`（约三分之一秒近零运动后休眠），碰撞 `slop = 0.05`（Matter 默认容差，避免精细轮廓持续微修正）。猫、狐狸、兔子和浣熊使用贴合原图外缘的稳定代理轮廓，去掉会反复切换接触点的腿部窄缝。
- 平台：friction `0.9`、frictionStatic `1.25`、restitution `0.006`；接触时动态摩擦取两物体较小值，所以普通动物仍由自身的低动态摩擦控制落地冲量，平台值仅为老虎等专属组合提供下限。
- 每只动物另有独立 density、friction、frictionStatic、restitution 和 frictionAir。Matter 对复杂 body 的高动态摩擦可能不稳定，因此通常把碰撞阶段的 friction 控制在 `0.3–0.54`，近静止阶段使用 `2.6–3.6` 的 frictionStatic 乘数；老虎因复合轮廓求解稳定性使用单独组合。恢复系数范围为 `0.003–0.009`。这使动物落地时不会被过强切向冲量反复推开，但稳定后仍有足够木制咬合力；兔子与企鹅仍比乌龟、鳄鱼和刺猬更容易受不平衡力带动。

修改这些参数会同时影响手感、AI 成功率、稳定时间和穿透深度。不能只凭单个截图调参；至少要运行几何/物理回归并手测低帧率、暂停恢复和高塔场景。

每回合只有在整座塔连续通过稳定判定后，场景才调用 Matter sleeping 将静止状态锁住；后续动物碰撞会按 Matter 原生规则自动唤醒受撞物体。这一步只清除求解器残余微动，不吸附位置、不改角度，也不会阻止真实的连锁倒塌。

### 数值现实

Matter 是离散刚体求解器，运行中可能出现极短、极浅的数值穿透；“严格按照边缘”指视觉轮廓和静止接触必须可信，不代表逐像素 alpha 碰撞或数学上的零穿透。

当前自动化门槛：

- 轮廓对可见 alpha 的覆盖率大于 `95%`。
- 碰撞区域由可见 alpha 支撑的比例大于 `97%`。
- 碰撞与 alpha 外框宽高比处于 `0.97…1.03`。
- 中心偏差小于 `max(0.5px, 对应显示尺寸的 1%)`。
- 乌龟承接小熊的固定步回归中，瞬时穿透小于 `4` 逻辑像素，稳定后小于 `1.2` 逻辑像素。

最后一项当前只覆盖一个代表性组合，不等于十五种动物所有角度和组合都已做动态仿真。明显可见的静止重叠即使未超过自动化阈值，也仍应作为缺陷处理。

## 5. 动物资源与碰撞边界

运行时资源位于 `public/assets/game/`，原始生成资产位于 `assets-src/generated-v1/`。可见动物使用透明 WebP，碰撞数据位于 `src/game/data/animals.ts`。

### 当前轮廓规则

- 视觉显示必须保持源 WebP 的原始宽高比。
- 当前显示面积沿用已校准的玩法面积，不能因修复比例而任意放大或缩小动物。
- 轮廓来自 `alpha >= 48` 的源图边缘，并以源图坐标 `8px` 容差简化。
- 每只动物保存一个无自交的凹外轮廓；运行时由 Matter/poly-decomp 分解为凸 parts。
- sprite 与 body 必须使用同一个 `textureOrigin`，该原点由轮廓面积重心计算。
- 轮廓在构建时以 TypeScript 数据加载；运行时不扫描图片 alpha。

不允许恢复以下做法：

- 用一个大矩形或圆包住整张透明图片。
- 只按图片中心设置 `origin(0.5)`，忽略碰撞轮廓重心。
- 分别设置不保持比例的 `width` 和 `height`。
- 为追求逐像素边缘而生成大量极细、尖锐或自交的 Matter parts。
- 替换图片后继续沿用旧 `sourceSize`、alpha bounds 或 outline。

### 新增或替换动物的必要步骤

1. 保存有来源记录的透明源图，并生成优化后的 WebP。
2. 更新 `sourceSize`，按约定面积计算等比 `display`。
3. 重新提取并人工检查 alpha outline、alpha bounds、fit 指标和 texture origin。
4. 为动物设置物理参数和允许角度。
5. 运行全部几何、Matter 分解和碰撞回归测试。
6. 打开 physics debug，在多个角度检查平台接触、动物接触和旋转原点。
7. 真机检查缩放后是否仍有明显重叠、悬空、抖动或模糊边缘。

## 6. 旋转边界

- 玩家按下旋转按钮或 `Q/E` 时先转动 `1.5°`，继续按住后以每秒 `105°` 围绕动物中心连续旋转。
- AI 仍使用动物配置中的离散候选角度：部分动物为 `30°` 档位，其他动物为 `45°` 档位。
- AI 候选中的 `0°` 必须始终存在。
- 玩家连续旋转和 AI 离散候选都必须使用旋转后的真实碰撞轮廓约束水平位置。

若美术轮廓在某些倒置角度产生极端细支点，优先通过动物专属允许角度收窄风险，不要为单只动物全局提高摩擦或 solver 参数。

## 7. AI 边界与注意事项

Milo 当前是客户端确定性启发式 AI，不是机器学习模型，也没有物理前瞻模拟。

AI 会：

- 从现有 body 的 AABB 估计塔体中心、最高支撑区域和支撑跨度。
- 枚举动物允许角度，并按旋转后的显示矩形生成一组水平候选点。
- 按支撑覆盖、支撑中心、塔体中心、整体平衡、横向包围盒宽度和边缘余量评分；它不分析真实向下接触边。
- 使用 seed 在支撑跨度内额外采样 5 个探索落点，并加入最高 `0.025` 的评分扰动，减少完全机械的表现。
- 思考约 `520ms`，再用约 `720ms` Tween 展示移动后投放。

AI 不会：

- 在候选阶段运行 Matter 模拟。
- 读取未来动物或其他隐藏信息，也不会修改物理结果。
- 直接写入最终位置、稳定状态、分数或赢家。
- 随高塔自动提高难度。

因此 AI 做出次优或失败落点属于当前能力边界，但越界角度、非法位置或跳过物理属于缺陷。纯 planner 在相同单次 seed 和相同快照下必须一致；状态式 `StackingAI` 会在每次调用后推进 PRNG，完整复现还要求相同 PRNG 状态和调用顺序。

玩家的水平预览边界按旋转后的真实碰撞轮廓计算。AI 当前以 decision `x` 为显示矩形中心做半宽裁剪，但真实 sprite/body 使用非 `0.5` 的 `textureOrigin`；因此即使两者都以 `x = 34…356` 为数值场地，AI 的真实碰撞轮廓仍不保证完全留在范围内。当前数据中，兔子旋转 `-90°` 时的最坏计算约可越界 `3.3` 逻辑像素。这是已知合法性缺口，不是预期的难度差异；统一算法时必须同时回归 AI 合法性与成功率。

## 8. 随机性边界

- 玩家和 AI 使用各自独立的 seeded shuffle bag。
- 一个完整 bag 包含十五种动物各一次。
- 跨 bag 边界如果第一只与上一只相同，会在存在其他动物时交换。
- 查看未来三只动物必须通过 snapshot/restore，不得消耗队列。
- 每方每局最多换动物 3 次；换出的当前动物被延后到自己的活动 bag 末尾，不能影响对方队列。
- 同一 seed 和状态必须可复现；重开会换用新的 generation seed，所以新局顺序可以改变。
- 可复现范围是队列和给定快照下的 AI 决策；当前没有输入日志或物理快照协议，不能承诺整局在不同设备、帧率或浏览器上逐帧一致。

未来若增加录像、分享种子或在线对战，必须把 seed、队列状态、规则版本和每次落子输入纳入可序列化协议。

## 9. 设备、输入与可访问性边界

### 当前布局

- 手机与 iPad 竖屏使用纵向 HUD；iPad 横屏和桌面使用顶部居中 HUD 与全宽游戏区域，不保留固定左侧栏。
- 16:9 桌面显示桌子两侧的玩家代表动物与 Milo 代表动物；玩家代表动物保存在本地浏览器，Milo 自动选择不同动物。
- 暂停设置提供语言、玩家代表动物和辅助线开关；辅助线偏好保存在本地浏览器，并在首次使用时默认为关闭。
- 当前支持边界为至少 `320 × 568` 的竖屏视口；CSS 只硬性声明最小宽度 `320px`，低于 `568px` 的竖屏高度尚未保证控制区不裁切。
- 顶部和底部使用 `safe-area-inset-*`，避免刘海和 Home Indicator 遮挡。
- 游戏区域设置 `touch-action: none`，页面本身禁止滚动和回弹。
- 移动设备横屏且视口高度不超过 `520px`、宽度不超过 `940px` 时，显示“请竖屏游玩”。横屏不是完整玩法布局。
- 旋转按钮至少 `62 × 62` CSS 像素，投放按钮至少 `118 × 62`；暂停按钮为 `44 × 44`。

### 可访问性

- 所有 DOM 按钮必须有可读名称、键盘焦点和 disabled 状态。
- 阶段文案使用 `aria-live="polite"`，加载提示使用 `role="status"`。
- 暂停、重开、错误和结果使用 dialog/alertdialog 语义。
- `prefers-reduced-motion: reduce` 时将非必要动画和 transition 压缩到近零。
- Canvas 内部动物本身没有完整的屏幕阅读器操作替代；这是当前已知限制，不能宣称完整无障碍支持。
- 页面 viewport 当前包含 `user-scalable=no`；这是低视力访问的已知缺口，不应作为长期产品要求保留。
- 模态当前没有完整 focus trap、背景 `inert` 或关闭后的焦点恢复；ARIA 声明不等于完整模态交互。
- 短横屏竖屏提示当前只遮住画面，不会自动暂停物理或 AI；恢复竖屏前仍需避免后台状态继续推进。

### 浏览器目标

构建目标为 ES2022，并依赖 Canvas/WebGL、Pointer Events 和 Web Audio。发布验收至少覆盖：

- 真实 iPhone Safari。
- 真实 Android Chrome。
- 桌面 Chrome、Firefox 和 Safari/WebKit 中至少各一次基础流程。

浏览器模拟不能替代真机对安全区、动态地址栏、GPU、触摸坐标和音频解锁的验证。

## 10. 音频边界

- 音效由 Web Audio oscillator 实时合成，不包含第三方音频素材。
- 首次用户手势后才保证 AudioContext 可启动；浏览器拒绝自动播放时，游戏必须继续可玩。
- 当前没有音量或静音设置，这是已知限制。
- 音频失败不得阻断投放、结算或重开。

## 11. 数据、安全与测试接口

当前产品不收集、上传或持久化账号、比分、设备标识或个人信息。刷新页面会丢失本局；语言、玩家代表动物和辅助线开关仅保存在本地浏览器。

`window.__STACKIMALS_TEST__` 只允许在开发环境或显式设置 `VITE_ENABLE_TEST_API=true` 的测试构建中暴露。Production 构建不得包含可调用的测试入口。若未来增加后端、分析、错误上报或存储，需要先补充：

- 数据字段、用途、保留时间和删除方式。
- 用户同意与隐私说明。
- 服务端校验、速率限制和滥用边界。
- 环境变量与密钥管理。
- 数据库迁移和回滚策略。

## 12. 构建与部署边界

- 仓库声明 Node.js `>=22.12.0`、pnpm `10.17.1`；部署或 CI 应显式使用兼容版本并通过 frozen lockfile 安装。
- 当前本机链接的 Vercel 项目使用 Node 24.x，但 `.vercel/` 被 `.gitignore` 排除，不能把本机项目设置当作仓库中可复现的配置合同。
- Vite 构建目标为 ES2022，输出 `dist/`，当前关闭 production sourcemap。
- 运行资源使用 `/assets/game/...` 绝对根路径；当前适合部署在域名根目录。若未来部署到子路径，必须同步配置 Vite `base`、资源 URL 和路由验证。
- 当前没有 `vercel.json`、GitHub Actions、lint、覆盖率门槛或部署后自动 smoke test。Vercel Preview/Production 依赖 Dashboard 的 Git 集成和人工验收。
- 当前没有客户端路由。若未来加入 SPA 路由，需要明确 deep-link rewrite，否则直接打开子路由可能返回 404。
- `VITE_ENABLE_TEST_API` 在 Production 环境必须未设置或不等于 `true`。

## 13. 素材与知识产权

- Stackimals 名称、角色、UI、美术和音效必须使用项目原创或具有明确许可的素材。
- 可以借鉴“轮流投放不规则物体并避免掉落”的通用玩法机制。
- 不得复制或近似复刻 *Animal Tower Battle*、*In the Jungle* 等作品的名称、Logo、动物图、音效、UI 截图、文案或商店素材。
- 原始生成图保存在 `assets-src/`，运行时派生资源保存在 `public/assets/`，视觉方向记录在 `design/README.md`。
- 新素材应记录来源、生成方式或许可证；来源不明的素材不得进入 Production。

## 14. 当前已知限制与测试缺口

- AI 只有启发式单步选择，没有 Matter rollout、难度档或自适应策略。
- 当前有十五只动物，没有独立的内容配置工具。
- 没有存档、排行榜、账号、联网、PWA 或静音；设置仅覆盖语言、玩家代表动物和辅助线。
- 自动化测试覆盖纯规则、AI、十五只动物几何、全部动物推荐姿态与合法离散角度的平地休眠、兔子近直立稳定性和代表性乌龟/小熊物理堆叠；尚未覆盖所有动物组合、所有连续角度和长时间高塔。
- 项目目前没有 Playwright 端到端测试依赖；触屏、键盘、暂停、旋转屏幕和生产页面仍依靠手动浏览器验收。
- alpha 回归从源 PNG 读取像素，但对最终 WebP 只核对尺寸；WebP 尺寸不变而透明通道损坏时可能漏报。
- Matter 测试辅助引用 Phaser 包内的 Matter/poly-decomp 路径；升级已精确锁定的 Phaser `4.2.1` 时，需要先验证测试辅助仍对应运行时实现。
- AI 单元测试只覆盖纯规划器，不覆盖 Scene timer、Tween、暂停恢复和重开取消旧 AI 工作。
- 核心测试尚未直接覆盖 `isOutOfPlay`、`canActorAim`、`unattributed-fall`，也没有把默认稳定阈值作为独立合同测试。
- 当前主 JavaScript bundle 约 `1.64MB`（gzip 约 `441KB`）；构建会提示大 chunk，但尚未设硬性性能预算。
- 当前 production sourcemap 关闭，线上堆栈诊断能力有限。
- Canvas 内部没有完整的语义化操作替代。
- Canvas Scene 未显式处理 `pointercancel`；页面失焦会释放持续键盘输入，但没有自动暂停策略。
- 错误界面只可靠捕获同步 bridge mount 异常；没有 Phaser 资源加载失败监听，Scene 不存在时的 `restart` 命令也不能重新创建实例。
- 出界与稳定只在 `dropping/settling` 采样；旧 body 若在 `aiming/thinking` 才出界，可能延迟到下一次投放并被错误归责。
- AI 的显示矩形中心裁剪没有补偿非中心 `textureOrigin`，真实碰撞轮廓可能轻微越过水平场地边界。

已知限制不能在发布说明中写成已完成能力。任何扩展都应先更新[产品要求](./PRODUCT_REQUIREMENTS.md)和[发布检查清单](./RELEASE_CHECKLIST.md)。

## 15. 主要代码入口

- Phaser 与 Matter 配置：[`src/game/createGameBridge.ts`](../src/game/createGameBridge.ts)
- 场地、输入、回合和结算：[`src/game/scenes/StackimalsScene.ts`](../src/game/scenes/StackimalsScene.ts)
- 动物、轮廓和物理参数：[`src/game/data/animals.ts`](../src/game/data/animals.ts)
- 稳定判定：[`src/game/core/stability.ts`](../src/game/core/stability.ts)
- 掉落归因：[`src/game/core/matchRules.ts`](../src/game/core/matchRules.ts)
- 队列：[`src/game/core/animalQueue.ts`](../src/game/core/animalQueue.ts)
- AI：[`src/game/ai/placementAI.ts`](../src/game/ai/placementAI.ts)
- UI 输入和生命周期：[`src/ui/GameShell.tsx`](../src/ui/GameShell.tsx)
- 响应式样式：[`src/styles/game-shell.css`](../src/styles/game-shell.css)
