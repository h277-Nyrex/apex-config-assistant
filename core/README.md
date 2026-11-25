# Apex 配置核心

这个 crate 把配置文件安全编辑和瞄准计算从页面状态中抽出来，作为后续 WASM 或 Tauri 接入的稳定核心。

当前包含：

- 保留原始行内容与换行的配置解析和补丁生成；
- 未知键、重复键、绑定行和 `last_display_*` 只读保护；
- 只生成 `defaultres`、`defaultresheight`、`fullscreen`、`nowindowborder` 四个分辨率键；
- FOV 与 `cl_fovScale` 双向换算；
- 8 档 FOV × 倍率 scalar 插值，槽位 `0..7` 完整输出；
- PSA 二分收敛状态机；
- 过冲、欠冲误差校准建议。

## 验证

项目路径包含中文时，Windows MinGW 链接器可能无法定位临时目标文件。可以把构建目录放在 ASCII 路径：

```powershell
cargo fmt --manifest-path core/Cargo.toml
cargo test --manifest-path core/Cargo.toml --target-dir E:\RJ\apex-core-target
```

页面目前继续使用浏览器实现文件选择、导出和界面交互；核心 API 已独立成 Rust crate，后续可以在不改动配置规则的情况下编译到 WASM 或接入 Tauri。
