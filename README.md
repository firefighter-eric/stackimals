# Stackimals

一个移动竖屏优先的 2D 动物堆叠游戏。玩家与 Milo AI 轮流旋转并投放木制动物；谁让任意动物掉下平台，谁就输掉本局。

## 技术栈

- React 19 + TypeScript：DOM HUD、控制按钮、暂停与结算界面
- Phaser 4 + Matter Physics：游戏画布、输入、动画和刚体堆叠
- Vite 8：本地开发和生产构建
- Vitest：规则与 AI 的确定性测试
- Vercel：静态站点部署和 PR Preview

React 不接收逐帧坐标。Phaser 通过 [`src/ui/gameBridge.ts`](./src/ui/gameBridge.ts) 只发布回合、分数、当前动物和胜负等低频快照，React 通过同一个 bridge 发送移动、旋转、投放、暂停和重开命令。

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
- 使用底部左右按钮旋转
- 点击「投放」松开动物
- 点击左上角按钮暂停

### 键盘

- `A` / `D` 或 `←` / `→`：左右移动
- `Q` / `E` 或 `↓` / `↑`：左右旋转
- `Space` / `Enter`：投放
- `P` / `Esc`：暂停或继续

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

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
```

本项目使用原创名称、角色和视觉素材，仅借鉴经典轮流堆叠玩法。
