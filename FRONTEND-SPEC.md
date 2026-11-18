# Apex 配置助手前端重构与优化主规格说明书（Master Frontend Spec v2.0）

> **运行边界更新（2026-11-18）**：本文件中的“后端写入、自动快照、事务回放”等桌面版假设，必须服从 `WEB-ONLY-SPEC.md`。纯网页版的实际数据流是“用户手动上传 Apex 文件 → 浏览器本地解析 → 审阅差异 → 导出修改文件与原始回滚包”，不自动探测路径，也不承诺跨文件原子写入。

> **目标读者**：负责执行前端重构与优化的开发 Agent（以及审查人类开发人员）。
>
> **工程背景**：现存前端（`ui/index.html`、`ui/app.css`、`ui/app.js`、`ui/wizards.js`）存在明显的“AI 生成味（Slop）”、设计语言割裂、单体 JS 耦合过重、缺乏严谨交互状态与现代组件规范等问题。
>
> **指导思想**：整合本项目新安装的 5 大前端技能库，全面重塑前端工程架构、视觉品味、交互体验与自动化验证体系：
> 1. **`Leonxlnx/taste-skill` (design-taste-frontend)**：反庸俗、反 AI 模板感，建立纯正的竞技工程美学（Competitive Precision），讲究边缘齐整、精准间距、高级克制的动效与质感。
> 2. **`pbakaus/impeccable` (impeccable)**：严密的 Design Tokens 体系、高对比度色彩层级、无障碍焦点管理、空态/错误态/恢复态防御性交互。
> 3. **`GoogleChrome/modern-web-guidance-src` (modern-web-guidance)**：强制遵循现代 Web 标准，采用标准 HTML5 语义化标签、原生 `<dialog>` / Popover API、CSS 容器查询、`:has()` 选择器、平滑 View Transitions 与现代化表单控件。
> 4. **`shadcn-ui/ui` (shadcn)**：汲取 shadcn/ui 的设计哲学与原子组件结构（Card, Button, Slider, Tabs, Dialog, Table, Badge, DiffViewer），在无第三方厚重框架绑架的前提下，实现模块化、无障碍优先的组件架构。
> 5. **`ag-ui-protocol/ag-ui` (ag-ui-a2ui & agui-playwright-validate)**：接入 AG-UI 标准化前端通信与状态事件契约，配套 Playwright 端到端自动化检验流水线，用硬指标（0 Console Error、视觉对齐、状态机闭环）作为优化验收门禁。

---

