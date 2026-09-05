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

核心阶段经 Scene 映射为 `humanAiming`、`humanSettling`、`aiThinking`、`aiSettling` 和 `gameOver`。`paused` 来自独立暂停原因集合（手动、横屏）；`loading` 来自 React 初始快照；`error` 来自同步 mount 异常或资源加载失败。它们都不是核心 `MatchPhase`。

必须保持以下约束：

1. 同一时间只能有一个当前投放者和一只当前预览动物。
2. `paused` 是覆盖状态；所有暂停原因解除后才恢复原核心阶段。回到竖屏不能解除已有的手动暂停。
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

稳定窗口必须是连续的；期间任何 body 再次移动，都要重新累计。时间取 Matter 的模拟时间戳，暂停不消耗 `850ms` 安静窗口或 `8000ms` 期限；不能改回暂停时仍更新的 Phaser `Clock.now`。

出界在所有活动阶段检查。Scene 记录最近一次实际释放动物的一方，在下一次释放前，旧动物的延迟掉落仍由其负责；换手和瞄准不会转移责任。

资源加载监听 `FILE_LOAD_ERROR` 并在创建场景前核对所有必需纹理；文件级 XHR 超时和整个启动期限均为 15 秒，不自动重试。失败后销毁旧实例并显示错误；重试重新 mount，同时重新应用语言和辅助线偏好。不能只设置 Phaser 的全局 loader timeout，它会被文件默认值覆盖。

## 4. Matter 物理边界

当前世界配置：

- 重力：`x = 0`、`y = 1.05`。
- runner：固定 `120Hz`（每步约 `8.33ms`），单渲染帧最多补 `6` 次更新，最大帧时间 `50ms`；普通 `60Hz` 画面每帧进行两次物理更新。
- solver：position `6`、velocity `8`、constraint `4` 次迭代。position 不再额外加硬到 `10`，避免复杂 compound body 在多个接触点之间反复做亚像素过度修正。
- animal body：启用 sleeping，sleep threshold `15`（约四分之一秒持续低运动后休眠），碰撞 `slop = 0.12`（仍小于一个逻辑像素，用不可见的接触余量吸收求解器微修正）。猫、狐狸、兔子和浣熊使用贴合原图外缘的稳定代理轮廓，去掉会反复切换接触点的腿部窄缝。
- 平台：friction `0.9`、frictionStatic `1.25`、restitution `0.006`；接触时动态摩擦取两物体较小值，平台接触和动物互撞都使用动物侧的低动态摩擦。
- 动物共享 friction `0.11`，另有独立 density、frictionStatic、restitution 和 frictionAir。旧的 `0.3–0.74` 动态摩擦配合较大的步长，会在斜向复合轮廓接触时产生反复向上的冲量。低动态摩擦和更小的固定步长共同限制这种抖动；不要按比例提高静摩擦来补偿，否则可能重新放大碰撞冲量。静摩擦乘数仍为普通动物 `2.6–3.6`、老虎 `1.15`，恢复系数仍为 `0.003–0.009`。动物差异由轮廓、重心、密度和其余材质参数共同决定。

修改这些参数会同时影响手感、AI 成功率、稳定时间和穿透深度。不能只凭单个截图调参；至少要运行几何/物理回归并手测低帧率、暂停恢复和高塔场景。

Matter 会先把持续低运动约四分之一秒的单个 body 自动休眠；每回合只有在整座塔连续通过稳定判定后，场景才再次调用 sleeping 将静止状态锁住。后续动物碰撞仍按 Matter 原生规则自动唤醒受撞物体。这一步只清除求解器残余微动，不吸附位置、不改角度，也不会阻止真实的连锁倒塌。

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
3. 重新提取并人工检查 alpha outline、alpha bounds、fit 指标和 texture origin；回归直接解码最终 WebP 的透明通道，不能只验证源 PNG 或尺寸。
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

