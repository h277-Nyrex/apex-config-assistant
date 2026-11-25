use std::collections::HashMap;

pub const FOV_BASE: f64 = 70.0;
pub const FOV_STEP: f64 = 0.01375;
pub const FOV_MIN: f64 = 70.0;
pub const FOV_MAX: f64 = 120.0;
pub const APEX_YAW: f64 = 0.022;

const VIDEO_READ_ONLY: [&str; 3] = [
    "setting.last_display_width",
    "setting.last_display_height",
    "setting.configversion",
];

const KNOWN_SETTINGS: [&str; 19] = [
    "mouse_sensitivity",
    "mouse_use_per_scope_sensitivity_scalars",
    "mouse_zoomed_sensitivity_scalar_0",
    "mouse_zoomed_sensitivity_scalar_1",
    "mouse_zoomed_sensitivity_scalar_2",
    "mouse_zoomed_sensitivity_scalar_3",
    "mouse_zoomed_sensitivity_scalar_4",
    "mouse_zoomed_sensitivity_scalar_5",
    "mouse_zoomed_sensitivity_scalar_6",
    "mouse_zoomed_sensitivity_scalar_7",
    "m_acceleration",
    "m_clamp_to_window",
    "sound_volume",
    "sound_num_speakers",
    "voice_scale",
    "voice_vox",
    "voice_modenable",
    "chroma_enable",
    "ui_layout_mode",
];

const KNOWN_PROFILE: [&str; 5] = [
    "cl_fovScale",
    "cl_fps_max",
    "cl_showfps",
    "cl_forcepreload",
    "mouse_sensitivity",
];