## 目录
1. [现状诊断与去“AI味”整改清单（De-Slop Audit）](#1-现状诊断与去ai味整改清单de-slop-audit)
2. [设计系统与视觉语言（Design System & Tokens）](#2-设计系统与视觉语言design-system--tokens)
3. [前端技术架构与现代化改造（Modern Web Architecture）](#3-前端技术架构与现代化改造modern-web-architecture)
4. [原子组件体系规范（Component Anatomy - shadcn 范式）](#4-原子组件体系规范component-anatomy---shadcn-范式)
5. [信息架构与核心视图重构（Information Architecture & Views）](#5-信息架构与核心视图重构information-architecture--views)
6. [AG-UI 协议与数据流契约（AG-UI Contract）](#6-ag-ui-协议与数据流契约ag-ui-contract)
7. [Playwright 自动化验证与质量门禁（Verification & Quality Gates）](#7-playwright-自动化验证与质量门禁verification--quality-gates)
8. [执行路线图与里程碑（Implementation Roadmap）](#8-执行路线图与里程碑implementation-roadmap)

---

## 1. 现状诊断与去“AI味”整改清单（De-Slop Audit）

依据 `taste-skill` 与 `impeccable` 准则，对现有 `ui/index.html` 与 `app.css` 进行深度批判，优化 Agent 必须彻底清除以下问题：

| 现状硬伤 | 违背准则 | 严重度 | 现象描述与整改要求 |
| :--- | :--- | :---: | :--- |
| **虚浮的极光光斑 (Aurora Blobs)** | `taste-skill: Anti-slop` | **P0** | **现象**：`div.aurora` 中三个大尺寸毛玻璃模糊渐变球在后台漂浮，给人极其典型的“AI 生成的模板网站”廉价感，且严重分散对游戏核心参数与数值的关注。<br>**整改**：彻底移除 `.aurora` 及所有无意义的漂移动画。采用深邃干净的纯黑底色 (`#09090b`)，辅以极轻微的 1px 精密网格或点阵（Dot Grid），营造如专业战术仪器（Raycast / Linear 风格）的冷峻、克制美感。 |
| **杂乱扁平的侧栏导航** | `impeccable: UX Hierarchy` | **P0** | **现象**：左侧一字排开 11 个导航项，信息架构扁平。用户高频使用的“日常对局启动”与低频使用的“系统优化/关于”挤在一起，眼花缭乱。<br>**整改**：精简重组为 **日常作战面板**（概览、方案切换、启动）、**核心参数调校**（视野与瞄准、画质与显示、进阶配置）、**系统与工具**（冲突中心、备份恢复、优化、设置）三大清晰功能区。 |
| **混乱的数据呈现与内联样式** | `taste-skill: Equal Edges`<br>`modern-web-guidance` | **P1** | **现象**：HTML 中充斥大量 `style="margin:var(--s-3) var(--s-5) var(--s-5)"`、`style="padding:0"` 等特异性补丁；表格列宽写死 (`style="width:130px"`)，内容被生硬截断或换行。<br>**整改**：建立统一的网格卡片和布局槽位，消除所有内联布局样式；统一表格列比例与排版对齐规则。 |
| **单体巨石 JS 与脆弱的状态管理** | `modern-web-guidance: Architecture` | **P0** | **现象**：`app.js` 膨胀至 170KB，`wizards.js` 达 65KB，充斥直接的 DOM 拼接与全局变量污染，状态机与视图渲染混杂在一起。<br>**整改**：重构为符合现代 Web 标准的 ES Modules 模块化架构（状态存储 Store、C# Bridge 客户端、组件驱动系统、各页面独立的 View Controller）。 |
| **非原生的弹窗与可访问性缺陷** | `modern-web-guidance: Accessible Primitives` | **P1** | **现象**：手写 `div.modal`，缺乏焦点捕获、Esc 监听不完整、屏幕阅读器无 ARIA 标注。<br>**整改**：全面升级为现代原生 `<dialog>` 元素与 HTML Popover API，内置键盘焦点环和无障碍无缝支持。 |

---

## 2. 设计系统与视觉语言（Design System & Tokens）

遵循 `taste-skill`（克制、专业、自成一体）与 `impeccable`（精密 Tokens、高对比阶梯）的标准：

### 2.1 配色方案：战术精密暗色调（Tactical Obsidian）

不采用花里胡哨的彩虹渐变，以 **锌灰黑（Zinc Dark）** 为基底，辅以 **高饱和度功能警示色**：

```css
:root {
  /* 基础底色系统（Zinc 阶梯） */
  --bg-canvas: #09090b;       /* 背景主画布，纯黑深空 */
  --bg-surface: #121215;      /* 基础卡片表面 */
  --bg-surface-elevated: #18181b; /* 浮动面板、下拉菜单、Dialog 背景 */
  --bg-surface-active: #27272a;   /* 交互悬浮/激活背景 */

  /* 边框与分割线系统 */
  --border-subtle: rgba(255, 255, 255, 0.08); /* 柔和分割线 */
  --border-default: #27272a;                 /* 标准卡片描边 */
  --border-strong: #3f3f46;                  /* 聚焦、重要控件描边 */

  /* 文本系统（确保符合 WCAG AA+ 4.5:1 对比度） */
  --text-primary: #f4f4f5;    /* 核心高亮文字，纯白偏冷 */
  --text-secondary: #a1a1aa;  /* 常规正文与说明文案 */
  --text-muted: #71717a;      /* 辅助提示、禁用态、只读标签 */

  /* 语义指示色（严格用于状态与战术区分） */
  --apex-red: #e63946;        /* Apex 标志性绯红：主动作、毁灭性操作、严重冲突 */
  --apex-red-glow: rgba(230, 57, 70, 0.25);
  --status-ready: #10b981;    /* 翡翠绿：就绪、校验通过、写入成功 */
  --status-warn: #f59e0b;     /* 琥珀金：演练模式 (dry-run)、警告、需注意 */
  --status-info: #06b6d4;     /* 科技青：只读属性、游戏运行检测、信息提示 */

  /* 字体系统 */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Microsoft YaHei UI", sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", "Consolas", monospace; /* 所有数值、FOV、DPI、路径均强制等宽 */
}
```

### 2.2 排版与尺寸准则（Typography & Spacing）

1. **等宽数字原则（Tabular Numbers）**：
   - 所有的数字展示（如当前 FOV、灵敏度 `1.200`、cm/360、文件字节、修改行数）强制启用 `font-variant-numeric: tabular-nums; font-family: var(--font-mono);`，确保数值滚动与变动时绝无界面跳动。
2. **边缘绝对平齐（Equal Edges）**：
   - 卡片内边距严格按 `padding: 1.25rem (20px)` 统一，卡片间距严格按 `gap: 1rem (16px)` 统一。不得出现页面某一处边距为 13px、另一处为 18px 的散乱现象。
3. **沉静的微动效（Subtle Micro-interactions）**：
   - 禁用超过 250ms 的拖泥带水动画。
   - 所有 Hover/Focus 转换控制在 `120ms ease-out`。
   - 按钮点击反馈：`active: transform: scale(0.985);`，干净利落。

---

## 3. 前端技术架构与现代化改造（Modern Web Architecture）

基于 `GoogleChrome/modern-web-guidance-src`，严格执行现代 Web 标准规范：

```
ui/
├── index.html               # 纯粹的语义骨架与挂载点
├── css/
│   ├── base.css             # Reset、CSS Variables、Typography
│   ├── components.css       # 符合 shadcn 规范的原子组件样式
│   └── views.css            # 视图特定布局与网格
└── src/
    ├── main.js              # 应用入口、路由与生命周期引导
    ├── core/
    │   ├── bridge.js        # C# WebView2 进程间通信网关（带超时与重试）
    │   ├── store.js         # 单向数据流响应式中心状态机
    │   └── events.js        # AG-UI 协议事件分发总线
    ├── components/          # 可复用原子 UI 封装
    │   ├── dialog.js        # 原生 <dialog> 控制封装
    │   ├── slider.js        # 高精度数值滑块组件
    │   ├── diff-viewer.js   # 配置文件行级差异审阅单
    │   └── toast.js         # 事务与通知队列
    └── views/               # 各业务页面控制器
        ├── dashboard.js     # 作战仪表盘
        ├── controls.js      # 视野与操控调校
        ├── gfx.js           # 画质与显示模式
        ├── launch.js        # 启动参数驱动器
        ├── plans.js         # 配置方案管理器
        ├── backups.js       # 快照与恢复中心
        └── conflict.js      # 冲突分析与裁决中心
```

### 3.1 关键现代 Web 标准实现清单
1. **原生 `<dialog>` 替代手写 Modal**：
   - 必须使用 HTML5 原生 `<dialog>` 并通过 `dialog.showModal()` 打开，获得浏览器原生焦点捕获（Focus Trapping）、`::backdrop` 虚化背景以及原生 `Escape` 关闭能力。
2. **容器查询（Container Queries）**：
   - 面板中的 KPI 卡片与表格使用 `@container (max-width: 600px)` 自动伸缩，在小窗口或分屏模式下平滑自适应，告别媒体查询断点错乱。
3. **现代化 CSS 选择器**：
   - 全面使用 `:has()` 替代冗余的 JavaScript 状态类联动（例如 `form:has(:invalid) button[type="submit"] { opacity: 0.5; pointer-events: none; }`）。
4. **平滑页面切换（View Transitions API）**：
   - 在支持的 WebView2/Chromium 内核中，页面路由切换使用 `document.startViewTransition()`，带来如原生 App 般丝滑的标签页切换体验。
5. **严密的内容安全策略（Strict CSP）**：
   - 保持 `meta http-equiv="Content-Security-Policy"` 为 `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`，禁止外链脚本与外部资产载入，确保离线安全。

---

## 4. 原子组件体系规范（Component Anatomy - shadcn 范式）

参照 `shadcn-ui/ui` 的经典组件解剖学，为常用 UI 构建高质感标准范式：

### 4.1 按钮（Button）
- **变体（Variants）**：
  - `btn-primary`：战术深黑底色 + 细白边框（或 Apex 红），用于核心主操作（如“应用配置”、“生成差异”）。
  - `btn-secondary`：深灰背景 (`#27272a`)，用于普通辅助操作。
  - `btn-outline`：透明背景 + 1px 细边框，用于次要操作。
  - `btn-ghost`：完全透明，Hover 时背景轻微浮现，用于图标按钮或轻量交互。
  - `btn-danger`：绯红背景/边框，仅用于删除快照、危险写入等破坏性操作。
- **状态（States）**：包含明确的 `hover`、`active`、`focus-visible`（2px 偏移轮廓环）与 `disabled`（淡化置灰，禁用一切鼠标事件）。

### 4.2 极客数值滑块（Precision Slider with Stepper）
- **适用场景**：鼠标灵敏度（精确到小数点后 3 位，如 `1.200`）、FOV 视野角（`90 ~ 110`）、倍镜 Scalar。
- **解剖结构**：
  1. `Label`：语义中文名 + 对应的 cfg 底层键名（如 `cl_fovScale`）。
  2. `Slider Track`：细轨（4px），高亮激活部分采用科技青或琥珀金。
  3. `Direct Numeric Input`：等宽输入框，支持用户直接键盘键入精确小数。
  4. `Micro Steppers`：左减右加按钮（`-0.01` / `+0.01`），支持键盘微调。
  5. `Derived Metrics`：下方实时联动呈现衍生物理数值（如 eDPI、360° 旋转物理距离 `cm/360`）。

### 4.3 差异审阅单（Transaction Diff Viewer）
- **适用场景**：所有写入操作前的必经环节（`review.build` 结果渲染）。
- **解剖结构**：
  - **头部元数据**：目标文件绝对路径、文件当前 SHA256 指纹、本次改动项数（例如 `3 项变更 · 1 项只读保持`）。
  - **代码级 Diff 行**：
    - 绿色行：`+ setting.defaultres "1920"`（新增或更新）
    - 红色行：`- setting.defaultres "2560"`（旧值移除）
    - 灰色行：`  cl_fovScale "1.55" (保持未变)`
    - 锁定行：带有小锁图标，明确标注 `[系统只读]`（如 `last_display_width`）。
  - **底部动作条**：事务指纹 ID、单选或全选复选框、确认写入按钮、取消并放弃按钮。

### 4.4 状态指示徽章（Tactical Badge / Pill）
- 严禁滥用花哨的霓虹药丸。
- 只有 4 种语义状态：
  - `Badge Ready`（绿色小圆点 + 文本）：表示文件已探测、校验一致。
  - `Badge DryRun`（琥珀黄小圆点 + 文本）：明确提醒当前为演练模式，绝无实质写入。
  - `Badge Conflict`（红色感叹号 + 文本）：检测到配置冲突。
  - `Badge Muted`（灰色小圆点 + 文本）：未激活或离线状态。

---

## 5. 信息架构与核心视图重构（Information Architecture & Views）

将原有凌乱的 11 个页面精简为结构层次分明的架构体系：

```
┌─────────────────────────────────────────────────────────────┐
│                       Top Bar 顶部状态条                     │
│  [Apex 就绪探测]  [Steam 运行状态]  [权限: asInvoker] [演练标记] │
├──────────────┬──────────────────────────────────────────────┤
│  侧边栏导航   │                主内容工作区                  │
│              │                                              │
│ [作战工作台] │ 1. 仪表盘概览 (Dashboard)                     │
│  • 概览面板   │    - 本机状态与一键方案切换                    │
│  • 方案管理   │    - 最近一次事务安全回执与回滚入口            │
│  • 启动与配置 │                                              │
│              │ 2. 视野与瞄准实验室 (Aim & FOV)               │
│ [硬件与调校] │    - 真实 FOV ↔ cl_fovScale 双向换算标尺      │
│  • 操控与视野 │    - 8 档倍镜 Scalar 表格化联动联动          │
│  • 画质分辨率 │    - 跨游戏灵敏度换算器 (CS2/Valorant)        │
│  • 游戏参数   │                                              │
│              │ 3. 画质与分辨率 (Graphics & Display)          │
│ [安全与维护] │    - 预设切换 (电竞高刷 / 极简帧率)           │
│  • 冲突裁决   │    - 严格过滤只读键，仅写入 4 项安全分辨率键   │
│  • 快照备份   │                                              │
│  • 系统优化   │ 4. 冲突分析中心 (Conflict Center)             │
│  • 设置中心   │    - 启动项 vs profile.cfg 冲突实时告警       │
│              │    - 一键统一与智能仲裁                        │
└──────────────┴──────────────────────────────────────────────┘
```

### 5.1 核心视图交互细化要求

#### A. 视野与瞄准实验室（Aim & FOV Wizard）
1. **数据源必须真实**：打开页面第一时间调用 `bridge.invoke("aim.read")`，从真实 `profile.cfg` 与 `settings.cfg` 读取当前值填充控件。**禁止**任何 104 或 1.41 的假数据假初始化。
2. **8 档倍镜完整覆盖**：必须完整呈现 8 个槽位（`scalar_0` 到 `scalar_7`），对应 1x、2x、3x、4x、6x、8x、10x 等倍率，彻底解决遗漏第 8 项的历史 Bug。
3. **模式解耦**：提供三种清晰模式选项卡：
   - `保持当前倍镜 (Keep)`：生成变更单时不触碰任何倍镜键。
   - `自动匹配视场角 (Match 1:1)`：按当前 FOV 自动匹配相对移动速率。
   - `自定义微调 (Custom)`：展开 8 项精密微调步进器。

#### B. 画质与显示模式（Graphics & Display）
1. **绝对禁止写入只读键**：分辨率选择器（如 1920×1080、2560×1440）只向变更单注入 `defaultres`、`defaultresheight`、`fullscreen`、`nowindowborder` 4 个键，严格排除 `last_display_width/height`。
2. **动态差异指示**：预设方案按钮（“竞技低画质”、“极清画质”）上方实时显示“将修改 X 项 / 已符合”，而不是写死假数字。

#### C. 启动参数驱动器（Launch Options Driver）
1. **彻底废弃前端硬编码**：选项列表完全通过调用 `bridge.invoke("launch.catalog")` 动态生成。
2. **风险分级渲染**：
   - 安全推荐项（如 `-novid`、`-high`）：直接复选框开关。
   - 需注意项（如 `-threads`、`fps_max`）：带参数输入框。
   - 高风险或弃用项（如 `exec-autoexec`）：显式警示标签并禁用。

#### D. 事务审阅与快照回滚（Review & Rollback）
1. **审阅闭环**：任何修改点击“预览”后，必须弹出原生全屏/居中 `<dialog id="review-modal">`，完整展示文件级 Diff。
2. **指纹校验**：前端只传递 `reviewFingerprint` 触发 `bridge.invoke("review.apply")`，确保应用的内容与用户刚刚眼见的 Diff 百分百一致。
3. **一键撤销（Undo/Rollback）**：操作成功后，右下角 Toast 必须常驻“已建立快照 #SN-XXXX [一键还原]”按钮。

---

## 6. AG-UI 协议与数据流契约（AG-UI Contract）

为了让优化 Agent 与上层测试/控制工具无缝协作，前端必须实现标准化的 AG-UI 数据属性与事件总线：

### 6.1 DOM 标记标准（Data-TestID Taxonomy）
所有关键元素必须遵循严格的语义化 `data-testid` 命名空间：

- 导航栏：`data-testid="nav-${route}"`（如 `nav-dashboard`, `nav-controls`, `nav-gfx`）
- 数值输入：`data-testid="input-${settingKey}"`（如 `input-mouse-sensitivity`, `input-fov-scale`）
- 交互按钮：`data-testid="btn-${action}"`（如 `btn-review-apply`, `btn-create-plan`, `btn-rollback`）
- 状态指示：`data-testid="status-${target}"`（如 `status-dryrun-badge`, `status-apex-running`）
- 差异展示：`data-testid="diff-container"`, `data-testid="diff-line-added"`, `data-testid="diff-line-removed"`

### 6.2 进程通信安全契约（Bridge Event Dispatcher）
前端与 C# 后端交互封装为 Promise 机制，拒绝任何无序回调：

```javascript
// ui/src/core/bridge.js 规范
export async function invokeBridge(command, payload = {}) {
  const requestId = crypto.randomUUID();
  const packet = { id: requestId, command, ...payload };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Bridge timeout: [${command}] 超时 15s 未响应`));
    }, 15000);

    window.chrome.webview.addEventListener('message', function handler(event) {
      if (event.data?.id === requestId) {
        window.chrome.webview.removeEventListener('message', handler);
        clearTimeout(timer);
        if (event.data.success) {
          resolve(event.data.data);
        } else {
          reject(new Error(event.data.error?.message || "操作失败"));
        }
      }
    });

    window.chrome.webview.postMessage(JSON.stringify(packet));
  });
}
```

---

## 7. Playwright 自动化验证与质量门禁（Verification & Quality Gates）

优化 Agent 交付的前端代码必须通过 `agui-playwright-validate` 技能的标准流水线，设立 **4 大零容忍门禁（Zero-Tolerance Quality Gates）**：

### 门禁 1：控制台零错误门禁（Zero Console Errors）
- **指标**：测试运行全程，`page.on('console', msg => msg.type() === 'error')` 捕获次数必须为 **0**。
- **排查点**：无未捕获 Promise、无资源加载 404、无未知变量引用、无 CSP 拦截警告。

### 门禁 2：真实数据填充与零默认值门禁（Zero Mock Leak）
- **指标**：当注入本机真实配置（如 FOV 1.55、Sensitivity 1.2）时，页面加载后对应输入框的值必须精确为 `1.55`（或换算后的 110.3°）和 `1.200`，绝对禁止退化回 `104` / `1.41`。
- **断言方法**：
  ```javascript
  await expect(page.locator('[data-testid="input-fov-degrees"]')).toHaveValue('110');
  await expect(page.locator('[data-testid="input-mouse-sensitivity"]')).toHaveValue('1.200');
  ```

### 门禁 3：只读分辨率键拦截门禁（ReadOnly Key Protection）
- **指标**：在画质页切换任何预设或分辨率，点击生成变更后，获取审阅单内容，断言其中 **绝对不包含** `last_display_width` 与 `last_display_height`。
- **断言方法**：
  ```javascript
  const diffContent = await page.locator('[data-testid="diff-container"]').innerText();
  expect(diffContent).not.toContain('last_display_width');
  expect(diffContent).not.toContain('last_display_height');
  ```

### 门禁 4：视觉层级与对比度门禁（WCAG AA & Equal Edges）
- **指标**：所有正文文本与背景对比度通过 `4.5:1` 检查；关键行动按钮在 `:focus-visible` 时具备高亮边框；无横向溢出滚动条（`document.documentElement.scrollWidth === window.innerWidth`）。

---

## 8. 执行路线图与里程碑（Implementation Roadmap）

优化 Agent 请按以下步骤执行，每一步完成并通过自测后再推进下一步：

```
[Phase 1: 视觉净化与 Token 确立]
  ├── 1.1 彻底清理 .aurora 漂移渐变与无用浮夸阴影
  ├── 1.2 注入 Tactical Obsidian 纯黑/锌灰设计令牌与等宽字体系统
  └── 1.3 重构基础网格体系，实现 Equal Edges 严密对齐

[Phase 2: 现代原子组件库落地]
  ├── 2.1 引入符合 shadcn 风格的 Button, Input, Slider, Badge
  ├── 2.2 使用原生 <dialog> 实现 Diff 审阅弹窗与全局设置
  └── 2.3 规范化 Toast 队列与无障碍焦点管理

[Phase 3: 核心交互视图按真实状态重构]
  ├── 3.1 重写 controls.js：读取真实 FOV/灵敏度/8 档倍镜，实现双向绑定
  ├── 3.2 重写 gfx.js：锁定只读键，纯净分辨率写入
  ├── 3.3 重写 launch.js：基于 launch.catalog 动态生成，支持风险分级
  └── 3.4 重构 dashboard.js：收敛信息架构，建立高质感仪表盘

[Phase 4: 自动化走查与门禁验收]
  ├── 4.1 运行 Playwright 验证脚本，确保 0 Console Error
  ├── 4.2 验证审阅单指纹匹配与只读键防护
  └── 4.3 生成前后对比评测截图与优化交付报告
```

---
*本规格书作为 Apex 配置助手前端重构与优化的唯一权威主规格，解释权归产品与架构所有。*
