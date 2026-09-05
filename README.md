# Stackimals

一个支持手机、iPad 与桌面全屏的 2D 动物堆叠游戏。玩家与 Milo AI 轮流旋转并投放木制动物；谁让任意动物掉下平台，谁就输掉本局。

## 技术栈

- React 19 + TypeScript：DOM HUD、控制按钮、暂停与结算界面
- Phaser 4 + Matter Physics：游戏画布、输入、动画和刚体堆叠
- Vite 8：本地开发和生产构建
- Vitest：规则、AI、动物几何与 Matter 碰撞回归
- Playwright：Chromium / WebKit 交互回归和生产构建验证
- Vercel：静态站点部署和 PR Preview

React 不接收逐帧坐标。Phaser 通过 [`src/ui/gameBridge.ts`](./src/ui/gameBridge.ts) 只发布回合、分数、当前动物和胜负等低频快照，React 通过同一个 bridge 发送移动、旋转、换动物、投放、暂停和重开命令。

## 项目文档

- [`doc/PRODUCT_REQUIREMENTS.md`](./doc/PRODUCT_REQUIREMENTS.md)：产品目标、玩法规则和验收标准
- [`doc/BOUNDARIES_AND_NOTES.md`](./doc/BOUNDARIES_AND_NOTES.md)：物理、碰撞、AI、设备、版权和已知限制
- [`doc/RELEASE_CHECKLIST.md`](./doc/RELEASE_CHECKLIST.md)：测试、Preview 与 Production 发布检查
- [`doc/README.md`](./doc/README.md)：文档索引和维护规则

## 本地运行

需要 Node.js 22.12 或更新版本，以及 pnpm 10。

```bash
pnpm install
pnpm dev
```

默认开发地址是 `http://localhost:5173`。

## 操作

### 触屏

- 在游戏区域左右拖动动物
- 按住底部箭头按钮左右移动，按住弧形箭头按钮连续旋转
- 在当前动物提示中点击「换动物」（每方每局 3 次）
- 点击「投放」松开动物
- 点击 HUD 中的暂停按钮

### 键盘

- `A` / `D` 或 `←` / `→`：左右移动
- 按住 `Q` / `E` 或 `↓` / `↑`：连续左右旋转
- `R`：换动物
- `Space` / `Enter`：投放；按钮聚焦时执行该按钮动作
- `P` / `Esc`：暂停或继续；图鉴或重开确认中返回设置

短横屏会自动暂停，回到竖屏后恢复；如果此前已手动暂停，则仍停留在设置中。加载失败时可点击「再试一次」重新创建游戏。

暂停菜单中可以切换中英文、开启或关闭辅助线、查看 15 只动物的图鉴，并选择桌子左侧代表玩家的动物；Milo 会自动选择不同的动物。危险高度与落点辅助线首次使用时默认关闭，选择会保存在本地浏览器。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
pnpm test:e2e:production
```

生产浏览器测试需要先执行 `pnpm build`。Playwright 自行启动并关闭端口 `5174` / `4174` 的测试服务，失败截图与 trace 默认写入系统临时目录，可通过 `PLAYWRIGHT_OUTPUT_DIR` 指定。Linux 首次运行可使用 `pnpm exec playwright install --with-deps chromium webkit` 安装系统依赖。

GitHub Actions 的 Quality 工作流使用 Node 24 和锁定的 pnpm，运行以上检查。构建同时执行体积预算：全部 JS 的 gzip 总量最多 480,000 字节、CSS gzip 最多 12,000 字节、游戏图片总量最多 3,000,000 字节。

## 部署到 Vercel

1. 在 Vercel 导入 `firefighter-eric/stackimals` 仓库。
2. Framework Preset 选择 **Vite**。
3. Build Command 使用 `pnpm build`，Output Directory 使用 `dist`。
4. PR 使用 Preview Deployment；合并到 `main` 后发布 Production。

游戏资源使用根路径 `/assets/game/...`，因此 Vercel 不需要额外重写规则。

## 项目边界

```text
src/game/          Phaser 场景、Matter 适配、规则、AI、资源清单
src/ui/            React HUD、DOM 控制、模态与 typed bridge
src/styles/        全局主题和移动端响应式布局
public/assets/     可直接部署的 WebP 游戏资源
assets-src/        可编辑的资源源文件
design/            视觉概念稿
doc/               产品要求、工程边界和发布检查清单
```

本项目使用原创名称、角色和视觉素材，仅借鉴经典轮流堆叠玩法。