玩家按旋转后的真实碰撞轮廓裁剪预览中心；AI 以旋转后的显示矩形裁剪 decision `x`。两者的预览中心在释放时都通过 `collisionOriginFromPreviewCenter` 转换到实际物理原点，补偿非中心 `textureOrigin`。旧文档的兔子 `-90°` 越界约 `3.3px` 结论已过时。AI 边界回归用十五种动物、两侧极端支撑和多个 seed 检查最终轮廓是否合法。

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
- 移动设备横屏且视口高度不超过 `520px`、宽度不超过 `940px` 时，显示“请竖屏游玩”，冻结 Matter、AI timer/Tween 和玩法输入。横屏不是完整玩法布局。
- 底部有左右移动、左右旋转和投放五个 DOM 控件；窄屏移动/旋转按钮宽 `44px`，主按钮宽度随可用空间变化，暂停按钮为 `44 × 44`。

### 可访问性

- 所有 DOM 按钮必须有可读名称、键盘焦点和 disabled 状态。
- 阶段文案使用 `aria-live="polite"`，加载提示使用 `role="status"`。
- 暂停、重开、错误和结果使用 dialog/alertdialog 语义。
- `prefers-reduced-motion: reduce` 时将非必要动画和 transition 压缩到近零。
- Canvas 内部动物本身没有完整的屏幕阅读器操作替代；这是当前已知限制，不能宣称完整无障碍支持。
- 页面允许浏览器缩放；移动、旋转 DOM 控件支持指针、键盘按住和辅助技术触发的 click。
- 模态使用统一的 focus trap、背景 `inert` 和关闭后焦点恢复。图鉴或重开确认中的 `P/Esc` 返回设置，保持暂停。

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
- `.github/workflows/quality.yml` 使用 Node 24，在 PR 和 `main` push 时执行 frozen install、类型检查、单元测试、构建体积预算、Chromium / WebKit 的开发及生产构建回归。工作流在提交并推送后才会在远端执行。
- 当前没有 `vercel.json`、lint、覆盖率门槛或部署后自动 smoke test。Vercel Preview/Production 仍依赖 Dashboard 的 Git 集成和实际部署验收。
- 构建硬性预算为全部 JavaScript gzip 总量 `480,000` 字节、CSS gzip 总量 `12,000` 字节、游戏图片总量 `3,000,000` 字节。预算约束体积增长，不代表已经测得真实设备的启动性能或帧率。
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
- 自动化测试覆盖纯规则、AI、十五只动物几何、全部动物推荐姿态与合法离散角度的平地休眠、兔子近直立稳定性、代表性乌龟/小熊物理堆叠、四层木制塔被连续撞醒后重新休眠，以及六组斜向动物互撞的反弹、休眠和十秒观察回归。物理测试与浏览器使用同一固定步长；尚未覆盖所有动物组合、所有连续角度和长时间高塔。
- Playwright 覆盖 Chromium / WebKit 的长暂停、AI、键盘和指针控件、弹窗焦点、横屏冻结、资源 404/超时、启动恢复、延迟掉落和响应式边界；生产构建另测回合、暂停、重开和测试 API 隔离。真实手机触摸、GPU 和安全区仍需手测。
- alpha 回归直接解码最终交付 WebP，同时保留源 PNG 裁剪比例检查。
- Matter 测试辅助引用 Phaser 包内的 Matter/poly-decomp 路径；升级已精确锁定的 Phaser `4.2.1` 时，需要先验证测试辅助仍对应运行时实现。
- AI 单元测试覆盖规划与轮廓边界；Scene 的 timer/Tween 暂停恢复和重开取消由浏览器回归验证。
- 核心测试覆盖出界边界、瞄准权限、延迟责任与默认稳定阈值；不代表穷举所有并发输入时序。
- Phaser 仍形成较大的主 JavaScript chunk；构建会提示该 warning，并另行执行硬性体积预算。
- 当前 production sourcemap 关闭，线上堆栈诊断能力有限。
- Canvas 内部没有完整的语义化操作替代。
- Phaser 将 Canvas 触摸取消转换为 `pointerup`，Scene 据此清除拖动状态；DOM 按钮另外处理 `pointercancel` 和指针捕获丢失。窗口失焦释放持续输入，产品没有单独的切后台暂停菜单。

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