const VIDEO_FIELDS: [&str; 22] = [
    "setting.mat_forceaniso",
    "setting.mat_picmip",
    "setting.stream_memory",
    "setting.shadow_enable",
    "setting.shadow_maxdynamic",
    "setting.volumetric_lighting",
    "setting.volumetric_fog",
    "setting.ssao_quality",
    "setting.mat_vsync_mode",
    "setting.mat_antialias_mode",
    "setting.gamma",
    "setting.map_detail_level",
    "setting.fadeDistScale",
    "setting.dvs_enable",
    "setting.fullscreen",
    "setting.nowindowborder",
    "setting.defaultres",
    "setting.defaultresheight",
    "setting.cl_gib_allow",
    "setting.cl_particle_fallback_base",
    "setting.cl_ragdoll_maxcount",
    "setting.configversion",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConfigKind {
    Profile,
    Settings,
    Videoconfig,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigLine {
    pub content: String,
    pub ending: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigEntry {
    pub key: String,
    pub value: String,
    pub line_index: usize,
    pub line_number: usize,
    pub value_start: usize,
    pub value_end: usize,
    pub read_only: bool,
    pub reason: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigDocument {
    pub kind: ConfigKind,
    pub text: String,
    pub lines: Vec<ConfigLine>,
    pub entries: Vec<ConfigEntry>,
    pub unknown_count: usize,
    pub duplicate_count: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Patch {
    pub key: String,
    pub value: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AppliedChange {
    pub key: String,
    pub before: String,
    pub after: String,
    pub line_number: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SkippedChange {
    pub key: String,
    pub reason: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PatchResult {
    pub target_text: String,
    pub applied: Vec<AppliedChange>,
    pub skipped: Vec<SkippedChange>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CalibrationResult {
    pub total: u32,
    pub overshoot_ratio_percent: u32,
    pub recommendation: Option<f64>,
    pub direction: CalibrationDirection,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CalibrationDirection {
    Increase,
    Decrease,
    Hold,
    InsufficientData,
    MissingSensitivity,
}

#[derive(Clone, Debug, PartialEq)]
pub struct PsaSession {
    pub low: f64,
    pub high: f64,
    pub round: u8,
    pub max_rounds: u8,
}

impl PsaSession {
    pub fn new(base: f64, max_rounds: u8) -> Result<Self, &'static str> {
        if !base.is_finite() || base <= 0.0 {
            return Err("base sensitivity must be positive");
        }
        if max_rounds == 0 {
            return Err("max rounds must be positive");
        }
        Ok(Self {
            low: base * 0.5,
            high: base * 1.5,
            round: 1,
            max_rounds,
        })
    }

    pub fn midpoint(&self) -> f64 {
        (self.low + self.high) / 2.0
    }

    pub fn choose_high(&mut self) -> f64 {
        self.low = self.midpoint();
        self.advance()
    }

    pub fn choose_low(&mut self) -> f64 {
        self.high = self.midpoint();
        self.advance()
    }

    pub fn result(&self) -> Option<f64> {
        (self.round > self.max_rounds).then(|| self.midpoint())
    }

    fn advance(&mut self) -> f64 {
        self.round = self.round.saturating_add(1);
        self.midpoint()
    }
}

pub fn parse_config(kind: ConfigKind, text: &str) -> ConfigDocument {
    let lines = split_lines(text);
    let mut entries = Vec::new();
    let mut counts = HashMap::<String, usize>::new();

    for (line_index, line) in lines.iter().enumerate() {
        let content = line.content.as_str();
        if content.trim().is_empty() {
            continue;
        }
        let trimmed = content.trim_start();
        if starts_with_binding(trimmed) {
            entries.push(ConfigEntry {
                key: "bind".to_string(),
                value: trimmed.to_string(),
                line_index,
                line_number: line_index + 1,
                value_start: 0,
                value_end: content.len(),
                read_only: true,
                reason: "按键绑定行不参与数值编辑".to_string(),
            });
            continue;
        }

        let Some((key, _, _, after_key)) = read_token(content, 0) else {
            continue;
        };
        let Some((value, value_start, value_end, _)) = read_token(content, after_key) else {
            continue;
        };
        if kind == ConfigKind::Videoconfig && !key.starts_with("setting.") {
            continue;
        }

        let unknown = !is_known_key(kind, &key);
        let video_read_only =
            kind == ConfigKind::Videoconfig && VIDEO_READ_ONLY.contains(&key.as_str());
        let (read_only, reason) = if video_read_only {
            (true, "由游戏维护的只读键".to_string())
        } else if unknown {
            (true, "当前键目录不认识该键；只读，不猜值".to_string())
        } else {
            (false, String::new())
        };
        counts
            .entry(key.clone())
            .and_modify(|count| *count += 1)
            .or_insert(1);
        entries.push(ConfigEntry {
            key,
            value,
            line_index,
            line_number: line_index + 1,
            value_start,
            value_end,
            read_only,
            reason,
        });
    }

    let mut duplicate_count = 0;
    for entry in &mut entries {
        if counts.get(&entry.key).copied().unwrap_or_default() > 1 {
            entry.read_only = true;
            entry.reason = "重复键：请先在文本中手动清理，工具不猜测哪一行生效".to_string();
            duplicate_count += 1;
        }
    }
    let unknown_count = entries
        .iter()
        .filter(|entry| entry.reason.contains("键目录"))
        .count();

    ConfigDocument {
        kind,
        text: text.to_string(),
        lines,
        entries,
        unknown_count,
        duplicate_count,
    }
}

pub fn patch_config(document: &ConfigDocument, patches: &[Patch]) -> PatchResult {
    let mut lines = document.lines.clone();
    let mut applied = Vec::new();
    let mut skipped = Vec::new();

    for patch in patches {
        let matches: Vec<&ConfigEntry> = document
            .entries
            .iter()
            .filter(|entry| entry.key == patch.key)
            .collect();
        let Some(entry) = matches.last() else {
            skipped.push(SkippedChange {
                key: patch.key.clone(),
                reason: "文件中没有该键，不自动追加".to_string(),
            });
            continue;
        };
        if entry.read_only {
            skipped.push(SkippedChange {
                key: patch.key.clone(),
                reason: entry.reason.clone(),
            });
            continue;
        }
        if entry.value == patch.value {
            continue;
        }
        let line = &mut lines[entry.line_index];
        line.content
            .replace_range(entry.value_start..entry.value_end, &patch.value);
        applied.push(AppliedChange {
            key: patch.key.clone(),
            before: entry.value.clone(),
            after: patch.value.clone(),
            line_number: entry.line_number,
        });
    }

    PatchResult {
        target_text: join_lines(&lines),
        applied,
        skipped,
    }
}

pub fn resolution_patches(width: u32, height: u32) -> [Patch; 4] {
    [
        Patch {
            key: "setting.defaultres".to_string(),
            value: width.to_string(),
        },
        Patch {
            key: "setting.defaultresheight".to_string(),
            value: height.to_string(),
        },
        Patch {
            key: "setting.fullscreen".to_string(),
            value: "1".to_string(),
        },
        Patch {
            key: "setting.nowindowborder".to_string(),
            value: "0".to_string(),
        },
    ]
}

pub fn fov_to_scale(fov: f64) -> f64 {
    1.0 + (clamp(fov, FOV_MIN, FOV_MAX) - FOV_BASE) * FOV_STEP
}

pub fn scale_to_fov(scale: f64) -> Option<f64> {
    scale
        .is_finite()
        .then(|| clamp(FOV_BASE + (scale - 1.0) / FOV_STEP, FOV_MIN, FOV_MAX))
}

pub fn cm360(dpi: f64, sensitivity: f64) -> Option<f64> {
    let value = dpi * sensitivity * APEX_YAW;
    (value > 0.0 && value.is_finite()).then(|| 2.54 * 360.0 / value)
}

pub fn focal_scalar(fov: f64, scope_index: usize) -> f64 {
    const FOV_AXIS: [f64; 5] = [104.0, 106.0, 108.0, 110.0, 120.0];
    const ZOOM_AXIS: [f64; 7] = [1.06, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0];
    const TABLE: [[f64; 7]; 5] = [
        [1.1495, 1.4102, 1.5217, 1.5655, 1.5986, 1.6105, 1.6162],
        [1.1584, 1.4330, 1.5507, 1.5971, 1.6321, 1.6448, 1.6507],
        [1.1678, 1.4571, 1.5813, 1.6303, 1.6674, 1.6809, 1.6872],
        [1.1777, 1.4824, 1.6136, 1.6654, 1.7047, 1.7190, 1.7256],
        [1.2121, 1.6008, 1.7702, 1.8376, 1.8890, 1.9078, 1.9166],
    ];
    if scope_index >= 7 {
        return 1.0;
    }
    let zoom = [1.06, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0][scope_index];
    let fov_point = locate_axis(&FOV_AXIS, clamp(fov, FOV_MIN, FOV_MAX));
    let zoom_point = locate_axis(&ZOOM_AXIS, zoom);
    let top = interpolate(TABLE[fov_point.index], zoom_point.index, zoom_point.t);
    let bottom = interpolate(TABLE[fov_point.index + 1], zoom_point.index, zoom_point.t);
    clamp(top + (bottom - top) * fov_point.t, 0.1, 10.0)
}

pub fn focal_scalars(fov: f64) -> [f64; 8] {
    [
        focal_scalar(fov, 0),
        focal_scalar(fov, 1),
        focal_scalar(fov, 2),
        focal_scalar(fov, 3),
        focal_scalar(fov, 4),
        focal_scalar(fov, 5),
        focal_scalar(fov, 6),
        focal_scalar(fov, 7),
    ]
}

pub fn calibrate(sensitivity: Option<f64>, overshoot: u32, undershoot: u32) -> CalibrationResult {
    let total = overshoot.saturating_add(undershoot);
    let ratio = if total == 0 {
        50
    } else {
        overshoot.saturating_mul(100) / total
    };
    if total < 10 {
        return CalibrationResult {
            total,
            overshoot_ratio_percent: ratio,
            recommendation: None,
            direction: CalibrationDirection::InsufficientData,
        };
    }
    let Some(sensitivity) = sensitivity.filter(|value| value.is_finite() && *value > 0.0) else {
        return CalibrationResult {
            total,
            overshoot_ratio_percent: ratio,
            recommendation: None,
            direction: CalibrationDirection::MissingSensitivity,
        };
    };
    if ratio > 60 {
        CalibrationResult {
            total,
            overshoot_ratio_percent: ratio,
            recommendation: Some(sensitivity * 0.9),
            direction: CalibrationDirection::Decrease,
        }
    } else if ratio < 40 {
        CalibrationResult {
            total,
            overshoot_ratio_percent: ratio,
            recommendation: Some(sensitivity * 1.1),
            direction: CalibrationDirection::Increase,
        }
    } else {
        CalibrationResult {
            total,
            overshoot_ratio_percent: ratio,
            recommendation: Some(sensitivity),
            direction: CalibrationDirection::Hold,
        }
    }
}

fn is_known_key(kind: ConfigKind, key: &str) -> bool {
    match kind {
        ConfigKind::Profile => KNOWN_PROFILE.contains(&key),
        ConfigKind::Settings => KNOWN_SETTINGS.contains(&key),
        ConfigKind::Videoconfig => VIDEO_FIELDS.contains(&key),
    }
}

fn split_lines(text: &str) -> Vec<ConfigLine> {
    let mut lines = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        let ending_len = match bytes[index] {
            b'\r' if bytes.get(index + 1) == Some(&b'\n') => 2,
            b'\r' | b'\n' => 1,
            _ => {
                index += 1;
                continue;
            }
        };
        lines.push(ConfigLine {
            content: text[start..index].to_string(),
            ending: text[index..index + ending_len].to_string(),
        });
        index += ending_len;
        start = index;
    }
    lines.push(ConfigLine {
        content: text[start..].to_string(),
        ending: String::new(),
    });
    lines
}

fn join_lines(lines: &[ConfigLine]) -> String {
    lines
        .iter()
        .map(|line| format!("{}{}", line.content, line.ending))
        .collect()
}

fn starts_with_binding(value: &str) -> bool {
    value.starts_with("bind ")
        || value.starts_with("bind_")
        || value.starts_with("unbind ")
        || value.starts_with("unbind_")
}

fn read_token(text: &str, start: usize) -> Option<(String, usize, usize, usize)> {
    let bytes = text.as_bytes();
    let mut index = start;
    while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
        index += 1;
    }
    let token_start = index;
    if bytes.get(index) == Some(&b'"') {
        index += 1;
        let content_start = index;
        while bytes.get(index).is_some_and(|byte| *byte != b'"') {
            index += 1;
        }
        let content_end = index;
        if bytes.get(index) != Some(&b'"') {
            return None;
        }
        index += 1;
        return Some((
            text[content_start..content_end].to_string(),
            content_start,
            content_end,
            index,
        ));
    }
    while bytes
        .get(index)
        .is_some_and(|byte| !byte.is_ascii_whitespace() && *byte != b'/')
    {
        index += 1;
    }
    (index > token_start).then(|| {
        (
            text[token_start..index].to_string(),
            token_start,
            index,
            index,
        )
    })
}

fn locate_axis(axis: &[f64], value: f64) -> AxisPoint {
    if value <= axis[0] {
        return AxisPoint { index: 0, t: 0.0 };
    }
    if value >= axis[axis.len() - 1] {
        return AxisPoint {
            index: axis.len() - 2,
            t: 1.0,
        };
    }
    for index in 0..axis.len() - 1 {
        if axis[index] <= value && value <= axis[index + 1] {
            return AxisPoint {
                index,
                t: (value - axis[index]) / (axis[index + 1] - axis[index]),
            };
        }
    }
    AxisPoint {
        index: axis.len() - 2,
        t: 1.0,
    }
}

fn interpolate(row: [f64; 7], index: usize, t: f64) -> f64 {
    row[index] + (row[index + 1] - row[index]) * t
}

struct AxisPoint {
    index: usize,
    t: f64,
}

fn clamp(value: f64, low: f64, high: f64) -> f64 {
    value.max(low).min(high)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_patches_known_values_while_preserving_layout() {
        let source = "\"mouse_sensitivity\" \"1.200\"\r\nunknown_key \"keep\"\r\n";
        let document = parse_config(ConfigKind::Settings, source);
        let result = patch_config(
            &document,
            &[Patch {
                key: "mouse_sensitivity".into(),
                value: "1.350".into(),
            }],
        );
        assert_eq!(
            result.target_text,
            "\"mouse_sensitivity\" \"1.350\"\r\nunknown_key \"keep\"\r\n"
        );
        assert_eq!(result.applied.len(), 1);
        assert_eq!(document.unknown_count, 1);
        assert!(result.skipped.is_empty());
    }

    #[test]
    fn rejects_read_only_resolution_keys_and_duplicates() {
        let source = "\"setting.defaultres\" \"1920\"\n\"setting.defaultres\" \"1680\"\n\"setting.last_display_width\" \"1920\"\n\"setting.fullscreen\" \"0\"\n";
        let document = parse_config(ConfigKind::Videoconfig, source);
        let result = patch_config(
            &document,
            &[
                Patch {
                    key: "setting.last_display_width".into(),
                    value: "1440".into(),
                },
                Patch {
                    key: "setting.fullscreen".into(),
                    value: "1".into(),
                },
            ],
        );
        assert_eq!(result.applied.len(), 1);
        assert!(result
            .skipped
            .iter()
            .any(|change| change.key == "setting.last_display_width"));
        assert_eq!(document.duplicate_count, 2);
        assert_eq!(
            document
                .entries
                .iter()
                .filter(|entry| entry.read_only)
                .count(),
            3
        );
    }

    #[test]
    fn resolution_helper_has_exactly_four_safe_keys() {
        let patches = resolution_patches(1440, 1080);
        let keys: Vec<&str> = patches.iter().map(|patch| patch.key.as_str()).collect();
        assert_eq!(
            keys,
            [
                "setting.defaultres",
                "setting.defaultresheight",
                "setting.fullscreen",
                "setting.nowindowborder"
            ]
        );
        assert!(!keys.iter().any(|key| key.contains("last_display")));
    }

    #[test]
    fn fov_and_focal_calculations_match_the_browser_table() {
        assert!((fov_to_scale(110.0) - 1.55).abs() < 1e-12);
        assert_eq!(scale_to_fov(1.55), Some(110.0));
        let scalars = focal_scalars(110.0);
        assert_eq!(scalars.len(), 8);
        assert!((scalars[0] - 1.1777).abs() < 1e-12);
        assert!((scalars[7] - 1.0).abs() < 1e-12);
    }

    #[test]
    fn psa_narrows_to_a_five_round_result() {
        let mut psa = PsaSession::new(1.2, 5).unwrap();
        for _ in 0..5 {
            psa.choose_high();
        }
        assert!(psa.result().is_some());
        assert!(psa.high - psa.low < 0.04);
    }

    #[test]
    fn calibration_obeys_strict_thresholds() {
        assert_eq!(
            calibrate(Some(1.0), 13, 7).direction,
            CalibrationDirection::Decrease
        );
        assert_eq!(
            calibrate(Some(1.0), 7, 13).direction,
            CalibrationDirection::Increase
        );
        assert_eq!(
            calibrate(Some(1.0), 12, 8).direction,
            CalibrationDirection::Hold
        );
        assert_eq!(
            calibrate(Some(1.0), 6, 4).direction,
            CalibrationDirection::Hold
        );
        assert_eq!(
            calibrate(Some(1.0), 4, 5).direction,
            CalibrationDirection::InsufficientData
        );
    }
}
