# Apex 配置助手（纯网页版）

一个开源、不扫描本机、不上传文件、只在浏览器内解析 Apex 配置的静态网页工具。

## 直接使用

打开 `ui/index.html` 即可，也可以把 `ui/` 部署到任意静态站点。

工作流：

1. 手动选择或拖入 `profile.cfg`、`settings.cfg`、`videoconfig.txt`。
2. 启动参数功能可选载入 Steam 的 `localconfig.vdf`。
3. 在视野与灵敏度、画质与分辨率、启动参数页调整目标值。
4. 在导出与恢复页生成差异并核对审阅单。
5. 下载配置 ZIP 或保存到文件夹，关闭游戏后手动替换。
6. 需要撤销时使用 ZIP 内 `originals/` 或单独下载的原始回滚包。

## 当前能力

- 文件工作台：4 个独立上传槽，支持点击、拖拽、粘贴；显示编码、BOM、换行、行数、解析状态与 SHA-256。
- 当前配置：展示真实当前值、来源文件和行号，不使用演示默认值。
- 视野与灵敏度：FOV 双向换算、eDPI、cm/360、PSA 五轮收敛、过冲/欠冲校准、8 档倍镜、实测 FOV × 倍率 scalar 表、职业预设。
- 画质与分辨率：画质预设、搜索、4:3 / 16:10 拉伸、发光准星三场景预览。
- 启动参数：生成 LaunchOptions 文本；载入 VDF 后可生成修改后的 `localconfig.vdf`。
- 导出与恢复：行级差异、修改文件、原始回滚包、ZIP、Chromium 文件夹导出、重新上传后的审阅单过期检测。
- 本地会话：IndexedDB 自动保存，刷新后可选择恢复；不会重新扫描磁盘。
- Rust 核心：`core/` 提供可测试的配置补丁、只读键保护、FOV/倍镜、PSA 与误差校准实现。

## 数据与边界

- 文件只在浏览器内解析，不发起业务网络请求。
- 未知键、重复键和只读键只展示，不猜测、不追加。
- `setting.last_display_width`、`setting.last_display_height`、`setting.configversion` 永不进入修改集。
- 修改时保留原编码（UTF-8 / UTF-16LE / Windows-1252）、BOM、换行、缩进、未知行、重复键和文件顺序。
- Windows-1252 文件按原编码写回；若修改内容含无法写回的字符，生成差异会明确阻止并提示先转 UTF-8。
- 浏览器不能自动跨文件写回，也不能检测游戏是否运行；替换文件前需手动退出游戏。
- 启动参数写入 `localconfig.vdf` 前需退出 Steam。
- `<input type="file">` 无法保留用户磁盘路径，因此导出后需要按页面提示手动替换。

## Rust 核心验证

`core/` 是后续 WASM 或 Tauri 接入的稳定计算层，当前页面仍保持直接打开即可用。Windows 下建议将 Cargo 构建目录放在 ASCII 路径：

```powershell
cargo test --manifest-path core/Cargo.toml --target-dir E:\RJ\apex-core-target
```

## 文件说明

- `ui/index.html`：静态入口。
- `ui/app.js`：解析、换算、差异、ZIP 与本地会话。
- `ui/app.css`：视觉系统与响应式布局。
- `ui/guard.js`：早期错误标记，便于诊断。
- `WEB-ONLY-SPEC.md`：纯网页产品与验收规格。
- `FRONTEND-SPEC.md`：视觉、组件与交互规范。
- `FEATURE-SPEC.md`：排位、准度与灵敏度功能规格。

## 已验证

- `node --check` 通过；页面在 `file://` 下可独立启动。
- Chrome 实测 1366×768、760×900 无横向溢出。
- fixture 覆盖 UTF-8 BOM、Windows-1252、CRLF、末尾 NUL、嵌套 VDF 与多 App LaunchOptions。
- 上传、草稿保留、只读保护、差异生成、ZIP 导出、原始回滚包、审阅过期均通过。
- 导出文件保留 BOM、CRLF、末尾 NUL 和 Windows-1252 字符；无法写回的字符会阻止生成差异。
- 浏览器控制台无 error、无异常、仅加载本地 HTML/CSS/JS。

## 后续产品迭代

1. 排位助手：段位/地图/英雄选择驱动的情境化设置建议，而不是只给固定预设。
2. 准度训练：靶场任务、追踪/甩枪评分、训练前后对照和趋势记录。
3. 灵敏度发现器：PSA、过冲/欠冲之外加入跨游戏 cm/360 迁移与可复现测试记录。
4. 配置历史：保存多次导出的源/目标 SHA 与回滚入口，并支持导入原始回滚包。
5. 分享方案：只分享配置值，不包含文件路径、SteamID 或原始文本。

## 开源说明

- 许可证：MIT，见 `LICENSE`。
- 本项目是个人开源工具，与 Respawn Entertainment / Electronic Arts 无关。
- Apex Legends 及相关名称、商标归其权利人所有。
- 仓库不包含用户配置、SteamID、本机路径、账号信息或任何遥测数据。
