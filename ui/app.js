/* Apex 配置助手 · 纯浏览器本地版
 * 不探测本机路径、不调用 WebView2、不发起网络请求。
 * 所有数据来自用户手动选择的文件，所有修改先生成差异，再由用户导出。
 */
(() => {
  'use strict';

  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const FILE_KINDS = ['profile', 'settings', 'videoconfig', 'localconfig'];
  const KIND_LABEL = {
    profile: 'profile.cfg',
    settings: 'settings.cfg',
    videoconfig: 'videoconfig.txt',
    localconfig: 'localconfig.vdf'
  };
  const KIND_PATH = {
    profile: '%USERPROFILE%\\Saved Games\\Respawn\\Apex\\profile\\profile.cfg',
    settings: '%USERPROFILE%\\Saved Games\\Respawn\\Apex\\local\\settings.cfg',
    videoconfig: '%USERPROFILE%\\Saved Games\\Respawn\\Apex\\local\\videoconfig.txt',
    localconfig: 'Steam\\userdata\\<SteamID>\\config\\localconfig.vdf'
  };
  const FOV_BASE = 70;
  const FOV_STEP = 0.01375;
  const FOV_MIN = 70;
  const FOV_MAX = 120;
  const APEX_YAW = 0.022;
  const SCOPES = [
    { label: '1x 镜 / 机瞄', zoom: 1.06 },
    { label: '2x 镜', zoom: 2 },
    { label: '3x 镜', zoom: 3 },
    { label: '4x 镜', zoom: 4 },
    { label: '6x 镜', zoom: 6 },
    { label: '8x 镜', zoom: 8 },
    { label: '10x 镜', zoom: 10 },
    { label: '预留槽位（当前未启用）', zoom: 0, reserved: true, note: '该槽位目前没有对应的已启用倍镜；同步时写入中性值 1.000，避免残留旧值。' }
  ];
  const SCOPE_FOV_AXIS = [104, 106, 108, 110, 120];
  const SCOPE_ZOOM_AXIS = [1.06, 2, 3, 4, 6, 8, 10];
  const SCOPE_SCALAR_TABLE = [
    [1.1495, 1.4102, 1.5217, 1.5655, 1.5986, 1.6105, 1.6162],
    [1.1584, 1.4330, 1.5507, 1.5971, 1.6321, 1.6448, 1.6507],
    [1.1678, 1.4571, 1.5813, 1.6303, 1.6674, 1.6809, 1.6872],
    [1.1777, 1.4824, 1.6136, 1.6654, 1.7047, 1.7190, 1.7256],
    [1.2121, 1.6008, 1.7702, 1.8376, 1.8890, 1.9078, 1.9166]
  ];
  const READONLY_VIDEO = new Set(['setting.last_display_width', 'setting.last_display_height', 'setting.configversion']);
  const PAGE_META = {
    loader: ['文件工作台', '手动载入 Apex 文件后开始分析'],
    dashboard: ['当前配置', '复核真实当前值、文件来源与解析结果'],
    aim: ['视野与灵敏度', 'FOV、腰射、8 档倍镜与科学测算'],
    graphics: ['画质与分辨率', '只改目标行，只读键永不写入'],
    launch: ['启动参数', '生成 LaunchOptions；可选 localconfig.vdf'],
    export: ['导出与恢复', '审阅差异、下载修改文件与原始回滚包']
  };

  const VIDEO_FIELDS = [
    { key: 'setting.mat_forceaniso', name: '远处纹理清晰度', description: '等级越高，远处地面和墙面越清楚，也会增加显卡负载', kind: 'enum', options: [['双线性', '0'], ['三线性', '1'], ['2x', '2'], ['4x', '4'], ['8x', '8'], ['16x', '16']] },
    { key: 'setting.mat_picmip', name: '纹理质量', description: '提高后皮肤和场景更清晰，同时占用更多显存', kind: 'enum', options: [['高', '0'], ['标准', '1'], ['低', '2']] },
    { key: 'setting.stream_memory', name: '纹理串流预算', description: '按显存选择；越高占用越大、纹理越清晰', kind: 'enum', options: [['禁用', '0'], ['6G', '160000'], ['7G', '300000'], ['8G', '600000'], ['10G', '1000000'], ['12G', '2000000'], ['16G', '3000000']] },
    { key: 'setting.shadow_enable', name: '场景阴影', description: '关闭可明显减轻显卡负载；竞技帧率优先时通常关闭', kind: 'bool', onValue: '1' },
    { key: 'setting.shadow_maxdynamic', name: '动态光源阴影', description: '让移动光源产生实时阴影，画面更自然但负载更高', kind: 'enum', options: [['禁用', '0'], ['启用', '4.0']] },
    { key: 'setting.volumetric_lighting', name: '体积光', description: '关闭可减少显卡负载', kind: 'bool', onValue: '1' },
    { key: 'setting.volumetric_fog', name: '体积雾', description: '低配电脑建议关闭', kind: 'bool', onValue: '1' },
    { key: 'setting.ssao_quality', name: '环境阴影', description: '增强墙角和物体接触处的阴影层次', kind: 'enum', options: [['禁用', '0'], ['低', '1'], ['中', '2'], ['高', '3']] },
    { key: 'setting.mat_vsync_mode', name: '垂直同步', description: '可能增加操作延迟；竞技玩家通常关闭', kind: 'enum', options: [['禁用', '0'], ['双缓冲', '1'], ['三重缓冲', '2'], ['自适应', '3'], ['自适应半刷新率', '4']] },
    { key: 'setting.mat_antialias_mode', name: 'TSAA 抗锯齿', description: '关闭可减少处理开销，开启可减少边缘闪烁', kind: 'enum', options: [['禁用', '0'], ['启用(TSAA)', '12']] },
    { key: 'setting.gamma', name: '画面亮度', description: '调高后暗处更容易看清，过高会让画面发白', kind: 'float', min: 0.5, max: 2.5, step: 0.05 },
    { key: 'setting.map_detail_level', name: '地图细节', description: '低细节可减少部分场景负载', kind: 'enum', options: [['低', '1'], ['高', '2']] },
    { key: 'setting.fadeDistScale', name: '物体显示距离', description: '调低可减少远处物体显示距离，换取更稳定帧率', kind: 'float', min: 0.5, max: 1, step: 0.05 },
    { key: 'setting.dvs_enable', name: '自适应分辨率', description: '帧率不足时自动降低画面清晰度', kind: 'bool', onValue: '1.0' },
    { key: 'setting.fullscreen', name: '全屏', description: '全屏模式优先于无边框', kind: 'bool', onValue: '1' },
    { key: 'setting.nowindowborder', name: '无边框窗口化', description: '无边框窗口模式', kind: 'bool', onValue: '1' },
    { key: 'setting.defaultres', name: '默认分辨率宽', description: '由上方分辨率选择器统一下发', kind: 'int', managed: true },
    { key: 'setting.defaultresheight', name: '默认分辨率高', description: '由上方分辨率选择器统一下发', kind: 'int', managed: true },
    { key: 'setting.cl_gib_allow', name: '残骸效果', description: '关闭后减少战斗中的物理效果', kind: 'bool', onValue: '1.0' },
    { key: 'setting.cl_particle_fallback_base', name: '战斗特效数量', description: '调低可减轻团战负载', kind: 'enum', options: [['低', '3'], ['中/高', '0']] },
    { key: 'setting.cl_ragdoll_maxcount', name: '物理效果数量', description: '减少同屏物理效果，有助于缓解掉帧', kind: 'enum', options: [['低', '0'], ['中', '4'], ['高', '8']] }
  ];
  const VIDEO_FIELD_MAP = new Map(VIDEO_FIELDS.map(field => [field.key, field]));
  const VIDEO_PRESETS = [
    { id: 'fps', name: '竞技低画质', tag: '排位', description: '关闭阴影、体积光与特效，优先稳定高帧率。', values: { 'setting.shadow_enable': '0', 'setting.volumetric_lighting': '0', 'setting.volumetric_fog': '0', 'setting.ssao_quality': '0', 'setting.mat_antialias_mode': '0', 'setting.cl_gib_allow': '0', 'setting.cl_particle_fallback_base': '3' } },
    { id: 'balanced', name: '均衡', tag: '日常', description: '保留部分阴影和抗锯齿，兼顾画面和帧率。', values: { 'setting.shadow_enable': '1', 'setting.volumetric_lighting': '1', 'setting.volumetric_fog': '0', 'setting.ssao_quality': '1', 'setting.mat_antialias_mode': '12' } },
    { id: 'quality', name: '画质优先', tag: '截图', description: '保留阴影、体积光和抗锯齿，适合非排位场景。', values: { 'setting.shadow_enable': '1', 'setting.volumetric_lighting': '1', 'setting.volumetric_fog': '1', 'setting.ssao_quality': '3', 'setting.mat_antialias_mode': '12', 'setting.mat_picmip': '0' } },
    { id: 'contrast', name: '对比度强化', tag: '找人', description: '关闭柔和效果，保留清晰纹理和亮度。', values: { 'setting.shadow_enable': '0', 'setting.volumetric_lighting': '0', 'setting.volumetric_fog': '0', 'setting.ssao_quality': '0', 'setting.mat_picmip': '0', 'setting.gamma': '1.1' } }
  ];
  const RESOLUTIONS = [
    { id: '1920x1080', width: 1920, height: 1080, label: '1920 × 1080 · 16:9' },
    { id: '2560x1440', width: 2560, height: 1440, label: '2560 × 1440 · 16:9' },
    { id: '1440x1080', width: 1440, height: 1080, label: '1440 × 1080 · 4:3 拉伸' },
    { id: '1680x1050', width: 1680, height: 1050, label: '1680 × 1050 · 16:10 拉伸' },
    { id: '1728x1080', width: 1728, height: 1080, label: '1728 × 1080 · 16:10' },
    { id: '1280x960', width: 1280, height: 960, label: '1280 × 960 · 4:3 拉伸' }
  ];
  const LAUNCH_CATALOG = [
    { key: 'novid', token: '-novid', name: '跳过开场动画', description: '缩短启动等待时间', category: '启动' },
    { key: 'high', token: '-high', name: '高 CPU 优先级', description: '让游戏进程获得更高调度优先级', category: '性能' },
    { key: 'fps240', token: '+fps_max 240', name: '帧率上限 240', description: '适合 240Hz 显示器', category: '帧率' },
    { key: 'fps0', token: '+fps_max 0', name: '解锁帧率', description: '移除帧率上限，按硬件能力运行', category: '帧率' },
    { key: 'showfps', token: '+cl_showfps 1', name: '显示 FPS / 网络', description: '右上角显示性能信息', category: '监控' },
    { key: 'rawinput', token: '-m_rawinput 1', name: '原始鼠标输入', description: '旧版原始输入参数', category: '输入' },
    { key: 'preload', token: '+cl_forcepreload 1', name: '强制预加载', description: '减少部分场景加载等待', category: '性能' },
    { key: 'nojoy', token: '-nojoy', name: '禁用摇杆', description: '不使用手柄时可减少输入轮询', category: '输入' },
    { key: 'novid2', token: '-windowed', name: '窗口化启动', description: '仅用于排查显示问题', category: '排查' },
    { key: 'fullscreen', token: '-fullscreen', name: '全屏启动', description: '以全屏模式启动', category: '显示' }
  ];
  const PRO_PRESETS = [
    { id: 'imperialhal', name: 'ImperialHal · 稳健低敏型', dpi: 400, sens: 2.0, fov: 110, resolution: '1920x1080', quality: 'fps' },
    { id: 'iitztimmy', name: 'iiTzTimmy · 身法高敏型', dpi: 1800, sens: 1.1, fov: 110, resolution: '1920x1080', quality: 'balanced' },
    { id: 'chisnow', name: '赤雪 · 4:3 拉伸透视型', dpi: 800, sens: 1.2, fov: 110, resolution: '1440x1080', quality: 'contrast' }
  ];
  const KNOWN_SETTINGS = new Set([
    'mouse_sensitivity', 'mouse_use_per_scope_sensitivity_scalars',
    'mouse_zoomed_sensitivity_scalar_0', 'mouse_zoomed_sensitivity_scalar_1',
    'mouse_zoomed_sensitivity_scalar_2', 'mouse_zoomed_sensitivity_scalar_3',
    'mouse_zoomed_sensitivity_scalar_4', 'mouse_zoomed_sensitivity_scalar_5',
    'mouse_zoomed_sensitivity_scalar_6', 'mouse_zoomed_sensitivity_scalar_7',
    'm_acceleration', 'm_clamp_to_window', 'sound_volume', 'sound_num_speakers',
    'voice_scale', 'voice_vox', 'voice_modenable', 'chroma_enable', 'ui_layout_mode'
  ]);
  const KNOWN_PROFILE = new Set(['cl_fovScale', 'cl_fps_max', 'cl_showfps', 'cl_forcepreload', 'mouse_sensitivity']);

  const state = {
    route: 'loader',
    files: { profile: null, settings: null, videoconfig: null, localconfig: null },
    drafts: {
      aim: null,
      graphics: {},
      launch: { selected: new Set(), custom: '' }
    },
    settings: { dpi: 800, pad: 45, grip: 'wrist' },
    review: null,
    reviewStale: false,
    lastExportAt: null,
    session: null,
    psa: { base: null, round: 1, result: null },
    calibration: { over: 0, under: 0, result: null },
    reticle: { r: 150, g: 350, b: 150 },
    pro: { id: 'imperialhal', modules: { aim: true, quality: true, launch: false }, diff: null, selected: null },
    search: '',
    toastTimer: null,
    modalResolve: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const num = (value, fallback = null) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const fixed = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };
  const formatTime = (value) => {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
  };
  const round = (value, digits = 4) => {
    if (!Number.isFinite(Number(value))) return '';
    return String(Number(Number(value).toFixed(digits)));
  };
  const fovToScale = (fov) => 1 + (clamp(Number(fov), FOV_MIN, FOV_MAX) - FOV_BASE) * FOV_STEP;
  const scaleToFov = (scale) => {
    const value = Number(scale);
    return Number.isFinite(value) ? clamp(FOV_BASE + (value - 1) / FOV_STEP, FOV_MIN, FOV_MAX) : null;
  };
  const cm360 = (dpi, sens) => {
    const value = Number(dpi) * Number(sens) * APEX_YAW;
    return value > 0 ? 2.54 * 360 / value : null;
  };
  const locateAxis = (axis, value) => {
    if (value <= axis[0]) return { index: 0, t: 0 };
    if (value >= axis[axis.length - 1]) return { index: axis.length - 2, t: 1 };
    for (let index = 0; index < axis.length - 1; index += 1) {
      if (axis[index] <= value && value <= axis[index + 1]) {
        return { index, t: (value - axis[index]) / (axis[index + 1] - axis[index]) };
      }
    }
    return { index: axis.length - 2, t: 1 };
  };
  const focalScalar = (fov, scopeIndex) => {
    const scope = SCOPES[scopeIndex] || SCOPES[0];
    if (scope.reserved || scope.zoom <= 0) return 1;
    const row = locateAxis(SCOPE_FOV_AXIS, clamp(Number(fov) || 104, FOV_MIN, FOV_MAX));
    const column = locateAxis(SCOPE_ZOOM_AXIS, scope.zoom);
    const top = SCOPE_SCALAR_TABLE[row.index][column.index]
      + (SCOPE_SCALAR_TABLE[row.index][column.index + 1] - SCOPE_SCALAR_TABLE[row.index][column.index]) * column.t;
    const bottom = SCOPE_SCALAR_TABLE[row.index + 1][column.index]
      + (SCOPE_SCALAR_TABLE[row.index + 1][column.index + 1] - SCOPE_SCALAR_TABLE[row.index + 1][column.index]) * column.t;
    return Math.max(0.1, Math.min(10, top + (bottom - top) * row.t));
  };
  const uuid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2));

  function showError(error, title = '操作失败') {
    const box = $('#global-error');
    if (!box) return;
    $('#global-error-title').textContent = title;
    $('#global-error-text').textContent = error && error.message ? error.message : String(error || '未知错误');
    box.hidden = false;
    setStatus('error', '需要处理');
  }

  function hideError() {
    const box = $('#global-error');
    if (box) box.hidden = true;
  }

  function setStatus(kind, text) {
    const dot = $('#status-dot');
    if (dot) dot.className = 'dot' + (kind === 'error' ? ' danger' : kind === 'warn' ? ' warn' : kind === 'busy' ? ' warn' : '');
    if (text) $('#status-text').textContent = text;
  }

  function toast(message, kind = 'ok') {
    const box = $('#toast');
    if (!box) return;
    box.hidden = false;
    box.querySelector('svg').style.color = kind === 'bad' ? 'var(--apex-red)' : kind === 'warn' ? 'var(--status-warn)' : 'var(--status-ready)';
    $('#toast-text').textContent = message;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { box.hidden = true; }, 3800);
  }

  function navigate(page) {
    const next = PAGE_META[page] ? page : 'loader';
    if (location.hash.slice(1) !== next) {
      location.hash = next;
    } else {
      state.route = next;
      renderShell();
    }
  }

  function currentRoute() {
    const page = location.hash.slice(1);
    return PAGE_META[page] ? page : 'loader';
  }

  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function downloadBytes(name, bytes, type = 'application/octet-stream') {
    downloadBlob(name, new Blob([bytes], { type }));
  }

  function downloadText(name, text, type = 'text/plain;charset=utf-8') {
    downloadBlob(name, new Blob([text], { type }));
  }

  function copyText(text) {
    const value = String(text == null ? '' : text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(() => true).catch(() => fallbackCopy(value));
    }
    return Promise.resolve(fallbackCopy(value));
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    area.remove();
    return ok;
  }

  function lineParts(text) {
    const lines = [];
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
      const ch = text[index];
      if (ch === '\r' || ch === '\n') {
        let ending = ch;
        if (ch === '\r' && text[index + 1] === '\n') {
          ending = '\r\n';
          index += 1;
        }
        lines.push({ content: text.slice(start, index - (ending.length - 1)), ending });
        start = index + 1;
      }
    }
    lines.push({ content: text.slice(start), ending: '' });
    return lines;
  }

  function joinLines(lines) {
    return lines.map(line => line.content + line.ending).join('');
  }

  function detectDecoding(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return { encoding: 'utf-8', hasBom: true, body: bytes.slice(3), warning: '' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return { encoding: 'utf-16le', hasBom: true, body: bytes.slice(2), warning: '' };
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return { encoding: 'utf-16be', hasBom: true, body: bytes.slice(2), warning: '' };
    }
    return { encoding: 'utf-8', hasBom: false, body: bytes, warning: '' };
  }

  function decodeBytes(bytes) {
    const detected = detectDecoding(bytes);
    try {
      const decoder = new TextDecoder(detected.encoding, { fatal: true });
      return { ...detected, text: decoder.decode(detected.body), warning: detected.warning };
    } catch (_) {
      try {
        const decoder = new TextDecoder('windows-1252');
        return { ...detected, encoding: 'windows-1252', text: decoder.decode(detected.body), warning: '文件不是合法 UTF-8，已按 Windows-1252 读取；请确认内容没有乱码。' };
      } catch (_) {
        return { ...detected, text: '', warning: '无法识别文件编码。' };
      }
    }
  }

  const CP1252_SPECIAL_BYTES = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
    [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
    [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
    [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
    [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
    [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
  ]);
  const CP1252_UNDEFINED_C1 = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

  function encodeCp1252(text) {
    const bytes = [];
    for (const char of text) {
      const codePoint = char.codePointAt(0);
      let byte = null;
      if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff) || CP1252_UNDEFINED_C1.has(codePoint)) {
        byte = codePoint;
      } else if (CP1252_SPECIAL_BYTES.has(codePoint)) {
        byte = CP1252_SPECIAL_BYTES.get(codePoint);
      }
      if (byte == null) {
        const shown = codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0) ? `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}` : char;
        throw new Error(`文件使用 Windows-1252 编码，但修改后的内容包含无法写回的字符“${shown}”。请使用纯英文/西欧字符，或先把文件转换为 UTF-8。`);
      }
      bytes.push(byte);
    }
    return Uint8Array.from(bytes);
  }

  function encodeText(text, encoding, hasBom) {
    let body;
    if (encoding === 'utf-16le' || encoding === 'utf-16be') {
      const little = encoding === 'utf-16le';
      body = new Uint8Array(text.length * 2);
      for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        body[index * 2 + (little ? 0 : 1)] = code & 0xff;
        body[index * 2 + (little ? 1 : 0)] = code >> 8;
      }
    } else if (encoding === 'windows-1252') {
      body = encodeCp1252(text);
    } else {
      body = new TextEncoder().encode(text);
    }
    if (!hasBom) return body;
    const bom = encoding === 'utf-16be' ? [0xfe, 0xff] : encoding === 'utf-16le' ? [0xff, 0xfe] : [0xef, 0xbb, 0xbf];
    const out = new Uint8Array(bom.length + body.length);
    out.set(bom, 0);
    out.set(body, bom.length);
    return out;
  }

  function detectNewline(text) {
    return text.includes('\r\n') ? 'CRLF' : text.includes('\n') ? 'LF' : text.includes('\r') ? 'CR' : 'LF';
  }

  function sha256Fallback(bytes) {
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const bitLength = bytes.length * 8;
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
    view.setUint32(paddedLength - 4, bitLength >>> 0, false);
    const words = new Uint32Array(64);
    const rotr = (value, shift) => (value >>> shift) | (value << (32 - shift));
    for (let offset = 0; offset < paddedLength; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
      for (let index = 16; index < 64; index += 1) {
        const s0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3);
        const s1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10);
        words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
      }
      let a = h0;
      let b = h1;
      let c = h2;
      let d = h3;
      let e = h4;
      let f = h5;
      let g = h6;
      let h = h7;
      for (let index = 0; index < 64; index += 1) {
        const sum1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const choice = (e & f) ^ (~e & g);
        const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
        const sum0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (sum0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map(value => value.toString(16).padStart(8, '0'))
      .join('');
  }

  async function sha256Hex(bytes) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
    }
    return sha256Fallback(bytes);
  }

  function parseCfg(text, kind) {
    const lines = lineParts(text);
    const items = [];
    const counts = new Map();
    const settingPattern = /^\s*"?(setting\.[A-Za-z0-9_]+)"?\s+"([^"]*)"\s*(?:\/\/.*)?$/d;
    const quotedPattern = /^\s*([A-Za-z0-9_.]+)\s+"([^"]*)"\s*(?:\/\/.*)?$/d;
    const barePattern = /^\s*([A-Za-z0-9_.]+)\s+([^\s/][^\s]*)\s*(?:\/\/.*)?$/d;

    lines.forEach((line, lineIndex) => {
      const content = line.content;
      if (!content.trim()) return;
      if (/^\s*(bind|unbind)(?:_[A-Za-z0-9_]+)?\s+/i.test(content)) {
        items.push({ key: 'bind', value: content.trim(), lineIndex, lineNumber: lineIndex + 1, valueStart: 0, valueEnd: content.length, readOnly: true, reason: '按键绑定行不参与数值编辑' });
        return;
      }
      const pattern = kind === 'videoconfig' ? settingPattern : quotedPattern;
      const match = pattern.exec(content) || (kind !== 'videoconfig' ? barePattern.exec(content) : null);
      if (!match) return;
      const key = match[1];
      const value = match[2];
      const span = match.indices && match.indices[2];
      const valueStart = span ? span[0] : content.indexOf(value);
      const valueEnd = span ? span[1] : valueStart + value.length;
      const unknown = kind === 'videoconfig' ? !VIDEO_FIELD_MAP.has(key) : kind === 'settings' ? !KNOWN_SETTINGS.has(key) : !KNOWN_PROFILE.has(key);
      const readOnly = (kind === 'videoconfig' && READONLY_VIDEO.has(key)) || unknown;
      const reason = READONLY_VIDEO.has(key) ? '由游戏维护的只读键' : unknown ? '当前键目录不认识该键；只读，不猜值' : '';
      items.push({ key, value, lineIndex, lineNumber: lineIndex + 1, valueStart, valueEnd, readOnly, reason });
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    items.forEach(item => {
      if ((counts.get(item.key) || 0) > 1) {
        item.readOnly = true;
        item.reason = '重复键：请先在文本中手动清理，工具不猜测哪一行生效';
      }
    });

    const unknownCount = items.filter(item => item.reason && item.reason.includes('键目录')).length;
    const duplicateCount = items.filter(item => item.reason && item.reason.includes('重复')).length;
    return { lines, items, counts, unknownCount, duplicateCount };
  }

  function detectKind(text, name) {
    if (/"VideoConfig"|^\s*"?setting\.[A-Za-z0-9_]+"?\s+"/m.test(text)) return 'videoconfig';
    if (/"LaunchOptions"\s+"/.test(text)) return 'localconfig';
    if (/\bmouse_sensitivity\b/.test(text)) return 'settings';
    if (/\bcl_fovScale\b|\bbind(?:_[A-Za-z0-9_]+)?\b/.test(text)) return 'profile';
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('videoconfig.txt')) return 'videoconfig';
    if (lower.endsWith('localconfig.vdf')) return 'localconfig';
    if (lower.endsWith('settings.cfg')) return 'settings';
    if (lower.endsWith('profile.cfg')) return 'profile';
    return null;
  }

  function findVdfBlockEnd(text, openBrace) {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = openBrace; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return text.length;
  }

  function parseLocalconfig(text) {
    const lines = lineParts(text);
    let searchStart = 0;
    let searchEnd = text.length;
    const appMatch = /"1172470"\s*\{/d.exec(text);
    if (appMatch) {
      searchStart = appMatch.index + appMatch[0].lastIndexOf('{');
      searchEnd = findVdfBlockEnd(text, searchStart);
    }
    const match = /"LaunchOptions"\s+"((?:\\.|[^"\\])*)"/d.exec(text.slice(searchStart, searchEnd));
    let launchOptions = '';
    let launchSpan = null;
    if (match) {
      const start = searchStart + match.indices[1][0];
      const end = searchStart + match.indices[1][1];
      launchOptions = text.slice(start, end).replace(/\\(["\\])/g, '$1');
      launchSpan = { start, end };
    }
    return { lines, items: [], launchOptions, launchSpan, unknownCount: 0, duplicateCount: 0 };
  }

  async function parseFileBytes(kind, name, bytes, lastModified) {
    const decoded = decodeBytes(bytes);
    const Warnings = [];
    if (decoded.warning) Warnings.push(decoded.warning);
    const parsed = kind === 'localconfig' ? parseLocalconfig(decoded.text) : parseCfg(decoded.text, kind);
    const detected = detectKind(decoded.text, name);
    if (detected && detected !== kind) Warnings.push(`文件内容更像 ${KIND_LABEL[detected]}，但放在了 ${KIND_LABEL[kind]} 槽位。`);
    if (parsed.unknownCount) Warnings.push(`发现 ${parsed.unknownCount} 个当前目录未知的键，已按只读处理。`);
    if (parsed.duplicateCount) Warnings.push(`发现 ${parsed.duplicateCount} 个重复键，已按只读处理。`);
    if (kind === 'localconfig' && !parsed.launchSpan) Warnings.push('未找到 "LaunchOptions" 字段；只能复制参数，不能生成 VDF 差异。');
    return {
      kind,
      name: name || KIND_LABEL[kind],
      size: bytes.length,
      lastModified: lastModified || Date.now(),
      bytes,
      text: decoded.text,
      encoding: decoded.encoding,
      hasBom: decoded.hasBom,
      newline: detectNewline(decoded.text),
      lineCount: parsed.lines.length,
      lines: parsed.lines,
      items: parsed.items,
      launchOptions: parsed.launchOptions || '',
      launchSpan: parsed.launchSpan || null,
      sha256: await sha256Hex(bytes),
      detectedKind: detected,
      warnings: Warnings
    };
  }

  function itemByKey(file, key, last = true) {
    if (!file) return null;
    const matches = file.items.filter(item => item.key === key);
    return matches.length ? matches[last ? matches.length - 1 : 0] : null;
  }

  function fileValue(kind, key) {
    const item = itemByKey(state.files[kind], key);
    return item ? item.value : null;
  }

  function getAimSnapshot() {
    const profile = state.files.profile;
    const settings = state.files.settings;
    const video = state.files.videoconfig;
    const fovItem = itemByKey(profile, 'cl_fovScale') || itemByKey(video, 'setting.cl_fovScale');
    const fovScale = fovItem ? num(fovItem.value, null) : null;
    const fov = fovScale == null ? null : scaleToFov(fovScale);
    const sensItem = itemByKey(settings, 'mouse_sensitivity');
    const sens = sensItem ? num(sensItem.value, null) : null;
    const perScopeItem = itemByKey(settings, 'mouse_use_per_scope_sensitivity_scalars');
    const perScope = perScopeItem ? perScopeItem.value !== '0' : null;
    const scopes = Array.from({ length: 8 }, (_, index) => {
      const item = itemByKey(settings, 'mouse_zoomed_sensitivity_scalar_' + index);
      return { index, key: 'mouse_zoomed_sensitivity_scalar_' + index, item, value: item ? num(item.value, null) : null };
    });
    return { profile, settings, video, fovItem, fovScale, fov, sensItem, sens, perScopeItem, perScope, scopes };
  }

  function getGraphicsSnapshot() {
    const file = state.files.videoconfig;
    const values = {};
    VIDEO_FIELDS.forEach(field => {
      const item = itemByKey(file, field.key);
      values[field.key] = item ? item.value : null;
    });
    const width = num(values['setting.defaultres'], null);
    const height = num(values['setting.defaultresheight'], null);
    const fullscreen = values['setting.fullscreen'];
    const borderless = values['setting.nowindowborder'];
    return { file, values, width, height, fullscreen, borderless };
  }

  function currentLaunchOptions() {
    const file = state.files.localconfig;
    return file ? file.launchOptions : '';
  }

  function selectedFileCount() {
    return FILE_KINDS.filter(kind => state.files[kind]).length;
  }

  function setFile(kind, file) {
    const firstLocalconfig = kind === 'localconfig' && !state.files.localconfig;
    state.files[kind] = file;
    if (state.review) state.reviewStale = true;
    syncDraftsFromFiles({ preserve: true, initializeLaunch: firstLocalconfig });
    renderShell();
    queueSessionSave();
    toast(`${KIND_LABEL[kind]} 已载入`, 'ok');
  }

  function removeFile(kind) {
    state.files[kind] = null;
    if (state.review) state.reviewStale = true;
    syncDraftsFromFiles({ preserve: true });
    renderShell();
    queueSessionSave();
  }

  async function ingestFile(kind, file) {
    try {
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} 超过 2 MB 上限，未载入。`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseFileBytes(kind, file.name, bytes, file.lastModified);
      if (parsed.detectedKind && parsed.detectedKind !== kind) {
        const strongMismatch = parsed.detectedKind === 'videoconfig' || parsed.detectedKind === 'localconfig';
        if (strongMismatch) throw new Error(`这个文件看起来是 ${KIND_LABEL[parsed.detectedKind]}，请放到正确槽位。`);
      }
      if ((kind === 'profile' || kind === 'settings') && !parsed.items.length) {
        throw new Error('没有识别到任何配置行。请确认这是 Apex 的配置文件，而不是其它文本。');
      }
      setFile(kind, parsed);
    } catch (error) {
      showError(error, '文件载入失败');
      toast(error.message || '文件载入失败', 'bad');
      renderFileSlots();
    }
  }

  function syncDraftsFromFiles({ preserve = false, initializeLaunch = false } = {}) {
    const previousAim = state.drafts.aim;
    const previousGraphics = state.drafts.graphics;
    const previousLaunch = state.drafts.launch;
    const aim = getAimSnapshot();
    if (aim.profile || aim.settings) {
      state.drafts.aim = {
        fov: preserve && previousAim ? previousAim.fov : aim.fov,
        sens: preserve && previousAim ? previousAim.sens : aim.sens,
        scopeMode: preserve && previousAim ? previousAim.scopeMode : 'keep',
        scopeTargets: preserve && previousAim && Array.isArray(previousAim.scopeTargets)
          ? previousAim.scopeTargets.slice()
          : aim.scopes.map(scope => scope.value)
      };
    } else {
      state.drafts.aim = null;
    }
    if (!preserve) state.drafts.graphics = {};
    if (!preserve) state.drafts.launch = { selected: new Set(), custom: '' };
    if (!preserve) {
      state.psa = { base: aim.sens, round: 1, result: null };
      state.calibration.result = null;
    }
    if (state.files.localconfig && (!preserve || initializeLaunch)) {
      const current = currentLaunchOptions();
      const selected = new Set();
      LAUNCH_CATALOG.forEach(option => {
        if (current.includes(option.token)) selected.add(option.key);
      });
      state.drafts.launch.selected = selected;
      state.drafts.launch.custom = '';
    }
  }

  function markDirty() {
    if (state.review) state.reviewStale = true;
    queueSessionSave();
    renderExport();
  }

  function renderShell() {
    const route = currentRoute();
    state.route = route;
    document.body.dataset.page = route;
    const meta = PAGE_META[route];
    const title = $('[data-testid="page-title"]');
    const subtitle = $('[data-testid="page-subtitle"]');
    if (title) title.textContent = meta[0];
    if (subtitle) subtitle.textContent = meta[1];
    $$('.nav a[data-nav]').forEach(link => {
      const active = link.dataset.nav === route;
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $$('.page').forEach(page => page.classList.toggle('is-active', page.dataset.page === route));
    const count = selectedFileCount();
    const navCount = $('#nav-file-count');
    if (navCount) navCount.textContent = `${count}/4`;
    renderShellStatus();
    if (route === 'loader') renderLoader();
    if (route === 'dashboard') renderDashboard();
    if (route === 'aim') renderAim();
    if (route === 'graphics') renderGraphics();
    if (route === 'launch') renderLaunch();
    if (route === 'export') renderExport();
    $('.content')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function renderShellStatus() {
    const count = selectedFileCount();
    const exported = state.lastExportAt ? '已导出 ' + formatTime(state.lastExportAt) : '尚未导出';
    const chipFiles = $('#chip-files');
    if (chipFiles) chipFiles.innerHTML = `<span class="dot ${count ? 'ok' : 'mute'}"></span><span>文件 ${count}/4</span>`;
    const chipMode = $('#chip-mode');
    if (chipMode) chipMode.innerHTML = '<span class="dot ok"></span><span>本地解析</span>';
    const chipExport = $('#chip-export');
    if (chipExport) chipExport.innerHTML = `<span class="dot ${state.reviewStale ? 'warn' : state.review ? 'ok' : 'mute'}"></span><span>${state.reviewStale ? '审阅单已过期' : exported}</span>`;
    const statusCount = $('#status-file-count');
    if (statusCount) statusCount.textContent = `文件 ${count}/4`;
    const statusLast = $('#status-last');
    if (statusLast) statusLast.textContent = state.lastExportAt ? '最近导出：' + formatTime(state.lastExportAt) : count ? '文件已载入，尚未导出' : '未载入文件';
  }

  function renderLoader() {
    renderFileSlots();
    const aim = getAimSnapshot();
    const count = selectedFileCount();
    const progress = $('#file-progress');
    if (progress) progress.textContent = `${count} / 4 已载入`;
    const kpiFiles = $('#kpi-files');
    if (kpiFiles) kpiFiles.innerHTML = `${count}<small>/4</small>`;
    const kpiFoot = $('#kpi-files-foot');
    if (kpiFoot) kpiFoot.textContent = count ? (count === 4 ? '全部文件已载入' : '还可以继续补充文件') : '等待手动上传';
    const kpiFov = $('#kpi-fov');
    if (kpiFov) kpiFov.textContent = aim.fov == null ? '—' : Math.round(aim.fov);
    const kpiFovFoot = $('#kpi-fov-foot');
    if (kpiFovFoot) kpiFovFoot.textContent = aim.fovItem ? `来源：${KIND_LABEL.profile} 第 ${aim.fovItem.lineNumber} 行` : '没有 profile.cfg';
    const kpiSens = $('#kpi-sens');
    if (kpiSens) kpiSens.textContent = aim.sens == null ? '—' : fixed(aim.sens, 3);
    const kpiSensFoot = $('#kpi-sens-foot');
    if (kpiSensFoot) kpiSensFoot.textContent = aim.sensItem ? `来源：${KIND_LABEL.settings} 第 ${aim.sensItem.lineNumber} 行` : '没有 settings.cfg';
    const sessionBanner = $('#session-banner');
    if (sessionBanner) sessionBanner.hidden = !state.session || count > 0;
    const sessionText = $('#session-text');
    if (sessionText && state.session) sessionText.textContent = `上次会话：${state.session.savedAt ? formatTime(state.session.savedAt) : '浏览器本地缓存'}，包含 ${Object.keys(state.session.files || {}).length} 个文件。`;
  }

  function renderFileSlots() {
    FILE_KINDS.forEach(kind => {
      const slot = $(`[data-kind="${kind}"]`);
      if (!slot) return;
      const file = state.files[kind];
      const stateEl = $('[data-state]', slot);
      const metaEl = $('[data-meta]', slot);
      const removeButton = $(`[data-file-remove="${kind}"]`, slot);
      slot.classList.toggle('is-loaded', !!file);
      slot.classList.toggle('is-error', false);
      if (!file) {
        if (stateEl) { stateEl.textContent = kind === 'localconfig' ? '可选' : '未载入'; stateEl.className = 'file-state'; }
        if (metaEl) metaEl.innerHTML = '<span class="muted">尚未选择文件</span>';
        if (removeButton) removeButton.hidden = true;
        return;
      }
      const hasWarning = file.warnings.length > 0;
      if (stateEl) {
        stateEl.textContent = hasWarning ? '已载入 · 有提示' : '已载入';
        stateEl.className = 'file-state ' + (hasWarning ? 'warn' : 'ok');
      }
      if (metaEl) {
        const unknown = file.items.filter(item => item.reason && item.reason.includes('键目录')).length;
        metaEl.innerHTML = [
          `<span class="mono">${esc(file.name)}</span>`,
          `<span>${formatBytes(file.size)}</span>`,
          `<span>${esc(file.encoding.toUpperCase())}${file.hasBom ? ' + BOM' : ''} · ${esc(file.newline)}</span>`,
          `<span>${file.lineCount} 行 · ${file.items.filter(item => item.key !== 'bind').length} 个键</span>`,
          `<span class="mono">sha ${esc(file.sha256.slice(0, 12))}</span>`,
          unknown ? `<span class="warn-text">未知 ${unknown} 项</span>` : ''
        ].join('');
      }
      if (removeButton) removeButton.hidden = false;
    });
    const status = $('#file-progress');
    if (status) status.textContent = `${selectedFileCount()} / 4 已载入`;
    const navCount = $('#nav-file-count');
    if (navCount) navCount.textContent = `${selectedFileCount()}/4`;
  }

  function renderDashboard() {
    const aim = getAimSnapshot();
    const gfx = getGraphicsSnapshot();
    const count = selectedFileCount();
    $('#dash-file-count').textContent = `${count}/4`;
    $('#dash-file-note').textContent = count ? (count === 4 ? '全部文件已载入' : '还有可选/必需文件未载入') : '请先载入文件';
    $('#dash-fov').textContent = aim.fov == null ? '—' : Math.round(aim.fov);
    $('#dash-fov-note').textContent = aim.fovItem ? `cl_fovScale ${aim.fovItem.value}` : '无 profile.cfg';
    $('#dash-sens').textContent = aim.sens == null ? '—' : fixed(aim.sens, 3);
    $('#dash-sens-note').textContent = aim.sensItem ? `mouse_sensitivity · 第 ${aim.sensItem.lineNumber} 行` : '无 settings.cfg';
    $('#dash-res').textContent = gfx.width && gfx.height ? `${gfx.width}×${gfx.height}` : '—';
    $('#dash-res-note').textContent = gfx.file ? '来源于 videoconfig.txt' : '无 videoconfig.txt';
    const summary = $('#state-summary');
    if (summary) summary.textContent = count ? `${count}/4 个文件` : '等待文件';
    const body = $('#state-overview-body');
    if (body) {
      if (!count) {
        body.innerHTML = '<tr><td colspan="4" class="muted">载入文件后显示真实当前值</td></tr>';
      } else {
        const rows = [];
        rows.push(makeStateRow('视野 FOV', aim.fov == null ? '—' : `${Math.round(aim.fov)}°`, aim.fovItem, aim.fovItem?.lineNumber));
        rows.push(makeStateRow('cl_fovScale', aim.fovScale == null ? '—' : aim.fovScale, aim.fovItem, aim.fovItem?.lineNumber));
        rows.push(makeStateRow('腰射灵敏度', aim.sens == null ? '—' : fixed(aim.sens, 3), aim.sensItem, aim.sensItem?.lineNumber));
        rows.push(makeStateRow('逐倍镜开关', aim.perScope == null ? '—' : aim.perScope ? '开启' : '关闭', aim.perScopeItem, aim.perScopeItem?.lineNumber));
        rows.push(makeStateRow('8 档 scalar', aim.scopes.filter(scope => scope.item).length + ' / 8', null, null));
        rows.push(makeStateRow('分辨率', gfx.width && gfx.height ? `${gfx.width}×${gfx.height}` : '—', itemByKey(gfx.file, 'setting.defaultres'), itemByKey(gfx.file, 'setting.defaultresheight')?.lineNumber));
        rows.push(makeStateRow('显示模式', displayModeLabel(gfx), itemByKey(gfx.file, 'setting.fullscreen'), null));
        if (state.files.localconfig) rows.push(makeStateRow('LaunchOptions', currentLaunchOptions() || '—', null, null));
        body.innerHTML = rows.join('');
      }
    }
    renderFileSummary();
    renderWarnings();
  }

  function makeStateRow(label, value, item, lineNumber) {
    const source = item ? `${KIND_LABEL[state.files.profile && state.files.profile.items.includes(item) ? 'profile' : state.files.settings && state.files.settings.items.includes(item) ? 'settings' : state.files.videoconfig && state.files.videoconfig.items.includes(item) ? 'videoconfig' : 'localconfig'] || '文件'}${lineNumber ? ` · 第 ${lineNumber} 行` : ''}` : '—';
    const status = item ? (item.readOnly ? '<span class="pill warn">只读</span>' : '<span class="pill ok">可读</span>') : '<span class="pill mute">缺失</span>';
    return `<tr><td>${esc(label)}</td><td class="mono">${esc(value)}</td><td class="dim">${esc(source)}</td><td>${status}</td></tr>`;
  }

  function displayModeLabel(gfx) {
    if (gfx.fullscreen === '1') return '独占全屏';
    if (gfx.borderless === '1') return '无边框窗口';
    if (gfx.width || gfx.height) return '窗口 / 未知';
    return '—';
  }

  function renderFileSummary() {
    const box = $('#file-summary-list');
    if (!box) return;
    const files = FILE_KINDS.map(kind => state.files[kind]).filter(Boolean);
    box.innerHTML = files.length ? files.map(file => `
      <div class="rowitem">
        <div class="grow">
          <div class="title">${esc(file.name)} <span class="pill mute">${esc(KIND_LABEL[file.kind])}</span></div>
          <div class="meta">${formatBytes(file.size)} · ${esc(file.encoding.toUpperCase())}${file.hasBom ? ' + BOM' : ''} · ${esc(file.newline)} · ${file.lineCount} 行 · <span class="mono">${esc(file.sha256.slice(0, 16))}</span></div>
        </div>
        <span class="pill ${file.warnings.length ? 'warn' : 'ok'}">${file.warnings.length ? '有提示' : '已读取'}</span>
      </div>`).join('') : '<div class="rowitem"><div class="grow"><div class="title muted">尚未载入文件</div></div></div>';
  }

  function collectWarnings() {
    const warnings = [];
    FILE_KINDS.forEach(kind => {
      const file = state.files[kind];
      if (!file) return;
      file.warnings.forEach(warning => warnings.push({ level: 'warn', text: `${KIND_LABEL[kind]}：${warning}` }));
    });
    const aim = getAimSnapshot();
    if (state.files.profile && aim.fov == null) warnings.push({ level: 'bad', text: 'profile.cfg 中没有可识别的 cl_fovScale，视野编辑已禁用。' });
    if (state.files.settings && aim.sens == null) warnings.push({ level: 'bad', text: 'settings.cfg 中没有可识别的 mouse_sensitivity，灵敏度编辑已禁用。' });
    if (state.files.videoconfig) {
      const readOnly = ['setting.last_display_width', 'setting.last_display_height', 'setting.configversion'].filter(key => itemByKey(state.files.videoconfig, key));
      if (readOnly.length) warnings.push({ level: 'info', text: `已识别 ${readOnly.length} 个只读键，导出时不会修改它们。` });
    }
    if (!warnings.length) warnings.push({ level: 'ok', text: '没有发现需要处理的文件级问题。' });
    return warnings;
  }

  function renderWarnings() {
    const box = $('#warning-list');
    if (!box) return;
    const warnings = collectWarnings();
    const count = warnings.filter(item => item.level === 'warn' || item.level === 'bad').length;
    $('#warning-count').textContent = `${count} 项`;
    box.innerHTML = warnings.map(item => `<div class="rowitem"><div class="grow"><div class="title ${item.level === 'bad' ? 'bad-text' : item.level === 'warn' ? 'warn-text' : ''}">${esc(item.text)}</div></div><span class="pill ${item.level === 'bad' ? 'danger' : item.level === 'warn' ? 'warn' : item.level === 'ok' ? 'ok' : 'mute'}">${item.level === 'bad' ? '阻止' : item.level === 'warn' ? '提示' : item.level === 'ok' ? '正常' : '信息'}</span></div>`).join('');
  }

  function renderAim() {
    const snap = getAimSnapshot();
    const missing = $('#aim-missing');
    if (missing) missing.hidden = !!(snap.profile && snap.settings);
    const missingText = $('#aim-missing-text');
    if (missingText) {
      const labels = [];
      if (!snap.profile) labels.push('profile.cfg');
      if (!snap.settings) labels.push('settings.cfg');
      missingText.textContent = `请先在文件工作台载入 ${labels.join(' 与 ')}。`;
    }
    const draft = state.drafts.aim || { fov: null, sens: null, scopeMode: 'keep', scopeTargets: [] };
    const fovInput = $('#aim-fov');
    if (fovInput) {
      fovInput.value = draft.fov == null ? '' : String(Math.round(draft.fov));
      fovInput.placeholder = snap.profile ? '无法识别当前 FOV' : '载入 profile.cfg';
      fovInput.disabled = !snap.profile || snap.fov == null;
    }
    const sensInput = $('#aim-sens');
    if (sensInput) {
      sensInput.value = draft.sens == null ? '' : Number(draft.sens).toFixed(3);
      sensInput.placeholder = snap.settings ? '无法识别当前腰射' : '载入 settings.cfg';
      sensInput.disabled = !snap.settings || snap.sens == null;
    }
    const fovScale = $('#aim-fov-scale');
    if (fovScale) fovScale.textContent = `cl_fovScale ${snap.fovScale == null ? '—' : snap.fovScale}`;
    const dpiInput = $('#aim-dpi');
    if (dpiInput) dpiInput.value = state.settings.dpi;
    const padInput = $('#aim-pad');
    if (padInput) padInput.value = state.settings.pad;
    const grip = $('#aim-grip');
    if (grip) grip.value = state.settings.grip;
    const aimState = $('#aim-state');
    if (aimState) {
      aimState.textContent = snap.profile && snap.settings ? '真实文件已读取' : '缺少必需文件';
      aimState.className = 'pill ' + (snap.profile && snap.settings ? 'ok' : 'warn');
    }
    const scopeMode = $('#aim-scope-mode');
    if (scopeMode) scopeMode.value = draft.scopeMode || 'keep';
    const psaBase = $('#psa-base');
    if (psaBase) {
      if (state.psa.base == null && snapshotSens() != null) state.psa.base = snapshotSens();
      psaBase.value = state.psa.base == null ? '' : Number(state.psa.base).toFixed(3);
      psaBase.placeholder = snapshotSens() == null ? '需要 settings.cfg' : '读取当前腰射';
    }
    const psaDpi = $('#psa-dpi');
    if (psaDpi) psaDpi.value = state.settings.dpi;
    renderAimSummary();
    renderAimScopes();
    renderPsa();
    renderCalibration();
    renderProPreset();
  }

  function snapshotSens() {
    const snap = getAimSnapshot();
    return snap.sens;
  }

  function renderAimSummary() {
    const snap = getAimSnapshot();
    const draft = state.drafts.aim || {};
    const sens = draft.sens == null ? snap.sens : draft.sens;
    const fov = draft.fov == null ? snap.fov : draft.fov;
    const dpi = state.settings.dpi;
    const cm = sens == null ? null : cm360(dpi, sens);
    const edpi = sens == null ? '—' : Math.round(dpi * sens);
    const scale = fov == null ? null : fovToScale(fov);
    const summary = $('#aim-summary');
    if (summary) {
      const lines = [];
      if (snap.fovItem) lines.push(`<div class="checkline"><span class="tag">当前</span>FOV <b class="mono">${fixed(snap.fov, 1)}</b> · <span class="mono">cl_fovScale ${esc(snap.fovItem.value)}</span> · 第 ${snap.fovItem.lineNumber} 行</div>`);
      if (snap.sensItem) lines.push(`<div class="checkline"><span class="tag">当前</span>腰射 <b class="mono">${fixed(snap.sens, 3)}</b> · 第 ${snap.sensItem.lineNumber} 行</div>`);
      if (fov != null) lines.push(`<div class="checkline"><span class="tag">目标</span>FOV <b class="mono">${Math.round(fov)}</b> → <span class="mono">cl_fovScale ${round(scale, 4)}</span> · eDPI <b class="mono">${fixed(edpi, 0)}</b></div>`);
      if (cm != null) lines.push(`<div class="checkline"><span class="tag">物理</span>cm/360 <b class="mono">${fixed(cm, 2)}</b> cm · ${gripLabel(state.settings.grip)}参考 ${gripRange(state.settings.grip)} cm/360</div>`);
      if (cm != null && state.settings.pad && cm > Number(state.settings.pad) * 0.9) lines.push(`<div class="checkline warn"><span class="tag">提醒</span>当前 cm/360 超过鼠标垫宽度的 90%，一次 360° 转身可能拉不到位。</div>`);
      if (!lines.length) lines.push('<div class="checkline warn"><span class="tag">保护</span>缺少 profile.cfg 或 settings.cfg 时不会填入任何默认值。</div>');
      summary.innerHTML = lines.join('');
    }
    const edpiEl = $('#aim-edpi');
    if (edpiEl) edpiEl.textContent = `eDPI ${fixed(edpi, 0)} · cm/360 ${fixed(cm, 2)}`;
    const fovHelp = $('#aim-fov-help');
    if (fovHelp) fovHelp.textContent = snap.fovScale == null ? 'FOV 与 cl_fovScale 双向换算；当前值不可识别' : `当前 cl_fovScale ${snap.fovScale} · 目标 ${round(scale, 4)}`;
  }

  function gripLabel(grip) {
    return grip === 'arm' ? '手臂流' : grip === 'finger' ? '高敏手指流' : '手腕流';
  }

  function gripRange(grip) {
    return grip === 'arm' ? '38–55' : grip === 'finger' ? '15–25' : '25–35';
  }

  function recomputeMatchScopes() {
    const draft = state.drafts.aim;
    if (!draft || draft.scopeMode !== 'match') return;
    const fov = draft.fov == null ? null : draft.fov;
    if (fov == null) return;
    draft.scopeTargets = SCOPES.map((_, index) => focalScalar(fov, index));
  }

  function scopeTargetValue(index, current) {
    const draft = state.drafts.aim || {};
    if (draft.scopeMode === 'keep' || draft.scopeMode === 'off') return current;
    if (draft.scopeMode === 'match') {
      if (!draft.scopeTargets || draft.scopeTargets.length !== 8) recomputeMatchScopes();
      return draft.scopeTargets ? draft.scopeTargets[index] : current;
    }
    const value = draft.scopeTargets ? draft.scopeTargets[index] : null;
    return value == null ? current : value;
  }

  function renderAimScopes() {
    const snap = getAimSnapshot();
    const body = $('#aim-scope-body');
    if (!body) return;
    const draft = state.drafts.aim || { scopeMode: 'keep', scopeTargets: [] };
    if (draft.scopeMode === 'match') recomputeMatchScopes();
    body.innerHTML = snap.scopes.map((scope, index) => {
      const target = scopeTargetValue(index, scope.value);
      const missing = !scope.item;
      return `<tr><td class="mono">scalar_${index}</td><td class="mono">${esc(SCOPES[index].label)}</td><td class="num mono">${scope.value == null ? '—' : fixed(scope.value, 3)}</td><td class="num">${draft.scopeMode === 'custom' ? `<input class="input mono" data-scope-index="${index}" type="number" min="0.1" max="10" step="0.01" value="${target == null ? '' : fixed(target, 3)}" ${missing ? 'disabled' : ''}>` : `<span class="mono">${target == null ? '—' : fixed(target, 3)}</span>`}${missing ? '<div class="dim small">文件中缺失</div>' : ''}</td></tr>`;
    }).join('');
    const note = $('#aim-scope-note');
    if (note) {
      const mode = draft.scopeMode;
      if (mode === 'keep') note.innerHTML = '<div class="checkline"><span class="tag">保持</span>不会写入任何倍镜键，完全保留文件里的原值。</div>';
      else if (mode === 'off') note.innerHTML = '<div class="checkline"><span class="tag">关闭</span>只尝试把 mouse_use_per_scope_sensitivity_scalars 改为 0；不会改动 8 个 scalar。</div>';
      else if (mode === 'match') note.innerHTML = '<div class="checkline"><span class="tag">1:1</span>按实测 FOV × 倍率表插值，统一各档手感；生成差异时会写入 0..7。</div>';
      else note.innerHTML = '<div class="checkline"><span class="tag">自定义</span>手动修改 8 个槽位；文件中缺失的键不会自动追加。</div>';
      note.innerHTML += `<div class="checkline"><span class="tag">槽位 7</span>${esc(SCOPES[7].note)}</div>`;
      if (snap.scopes.some(scope => !scope.item)) note.innerHTML += '<div class="checkline warn"><span class="tag">缺失</span>有槽位在 settings.cfg 中不存在；工具不会凭默认值补写。</div>';
    }
  }

  function renderPsa() {
    const base = state.psa.base;
    const roundNumber = state.psa.round;
    const low = base == null ? null : base * 0.5;
    const high = base == null ? null : base * 1.5;
    const lowEl = $('#psa-low');
    const highEl = $('#psa-high');
    if (lowEl) lowEl.textContent = low == null ? '—' : fixed(low, 3);
    if (highEl) highEl.textContent = high == null ? '—' : fixed(high, 3);
    const roundEl = $('#psa-round');
    if (roundEl) roundEl.textContent = state.psa.result != null ? '已收敛' : `第 ${Math.min(roundNumber, 5)} / 5 轮`;
    const mid = $('#psa-mid');
    if (mid) mid.style.left = '50%';
    const result = $('#psa-result');
    if (result) {
      if (state.psa.result != null) {
        result.innerHTML = `<div class="checkline ok"><span class="tag">结果</span>PSA 收敛值 <b class="mono">${fixed(state.psa.result, 3)}</b>。带入后仍只生成差异，不会直接写盘。</div>`;
      } else if (base == null) {
        result.innerHTML = '<div class="checkline warn"><span class="tag">缺少</span>需要 settings.cfg 中的真实腰射值，或手动输入 Base。</div>';
      } else {
        result.innerHTML = `<div class="checkline"><span class="tag">第 ${roundNumber} 轮</span>在靶场测试高敏与低敏，选择更顺手的一项。当前基准 <b class="mono">${fixed(base, 3)}</b>。</div>`;
      }
    }
    const apply = $('#btn-psa-apply');
    if (apply) apply.disabled = state.psa.result == null;
  }

  function renderCalibration() {
    const over = Math.max(0, Math.min(20, Number(state.calibration.over) || 0));
    const under = Math.max(0, Math.min(20, Number(state.calibration.under) || 0));
    const total = over + under;
    const balance = total ? over / total : 0.5;
    const snap = getAimSnapshot();
    const sens = state.drafts.aim && state.drafts.aim.sens != null ? state.drafts.aim.sens : snap.sens;
    let recommendation = null;
    if (total >= 10 && sens != null) {
      if (balance > 0.6) recommendation = sens * 0.9;
      else if (balance < 0.4) recommendation = sens * 1.1;
      else recommendation = sens;
    }
    state.calibration.result = recommendation;
    const overBar = $('#cal-over-bar');
    const underBar = $('#cal-under-bar');
    if (overBar) overBar.style.width = `${balance * 100}%`;
    if (underBar) underBar.style.width = `${(1 - balance) * 100}%`;
    const badge = $('#calibration-balance');
    if (badge) badge.textContent = total ? `${Math.round(balance * 100)}% 过冲 · ${Math.round((1 - balance) * 100)}% 欠冲` : '待记录';
    const result = $('#calibration-result');
    if (result) {
      const lines = [];
      if (total < 10) lines.push(`<div class="checkline"><span class="tag">记录</span>至少记录 10 次盲甩再判断；建议总计 20 次。</div>`);
      else if (recommendation == null) lines.push('<div class="checkline warn"><span class="tag">缺少</span>当前没有可识别的腰射灵敏度，不能计算建议值。</div>');
      else if (balance > 0.6) lines.push(`<div class="checkline warn"><span class="tag">过冲</span>当前灵敏度偏高，建议降低 10% 到 <b class="mono">${fixed(recommendation, 3)}</b>。</div>`);
      else if (balance < 0.4) lines.push(`<div class="checkline warn"><span class="tag">欠冲</span>当前灵敏度偏低，建议提升 10% 到 <b class="mono">${fixed(recommendation, 3)}</b>。</div>`);
      else lines.push(`<div class="checkline ok"><span class="tag">平衡</span>过冲与欠冲接近 50:50，建议保持 <b class="mono">${fixed(recommendation, 3)}</b>。</div>`);
      const cm = sens == null ? null : cm360(state.settings.dpi, sens);
      lines.push(`<div class="checkline"><span class="tag">安全域</span>${gripLabel(state.settings.grip)}参考 ${gripRange(state.settings.grip)} cm/360；当前 ${fixed(cm, 2)} cm/360。鼠标垫宽度 ${state.settings.pad} cm。</div>`);
      result.innerHTML = lines.join('');
    }
    const apply = $('#btn-calibration-apply');
    if (apply) apply.disabled = recommendation == null;
  }

  function renderProPreset() {
    const select = $('#pro-preset');
    if (select) {
      if (!select.options.length) select.innerHTML = PRO_PRESETS.map(preset => `<option value="${esc(preset.id)}">${esc(preset.name)}</option>`).join('');
      select.value = state.pro.id;
    }
    const modules = $('#pro-modules');
    if (modules) {
      modules.innerHTML = [['aim', '操控与视野'], ['quality', '画质与分辨率'], ['launch', '启动参数']].map(([key, label]) => `<label class="checkline"><input type="checkbox" data-pro-module="${key}" ${state.pro.modules[key] ? 'checked' : ''}> ${label}</label>`).join('');
    }
    const diff = $('#pro-diff');
    if (diff && !state.pro.diff) diff.textContent = '选择预设后读取当前文件值。';
    const apply = $('#btn-pro-apply');
    if (apply) apply.disabled = !state.pro.diff;
  }

  function previewProPreset() {
    const preset = PRO_PRESETS.find(item => item.id === state.pro.id);
    if (!preset) return;
    const snap = getAimSnapshot();
    const lines = [];
    if (state.pro.modules.aim) lines.push(`操控：FOV ${snap.fov == null ? '—' : Math.round(snap.fov)} → ${preset.fov} · 腰射 ${snap.sens == null ? '—' : fixed(snap.sens, 3)} → ${fixed(preset.sens, 3)}`);
    if (state.pro.modules.quality) lines.push(`画质：${preset.quality === 'fps' ? '竞技低画质' : preset.quality === 'balanced' ? '均衡' : '对比度强化'} · 分辨率 ${preset.resolution}`);
    if (state.pro.modules.launch) lines.push('启动参数：当前档案 → 预设参数');
    state.pro.selected = preset;
    state.pro.diff = lines;
    const box = $('#pro-diff');
    if (box) box.innerHTML = lines.length ? lines.map(line => `<div class="diff-line"><span class="sign">→</span><span>${esc(line)}</span></div>`).join('') : '<div class="checkline warn"><span class="tag">提示</span>至少勾选一个模块。</div>';
    const apply = $('#btn-pro-apply');
    if (apply) apply.disabled = !lines.length;
  }

  function applyProPreset() {
    const preset = state.pro.selected || PRO_PRESETS.find(item => item.id === state.pro.id);
    if (!preset) return;
    if (state.pro.modules.aim && state.drafts.aim) {
      state.drafts.aim.fov = preset.fov;
      state.drafts.aim.sens = preset.sens;
    }
    if (state.pro.modules.quality) {
      applyGraphicsPreset(preset.quality);
      const resolution = RESOLUTIONS.find(item => item.id === preset.resolution);
      if (resolution) applyResolution(resolution);
    }
    if (state.pro.modules.launch) {
      LAUNCH_CATALOG.forEach(option => {
        if (preset.id === 'chisnow' && option.key === 'novid') state.drafts.launch.selected.add(option.key);
      });
    }
    markDirty();
    renderAim();
    toast('职业配置已带入草稿；请生成差异后检查', 'ok');
  }

  function applyGraphicsPreset(id) {
    const preset = VIDEO_PRESETS.find(item => item.id === id);
    if (!preset) return;
    Object.assign(state.drafts.graphics, preset.values);
  }

  function applyResolution(resolution) {
    if (!resolution) return;
    state.drafts.graphics['setting.defaultres'] = String(resolution.width);
    state.drafts.graphics['setting.defaultresheight'] = String(resolution.height);
    state.drafts.graphics['setting.fullscreen'] = '1';
    state.drafts.graphics['setting.nowindowborder'] = '0';
  }

  function renderGraphics() {
    const gfx = getGraphicsSnapshot();
    const drafts = state.drafts.graphics;
    const missing = $('#gfx-missing');
    if (missing) missing.hidden = !!state.files.videoconfig;
    const statePill = $('#gfx-state');
    if (statePill) {
      statePill.textContent = state.files.videoconfig ? 'videoconfig.txt 已读取' : '需要 videoconfig.txt';
      statePill.className = 'pill ' + (state.files.videoconfig ? 'ok' : 'warn');
    }
    const presets = $('#gfx-presets');
    if (presets) {
      presets.innerHTML = VIDEO_PRESETS.map(preset => {
        const values = Object.keys(preset.values);
        const changes = values.filter(key => {
          const current = gfx.values[key];
          return current != null && current !== preset.values[key];
        }).length;
        return `<button class="choice quick-action" data-preset="${esc(preset.id)}"><b>${esc(preset.name)} <span class="pill ${preset.tag === '排位' ? 'warn' : 'mute'}">${esc(preset.tag)}</span></b><span>${esc(preset.description)} · 将改变 ${changes} 项</span></button>`;
      }).join('');
    }
    const resSelect = $('#gfx-res');
    if (resSelect) {
      if (resSelect.options.length <= 1) resSelect.innerHTML = '<option value="">保持原样</option>' + RESOLUTIONS.map(res => `<option value="${esc(res.id)}">${esc(res.label)}</option>`).join('');
      const draftWidth = Object.prototype.hasOwnProperty.call(drafts, 'setting.defaultres') ? num(drafts['setting.defaultres'], null) : gfx.width;
      const draftHeight = Object.prototype.hasOwnProperty.call(drafts, 'setting.defaultresheight') ? num(drafts['setting.defaultresheight'], null) : gfx.height;
      const targetId = `${draftWidth}x${draftHeight}`;
      resSelect.value = RESOLUTIONS.some(res => res.id === targetId) ? targetId : '';
    }
    $$('#gfx-mode [data-gfx-mode]').forEach(button => {
      const fullscreen = Object.prototype.hasOwnProperty.call(drafts, 'setting.fullscreen') ? drafts['setting.fullscreen'] : gfx.fullscreen;
      const borderless = Object.prototype.hasOwnProperty.call(drafts, 'setting.nowindowborder') ? drafts['setting.nowindowborder'] : gfx.borderless;
      const mode = fullscreen === '1' ? 'fullscreen' : borderless === '1' ? 'borderless' : 'keep';
      button.setAttribute('aria-pressed', String(button.dataset.gfxMode === mode));
    });
    renderGfxTable();
    renderStretchOptions();
    renderReticle();
    const sha = $('#gfx-sha');
    if (sha) sha.textContent = gfx.file ? `sha256 ${gfx.file.sha256}` : 'sha256 —';
  }

  function gfxTarget(key) {
    return Object.prototype.hasOwnProperty.call(state.drafts.graphics, key) ? state.drafts.graphics[key] : null;
  }

  function renderGfxTable() {
    const gfx = getGraphicsSnapshot();
    const body = $('#gfx-body');
    if (!body) return;
    if (!gfx.file) {
      body.innerHTML = '<tr><td colspan="4" class="muted">载入 videoconfig.txt 后显示</td></tr>';
      return;
    }
    const term = state.search.trim().toLowerCase();
    const fields = VIDEO_FIELDS.filter(field => !term || field.key.toLowerCase().includes(term) || field.name.includes(term));
    body.innerHTML = fields.map(field => {
      const current = gfx.values[field.key];
      const target = gfxTarget(field.key);
      const value = target == null ? current : target;
      if (field.managed) {
        return `<tr><td><b>${esc(field.name)}</b><div class="mono small">${esc(field.key)}</div></td><td class="mono">${esc(current == null ? '—' : current)}</td><td><span class="pill mute">选择器管理</span></td><td class="dim">${esc(field.description)}</td></tr>`;
      }
      let control = '';
      if (field.kind === 'bool') {
        control = `<select class="select" data-gfx-key="${esc(field.key)}"><option value="" ${value == null ? 'selected' : ''}>保持原样</option><option value="${esc(field.onValue)}" ${String(value) === String(field.onValue) ? 'selected' : ''}>开</option><option value="0" ${String(value) === '0' ? 'selected' : ''}>关</option></select>`;
      } else if (field.kind === 'enum') {
        control = `<select class="select" data-gfx-key="${esc(field.key)}"><option value="" ${value == null ? 'selected' : ''}>保持原样</option>${field.options.map(([label, option]) => `<option value="${esc(option)}" ${String(value) === String(option) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
      } else {
        control = `<input class="input mono" data-gfx-key="${esc(field.key)}" type="number" min="${field.min == null ? '' : field.min}" max="${field.max == null ? '' : field.max}" step="${field.step == null ? '1' : field.step}" value="${value == null ? '' : esc(value)}" placeholder="保持原样">`;
      }
      return `<tr><td><b>${esc(field.name)}</b><div class="mono small">${esc(field.key)}</div></td><td class="mono">${esc(current == null ? '未写入' : current)}</td><td>${control}</td><td class="dim">${esc(field.description)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="muted">没有匹配的设置项</td></tr>';
    renderGraphicsDiff();
  }

  function graphicsChanges() {
    const gfx = getGraphicsSnapshot();
    const changes = [];
    VIDEO_FIELDS.forEach(field => {
      if (READONLY_VIDEO.has(field.key)) return;
      const target = gfxTarget(field.key);
      if (target == null || target === '') return;
      const current = gfx.values[field.key];
      if (current == null || String(current) === String(target)) return;
      changes.push({ key: field.key, before: current, after: String(target), lineNumber: itemByKey(gfx.file, field.key)?.lineNumber || null });
    });
    return changes;
  }

  function renderGraphicsDiff() {
    const box = $('#gfx-diff');
    if (!box) return;
    const changes = graphicsChanges();
    const pill = $('#gfx-diff-pill');
    if (pill) pill.textContent = `${changes.length} 项`;
    const statusTitle = $('#gfx-status-title');
    const statusText = $('#gfx-status-text');
    if (statusTitle) statusTitle.textContent = changes.length ? `将修改 ${changes.length} 项` : '当前没有待写入变更';
    if (statusText) statusText.textContent = changes.length ? '只替换目标行的值；编码、BOM、换行、未知行和只读键保持原样。' : '选择预设或直接修改目标值后生成差异。';
    box.innerHTML = changes.length ? changes.map(change => `<div class="diff-line del"><span class="sign">-</span><span class="mono">${esc(change.key)}</span><span class="dim"> ${esc(change.before)}</span></div><div class="diff-line add"><span class="sign">+</span><span class="mono">${esc(change.key)}</span><span> ${esc(change.after)}</span></div>`).join('') : '<div class="diff-line"><span class="sign">&nbsp;</span><span class="dim">当前没有待写入变更</span></div>';
  }

  function renderStretchOptions() {
    const box = $('#stretch-options');
    if (!box) return;
    box.innerHTML = [
      ['1440x1080', '4:3 拉伸', '敌人模型横向更宽'],
      ['1680x1050', '16:10 拉伸', '兼顾视野和模型宽度'],
      ['1728x1080', '16:10 宽屏', '比 16:9 略宽'],
      ['1280x960', '4:3 低分辨率', '更轻的渲染负载']
    ].map(([id, title, note]) => `<button class="choice" data-stretch-resolution="${esc(id)}"><b>${esc(title)}</b><span>${esc(note)} · 只写 4 个安全键</span></button>`).join('');
  }

  function renderReticle() {
    const root = document.documentElement;
    root.style.setProperty('--reticle-r', state.reticle.r);
    root.style.setProperty('--reticle-g', state.reticle.g);
    root.style.setProperty('--reticle-b', state.reticle.b);
    const r = $('#reticle-r');
    const g = $('#reticle-g');
    const b = $('#reticle-b');
    if (r) r.value = state.reticle.r;
    if (g) g.value = state.reticle.g;
    if (b) b.value = state.reticle.b;
  }

  function renderLaunch() {
    const file = state.files.localconfig;
    const statePill = $('#launch-state');
    if (statePill) {
      statePill.textContent = file ? (file.launchSpan ? 'VDF 已读取' : 'VDF 无 LaunchOptions') : '未载入 VDF';
      statePill.className = 'pill ' + (file && file.launchSpan ? 'ok' : 'mute');
    }
    const noVdf = $('#launch-no-vdf');
    if (noVdf) noVdf.hidden = !!file;
    const current = currentLaunchOptions();
    const currentBox = $('#launch-current');
    if (currentBox) {
      currentBox.innerHTML = file
        ? `<div class="checkline"><span class="tag">当前</span><span class="mono">${esc(current || '（空）')}</span></div>`
        : '<div class="checkline"><span class="tag">当前</span>未读取 LaunchOptions。</div>';
    }
    const currentOptions = $('#launch-current-options');
    if (currentOptions) currentOptions.textContent = current || '—';
    const target = launchTarget();
    const targetOptions = $('#launch-target-options');
    if (targetOptions) targetOptions.textContent = target || '—';
    const catalog = $('#launch-catalog');
    if (catalog) {
      catalog.innerHTML = LAUNCH_CATALOG.map(option => `<label class="${option.key === 'rawinput' ? 'risky' : ''}"><input type="checkbox" data-launch-key="${esc(option.key)}" ${state.drafts.launch.selected.has(option.key) ? 'checked' : ''}><span><b>${esc(option.name)}</b><span><span class="mono">${esc(option.token)}</span> · ${esc(option.description)}</span></span></label>`).join('');
    }
    const custom = $('#launch-custom');
    if (custom && document.activeElement !== custom) custom.value = state.drafts.launch.custom || '';
    const warnings = $('#launch-warnings');
    if (warnings) {
      const rows = [];
      if (!file) rows.push('<div class="checkline"><span class="tag">提示</span>没有 localconfig.vdf 时只能复制参数，不会生成文件差异。</div>');
      if (file && !file.launchSpan) rows.push('<div class="checkline warn"><span class="tag">保护</span>VDF 中没有 LaunchOptions，不能生成差异；请确认选对了文件。</div>');
      if (file && file.launchSpan && target === current) rows.push('<div class="checkline ok"><span class="tag">一致</span>目标与当前 LaunchOptions 相同。</div>');
      warnings.innerHTML = rows.join('') || '<div class="checkline ok"><span class="tag">可导出</span>目标与当前值不同，生成差异后可下载修改后的 VDF。</div>';
    }
    const review = $('#btn-launch-review');
    if (review) review.disabled = !(file && file.launchSpan && target !== current);
  }

  function launchTarget() {
    const tokens = LAUNCH_CATALOG.filter(option => state.drafts.launch.selected.has(option.key)).map(option => option.token);
    const custom = String(state.drafts.launch.custom || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    return Array.from(new Set(tokens.concat(custom))).join(' ');
  }

  function renderExport() {
    const hasReview = !!state.review;
    const stale = state.reviewStale && hasReview;
    const reviewState = $('#review-state');
    if (reviewState) {
      reviewState.textContent = !hasReview ? '尚未生成' : stale ? '已过期，请重新生成' : '可导出';
      reviewState.className = 'pill ' + (!hasReview ? 'mute' : stale ? 'warn' : 'ok');
    }
    const count = state.review ? state.review.totalChanges : 0;
    const changeCount = $('#review-change-count');
    if (changeCount) changeCount.textContent = `${count} 项`;
    const summary = $('#review-summary');
    if (summary) {
      if (!state.review) summary.innerHTML = '<div class="checkline"><span class="tag">说明</span>先在各页面调整目标值，再回到这里生成差异。</div>';
      else {
        const files = state.review.files.map(file => `<div class="checkline"><span class="tag">${esc(KIND_LABEL[file.kind])}</span>${file.changes.length} 项 · ${formatBytes(file.originalBytes.length)} → ${formatBytes(file.targetBytes.length)} · <span class="mono">${esc(file.targetSha256.slice(0, 12))}</span></div>`).join('');
        summary.innerHTML = files + (state.review.warnings.length ? state.review.warnings.map(warning => `<div class="checkline warn"><span class="tag">提示</span>${esc(warning)}</div>`).join('') : '');
      }
    }
    const diff = $('#review-diff');
    if (diff) {
      if (!state.review) diff.innerHTML = '<div class="diff-line"><span class="sign">&nbsp;</span><span class="dim">尚未生成审阅单</span></div>';
      else {
        const lines = [];
        state.review.files.forEach(file => {
          lines.push(`<div class="diff-line"><span class="sign">#</span><span class="mono">${esc(KIND_LABEL[file.kind])}</span><span class="dim"> ${esc(file.name)} · sha ${esc(file.targetSha256.slice(0, 12))}</span></div>`);
          file.changes.forEach(change => {
            lines.push(`<div class="diff-line del"><span class="sign">-</span><span class="mono">${esc(change.key)}</span><span class="dim"> ${change.lineNumber ? '第 ' + change.lineNumber + ' 行 · ' : ''}${esc(change.before)}</span></div>`);
            lines.push(`<div class="diff-line add"><span class="sign">+</span><span class="mono">${esc(change.key)}</span><span> ${esc(change.after)}</span></div>`);
          });
        });
        diff.innerHTML = lines.join('');
      }
    }
    const allow = hasReview && !stale;
    ['#btn-export-zip', '#btn-export-folder', '#btn-export-originals'].forEach(selector => { const button = $(selector); if (button) button.disabled = !allow; });
    const files = $('#export-files');
    if (files) {
      files.innerHTML = state.review && state.review.files.length ? state.review.files.map(file => `<div class="rowitem"><div class="grow"><div class="title">${esc(file.name)}</div><div class="meta">${file.changes.length} 项 · <span class="mono">${esc(file.targetSha256.slice(0, 16))}</span></div></div><button class="btn sm ghost" data-export-kind="${esc(file.kind)}" ${stale ? 'disabled' : ''}>下载修改文件</button></div>`).join('') : '<div class="rowitem"><div class="grow"><div class="title muted">尚无修改文件</div></div></div>';
    }
    const sessionState = $('#session-state');
    if (sessionState) sessionState.textContent = state.lastExportAt ? `最近导出 ${formatTime(state.lastExportAt)}` : '未保存导出记录';
  }

  function buildChanges() {
    const changes = [];
    const warnings = [];
    const add = (kind, key, after) => {
      const file = state.files[kind];
      if (!file) return;
      const item = itemByKey(file, key);
      if (!item) { warnings.push(`${KIND_LABEL[kind]} 中没有 ${key}，不会自动追加。`); return; }
      if (item.readOnly) { warnings.push(`${KIND_LABEL[kind]} 的 ${key} 是只读键，已跳过。`); return; }
      if (String(item.value) === String(after)) return;
      changes.push({ kind, key, before: item.value, after: String(after), lineNumber: item.lineNumber });
    };
    const aim = state.drafts.aim;
    const snap = getAimSnapshot();
    if (aim) {
      if (aim.fov != null && snap.fov != null) add('profile', 'cl_fovScale', round(fovToScale(aim.fov), 4));
      if (aim.sens != null && snap.sens != null) add('settings', 'mouse_sensitivity', round(aim.sens, 3));
      if (aim.scopeMode === 'off') add('settings', 'mouse_use_per_scope_sensitivity_scalars', '0');
      if (aim.scopeMode === 'match' || aim.scopeMode === 'custom') {
        add('settings', 'mouse_use_per_scope_sensitivity_scalars', '1');
        for (let index = 0; index < 8; index += 1) {
          const target = scopeTargetValue(index, snap.scopes[index].value);
          if (target != null) add('settings', 'mouse_zoomed_sensitivity_scalar_' + index, round(target, 3));
        }
      }
    }
    Object.keys(state.drafts.graphics).forEach(key => {
      const value = state.drafts.graphics[key];
      if (value != null && value !== '') add('videoconfig', key, value);
    });
    const launch = launchTarget();
    if (state.files.localconfig && state.files.localconfig.launchSpan && launch !== currentLaunchOptions()) {
      changes.push({ kind: 'localconfig', key: 'LaunchOptions', before: currentLaunchOptions(), after: launch, lineNumber: null });
    }
    return { changes, warnings };
  }

  function patchCfgFile(file, changes) {
    const lines = file.lines.map(line => ({ content: line.content, ending: line.ending }));
    changes.forEach(change => {
      const item = itemByKey(file, change.key);
      if (!item) return;
      const line = lines[item.lineIndex];
      if (!line) return;
      line.content = line.content.slice(0, item.valueStart) + change.after + line.content.slice(item.valueEnd);
    });
    const targetText = joinLines(lines);
    let targetBytes;
    try {
      targetBytes = encodeText(targetText, file.encoding, file.hasBom);
    } catch (error) {
      throw new Error(`${file.name}：${error.message}`);
    }
    return { targetText, targetBytes };
  }

  function patchVdfFile(file, newValue) {
    if (!file.launchSpan) throw new Error('VDF 中没有 LaunchOptions，不能生成差异。');
    const escaped = String(newValue).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const targetText = file.text.slice(0, file.launchSpan.start) + escaped + file.text.slice(file.launchSpan.end);
    let targetBytes;
    try {
      targetBytes = encodeText(targetText, file.encoding, file.hasBom);
    } catch (error) {
      throw new Error(`${file.name}：${error.message}`);
    }
    return { targetText, targetBytes };
  }

  async function createReview() {
    const result = buildChanges();
    if (!result.changes.length) {
      toast(result.warnings.length ? result.warnings[0] : '没有需要生成差异的变更', 'warn');
      return null;
    }
    const groups = new Map();
    result.changes.forEach(change => {
      if (!groups.has(change.kind)) groups.set(change.kind, []);
      groups.get(change.kind).push(change);
    });
    const files = [];
    try {
      for (const [kind, changes] of groups.entries()) {
        const source = state.files[kind];
        if (!source) continue;
        const patched = kind === 'localconfig' ? patchVdfFile(source, changes[0].after) : patchCfgFile(source, changes);
        files.push({
          kind,
          name: source.name,
          originalBytes: source.bytes,
          targetBytes: patched.targetBytes,
          targetText: patched.targetText,
          sourceSha256: source.sha256,
          targetSha256: await sha256Hex(patched.targetBytes),
          changes,
          diff: changes.map(change => `${change.key}: ${change.before} → ${change.after}`)
        });
      }
    } catch (error) {
      showError(error, '生成差异失败');
      return null;
    }
    state.review = {
      id: 'review-' + Date.now(),
      createdAt: new Date().toISOString(),
      files,
      warnings: result.warnings,
      totalChanges: result.changes.length
    };
    state.reviewStale = false;
    renderShellStatus();
    renderExport();
    navigate('export');
    toast(`已生成 ${result.changes.length} 项差异，请先核对再导出`, 'ok');
    queueSessionSave();
    return state.review;
  }

  function manifestFor(files, kind) {
    return JSON.stringify({
      tool: 'Apex 配置助手 · 浏览器本地版',
      version: 'web-3.1',
      generatedAt: new Date().toISOString(),
      mode: kind || 'modified',
      files: files.map(file => ({
        kind: file.kind,
        name: file.name,
        sourceSha256: file.sourceSha256,
        targetSha256: file.targetSha256,
        changes: file.changes.map(change => ({ key: change.key, before: change.before, after: change.after, lineNumber: change.lineNumber }))
      }))
    }, null, 2);
  }

  function crc32(data) {
    let crc = 0xffffffff;
    for (const value of data) {
      crc ^= value;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatBytes(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    parts.forEach(part => { out.set(part, offset); offset += part.length; });
    return out;
  }

  function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function makeZip(entries) {
    const encoder = new TextEncoder();
    const stamp = dosDateTime(new Date());
    const locals = [];
    const centrals = [];
    let offset = 0;
    entries.forEach(entry => {
      const name = encoder.encode(entry.name);
      const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(name, 46);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return concatBytes(locals.concat([concatBytes(centrals), end]));
  }

  function zipEntries(includeOriginals, originalsOnly) {
    if (!state.review) return null;
    const entries = [];
    state.review.files.forEach(file => {
      if (!originalsOnly) entries.push({ name: file.name, data: file.targetBytes });
      if (includeOriginals || originalsOnly) entries.push({ name: 'originals/' + file.name, data: file.originalBytes });
    });
    entries.push({ name: 'manifest.json', data: new TextEncoder().encode(manifestFor(state.review.files, originalsOnly ? 'originals' : 'modified')) });
    const guide = originalsOnly
      ? 'Apex 配置助手 · 浏览器本地版 · 原始回滚包\n\n1. 完全退出 Apex（启动参数还需要退出 Steam）。\n2. 将 originals/ 中的文件替换回原路径。\n3. 重新启动游戏，再回到工具重新载入文件核验。\n\n浏览器不会自动覆盖游戏文件。\n'
      : 'Apex 配置助手 · 浏览器本地版\n\n1. 完全退出 Apex（启动参数还需要退出 Steam）。\n2. 将本包顶层的文件替换到原路径。\n3. originals/ 中保存了原始文件，可用于回滚。\n4. 重新启动游戏，再回到工具重新载入文件核验。\n\n浏览器不会自动覆盖游戏文件。\n';
    entries.push({ name: 'README.txt', data: new TextEncoder().encode(guide) });
    return entries;
  }

  function downloadReviewZip(originalsOnly) {
    if (!state.review || state.reviewStale) { toast('审阅单已过期或尚未生成', 'warn'); return; }
    const entries = zipEntries(true, originalsOnly);
    if (!entries) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const name = originalsOnly ? `Apex原始回滚包-${stamp}.zip` : `Apex配置包-${stamp}.zip`;
    downloadBytes(name, makeZip(entries), 'application/zip');
    state.lastExportAt = new Date().toISOString();
    renderShellStatus();
    toast(originalsOnly ? '原始回滚包已下载' : '配置包已下载', 'ok');
    queueSessionSave();
  }

  async function saveReviewToFolder() {
    if (!state.review || state.reviewStale) { toast('审阅单已过期或尚未生成', 'warn'); return; }
    if (!window.showDirectoryPicker) { toast('当前浏览器不支持选择文件夹；请使用 ZIP 下载', 'warn'); return; }
    try {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
      let originalDir = null;
      try { originalDir = await directory.getDirectoryHandle('originals', { create: true }); } catch (_) { originalDir = null; }
      for (const file of state.review.files) {
        const handle = await directory.getFileHandle(file.name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(file.targetBytes);
        await writable.close();
        if (originalDir) {
          const original = await originalDir.getFileHandle(file.name, { create: true });
          const originalWriter = await original.createWritable();
          await originalWriter.write(file.originalBytes);
          await originalWriter.close();
        }
      }
      const manifest = await directory.getFileHandle('manifest.json', { create: true });
      const manifestWriter = await manifest.createWritable();
      await manifestWriter.write(manifestFor(state.review.files, 'modified'));
      await manifestWriter.close();
      const readme = await directory.getFileHandle('README.txt', { create: true });
      const readmeWriter = await readme.createWritable();
      await readmeWriter.write('Apex 配置助手 · 浏览器本地版\n\n1. 完全退出 Apex（启动参数还需要退出 Steam）。\n2. 将本目录顶层的文件替换到原路径。\n3. originals/ 中保存了原始文件，可用于回滚。\n4. 重新启动游戏，再回到工具重新载入文件核验。\n\n浏览器不会自动覆盖游戏文件，也不能保证跨文件原子写入。\n');
      await readmeWriter.close();
      state.lastExportAt = new Date().toISOString();
      renderShellStatus();
      toast('已写入所选文件夹；浏览器无法保证跨文件原子写入', 'warn');
      queueSessionSave();
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      showError(error, '保存到文件夹失败');
    }
  }

  function downloadOne(kind) {
    if (!state.review || state.reviewStale) { toast('审阅单已过期或尚未生成', 'warn'); return; }
    const file = state.review && state.review.files.find(item => item.kind === kind);
    if (!file) return;
    downloadBytes(file.name, file.targetBytes, 'text/plain');
    state.lastExportAt = new Date().toISOString();
    renderShellStatus();
    renderExport();
    queueSessionSave();
    toast(`${file.name} 已下载`, 'ok');
  }

  function clearReview() {
    state.review = null;
    state.reviewStale = false;
    renderExport();
    renderShellStatus();
  }

  function clearWorkspace() {
    state.files = { profile: null, settings: null, videoconfig: null, localconfig: null };
    state.review = null;
    state.reviewStale = false;
    state.lastExportAt = null;
    syncDraftsFromFiles({ preserve: false });
    clearSession().catch(() => {});
    renderShell();
  }

  function saveSessionSoon() {
    if (state.sessionTimer) clearTimeout(state.sessionTimer);
    state.sessionTimer = setTimeout(() => { saveSession().catch(() => {}); }, 400);
  }

  function queueSessionSave() { saveSessionSoon(); }

  async function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('apex-config-assistant', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('session')) request.result.createObjectStore('session');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveSession() {
    if (!window.indexedDB) return;
    const files = {};
    FILE_KINDS.forEach(kind => {
      const file = state.files[kind];
      if (!file) return;
      files[kind] = { name: file.name, size: file.size, lastModified: file.lastModified, bytes: Array.from(file.bytes) };
    });
    const payload = {
      savedAt: new Date().toISOString(),
      files,
      drafts: { aim: state.drafts.aim, graphics: state.drafts.graphics, launch: { selected: Array.from(state.drafts.launch.selected), custom: state.drafts.launch.custom } },
      settings: state.settings,
      psa: state.psa,
      calibration: state.calibration,
      reticle: state.reticle
    };
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('session', 'readwrite');
        tx.objectStore('session').put(payload, 'current');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* 本地缓存不可用不应阻断工具 */ }
  }

  async function readSession() {
    if (!window.indexedDB) return null;
    try {
      const db = await openDb();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction('session', 'readonly');
        const request = tx.objectStore('session').get('current');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return value;
    } catch (_) { return null; }
  }

  async function clearSession() {
    if (!window.indexedDB) return;
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('session', 'readwrite');
        tx.objectStore('session').delete('current');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* noop */ }
    state.session = null;
  }

  async function checkSession() {
    state.session = await readSession();
    if (state.session) renderLoader();
  }

  async function restoreSession() {
    const saved = state.session || await readSession();
    if (!saved) { toast('没有可恢复的会话', 'warn'); return; }
    try {
      state.files = { profile: null, settings: null, videoconfig: null, localconfig: null };
      state.review = null;
      state.reviewStale = false;
      for (const kind of FILE_KINDS) {
        const record = saved.files && saved.files[kind];
        if (!record) continue;
        const parsed = await parseFileBytes(kind, record.name, new Uint8Array(record.bytes), record.lastModified);
        state.files[kind] = parsed;
      }
      if (saved.drafts && saved.drafts.aim) state.drafts.aim = saved.drafts.aim;
      if (saved.drafts && saved.drafts.graphics) state.drafts.graphics = saved.drafts.graphics;
      if (saved.drafts && saved.drafts.launch) {
        state.drafts.launch.selected = new Set(saved.drafts.launch.selected || []);
        state.drafts.launch.custom = saved.drafts.launch.custom || '';
      }
      if (saved.settings) state.settings = { ...state.settings, ...saved.settings };
      if (saved.psa) state.psa = saved.psa;
      if (saved.calibration) state.calibration = saved.calibration;
      if (saved.reticle) state.reticle = saved.reticle;
      state.session = null;
      renderShell();
      toast('已恢复浏览器本地会话', 'ok');
    } catch (error) {
      showError(error, '恢复会话失败');
    }
  }

  function showModal({ title, body, okText = '确认', cancelText = '取消', danger = false, requireCheck = false }) {
    const dialog = $('#modal');
    if (!dialog) return Promise.resolve(false);
    if (dialog.open) dialog.close('replace');
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body || '';
    const checkWrap = $('#modal-check-wrap');
    const check = $('#modal-confirm-check');
    checkWrap.hidden = !requireCheck;
    check.checked = false;
    const ok = $('#modal-ok');
    ok.textContent = okText;
    ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    ok.disabled = requireCheck;
    $('#modal-cancel').textContent = cancelText;
    const onCheck = () => { ok.disabled = requireCheck && !check.checked; };
    check.onchange = onCheck;
    return new Promise(resolve => {
      state.modalResolve = resolve;
      const close = (result) => {
        if (!dialog.open) return;
        dialog.close(result ? 'ok' : 'cancel');
      };
      $('#modal-close').onclick = () => close(false);
      $('#modal-cancel').onclick = () => close(false);
      ok.onclick = () => close(true);
      dialog.onclose = () => {
        const result = dialog.returnValue === 'ok';
        state.modalResolve = null;
        resolve(result);
      };
      dialog.showModal();
    });
  }

  function bindEvents() {
    window.addEventListener('hashchange', () => { state.route = currentRoute(); renderShell(); });
    $('#global-error-close')?.addEventListener('click', hideError);
    $('#btn-help')?.addEventListener('click', () => showModal({
      title: '使用说明',
      body: '<p>本工具不会自动读取电脑。请在文件工作台手动选择 Apex 的配置文件和可选的 localconfig.vdf，所有解析都在当前浏览器完成。</p><p>修改不会直接写入游戏文件。请在导出页生成差异，下载配置包，然后按步骤替换并重新核验。</p><p>如果浏览器支持文件夹选择，可以使用“保存到文件夹…”；否则使用 ZIP 下载。</p>',
      okText: '知道了'
    }));
    $$('.nav a[data-nav]').forEach(link => link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.dataset.nav);
    }));
    document.addEventListener('click', (event) => {
      const go = event.target.closest('[data-goto]');
      if (go) { event.preventDefault(); navigate(go.dataset.goto); }
    });

    FILE_KINDS.forEach(kind => {
      const input = $(`[data-file-input="${kind}"]`);
      const dropzone = $(`[data-kind="${kind}"] .dropzone`);
      const choose = $(`[data-file-choose="${kind}"]`);
      const paste = $(`[data-file-paste="${kind}"]`);
      const remove = $(`[data-file-remove="${kind}"]`);
      choose?.addEventListener('click', () => input?.click());
      dropzone?.addEventListener('click', () => input?.click());
      dropzone?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input?.click(); } });
      input?.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (file) await ingestFile(kind, file);
      });
      dropzone?.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-drag'); });
      dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-drag'));
      dropzone?.addEventListener('drop', async (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-drag');
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) await ingestFile(kind, file);
      });
      paste?.addEventListener('click', async () => {
        const ok = await showModal({
          title: `粘贴 ${KIND_LABEL[kind]}`,
          body: `<p class="dim">从文本编辑器复制内容后粘贴到下面。粘贴内容会按 UTF-8 处理。</p><textarea class="input mono" id="modal-paste" rows="12" style="resize:vertical" placeholder="在这里粘贴文件内容"></textarea>`,
          okText: '解析文本'
        });
        if (!ok) return;
        const text = $('#modal-paste')?.value || '';
        if (!text.trim()) { toast('没有粘贴内容', 'warn'); return; }
        const bytes = new TextEncoder().encode(text);
        const name = KIND_LABEL[kind];
        await ingestFile(kind, { name, size: bytes.length, lastModified: Date.now(), arrayBuffer: async () => bytes.buffer });
      });
      remove?.addEventListener('click', () => { removeFile(kind); toast(`${KIND_LABEL[kind]} 已从工作台移除`, 'warn'); });
    });

    $$('[data-copy-path]').forEach(button => button.addEventListener('click', async () => {
      const ok = await copyText(button.dataset.copyPath);
      toast(ok ? '路径已复制' : '复制失败，请手动选择文本', ok ? 'ok' : 'bad');
    }));
    $('#btn-clear-workspace')?.addEventListener('click', async () => {
      const ok = await showModal({ title: '清空工作台？', body: '<p>这会移除当前浏览器中的文件副本、草稿、审阅单和本地会话，不会删除电脑上的 Apex 文件。</p>', okText: '清空', danger: true, requireCheck: true });
      if (ok) { clearWorkspace(); toast('工作台已清空', 'ok'); }
    });
    $('#btn-session-restore')?.addEventListener('click', restoreSession);
    $('#btn-session-ignore')?.addEventListener('click', () => { state.session = null; renderLoader(); });
    $('#btn-clear-session')?.addEventListener('click', async () => {
      const ok = await showModal({ title: '清除本地会话？', body: '<p>只删除浏览器缓存中的会话副本，不影响 Apex 文件。</p>', okText: '清除', danger: true });
      if (ok) { await clearSession(); renderShell(); toast('本地会话已清除', 'ok'); }
    });

    $('#btn-dashboard-refresh')?.addEventListener('click', renderShell);

    $('#aim-fov')?.addEventListener('input', (event) => {
      if (!state.drafts.aim) return;
      state.drafts.aim.fov = event.target.value === '' ? null : num(event.target.value, null);
      recomputeMatchScopes();
      renderAimSummary();
      renderAimScopes();
      markDirty();
    });
    $('#aim-sens')?.addEventListener('input', (event) => {
      if (!state.drafts.aim) return;
      state.drafts.aim.sens = event.target.value === '' ? null : num(event.target.value, null);
      renderAimSummary();
      renderCalibration();
      markDirty();
    });
    $('#aim-dpi')?.addEventListener('input', (event) => {
      state.settings.dpi = num(event.target.value, 800);
      renderAimSummary();
      renderCalibration();
      markDirty();
    });
    $('#aim-pad')?.addEventListener('input', (event) => { state.settings.pad = num(event.target.value, 45); renderAimSummary(); renderCalibration(); markDirty(); });
    $('#aim-grip')?.addEventListener('change', (event) => { state.settings.grip = event.target.value; renderAimSummary(); renderCalibration(); markDirty(); });
    $('#aim-scope-mode')?.addEventListener('change', (event) => {
      if (!state.drafts.aim) return;
      state.drafts.aim.scopeMode = event.target.value;
      const snap = getAimSnapshot();
      if (event.target.value === 'match') recomputeMatchScopes();
      if (event.target.value === 'custom') state.drafts.aim.scopeTargets = snap.scopes.map(scope => scope.value);
      renderAimScopes();
      markDirty();
    });
    $('#aim-scope-body')?.addEventListener('input', (event) => {
      const input = event.target.closest('[data-scope-index]');
      if (!input || !state.drafts.aim) return;
      const index = Number(input.dataset.scopeIndex);
      state.drafts.aim.scopeTargets[index] = input.value === '' ? null : num(input.value, null);
      markDirty();
    });
    $('#btn-focal-lock')?.addEventListener('click', () => {
      if (!state.drafts.aim) { toast('先载入 profile.cfg 与 settings.cfg', 'warn'); return; }
      state.drafts.aim.scopeMode = 'match';
      recomputeMatchScopes();
      $('#aim-scope-mode').value = 'match';
      renderAimScopes();
      markDirty();
      toast('已计算 1:1 八档目标；生成差异时写入 0..7', 'ok');
    });
    $('#btn-aim-review')?.addEventListener('click', createReview);
    $('#btn-aim-reset')?.addEventListener('click', () => {
      const aim = getAimSnapshot();
      state.drafts.aim = {
        fov: aim.fov,
        sens: aim.sens,
        scopeMode: 'keep',
        scopeTargets: aim.scopes.map(scope => scope.value)
      };
      state.psa = { base: aim.sens, round: 1, result: null };
      state.calibration.result = null;
      renderAim();
      markDirty();
      toast('已恢复为文件当前值', 'ok');
    });

    $('#psa-base')?.addEventListener('input', (event) => {
      state.psa.base = event.target.value === '' ? null : num(event.target.value, null);
      state.psa.round = 1;
      state.psa.result = null;
      renderPsa();
    });
    $$('[data-psa-choice]').forEach(button => button.addEventListener('click', () => {
      if (state.psa.base == null) { toast('先输入基准灵敏度', 'warn'); return; }
      if (state.psa.result != null) return;
      const base = Number(state.psa.base);
      const low = base * 0.5;
      const high = base * 1.5;
      state.psa.base = button.dataset.psaChoice === 'high' ? (base + high) / 2 : (low + base) / 2;
      state.psa.round += 1;
      if (state.psa.round > 5) {
        state.psa.result = state.psa.base;
        state.psa.round = 5;
      }
      renderPsa();
    }));
    $('#btn-psa-apply')?.addEventListener('click', () => {
      if (state.psa.result == null || !state.drafts.aim) return;
      state.drafts.aim.sens = state.psa.result;
      if ($('#aim-sens')) $('#aim-sens').value = fixed(state.psa.result, 3);
      renderAimSummary();
      renderCalibration();
      markDirty();
      toast('PSA 收敛值已带入腰射目标', 'ok');
    });
    $('#btn-psa-reset')?.addEventListener('click', () => {
      state.psa = { base: snapshotSens(), round: 1, result: null };
      renderAim();
    });
    $('#cal-over')?.addEventListener('input', (event) => { state.calibration.over = num(event.target.value, 0); renderCalibration(); markDirty(); });
    $('#cal-under')?.addEventListener('input', (event) => { state.calibration.under = num(event.target.value, 0); renderCalibration(); markDirty(); });
    $('#btn-calibration-apply')?.addEventListener('click', () => {
      if (state.calibration.result == null || !state.drafts.aim) return;
      state.drafts.aim.sens = state.calibration.result;
      if ($('#aim-sens')) $('#aim-sens').value = fixed(state.calibration.result, 3);
      renderAimSummary();
      markDirty();
      toast('校准建议已带入腰射目标', 'ok');
    });
    $('#pro-preset')?.addEventListener('change', (event) => { state.pro.id = event.target.value; state.pro.diff = null; state.pro.selected = null; renderProPreset(); });
    $('#pro-modules')?.addEventListener('change', (event) => {
      const input = event.target.closest('[data-pro-module]');
      if (!input) return;
      state.pro.modules[input.dataset.proModule] = input.checked;
      state.pro.diff = null;
      state.pro.selected = null;
      renderProPreset();
    });
    $('#btn-pro-preview')?.addEventListener('click', previewProPreset);
    $('#btn-pro-apply')?.addEventListener('click', applyProPreset);

    $('#btn-gfx-review')?.addEventListener('click', createReview);
    $('#btn-gfx-reset')?.addEventListener('click', () => { state.drafts.graphics = {}; renderGraphics(); markDirty(); toast('目标值已重置', 'ok'); });
    $('#gfx-res')?.addEventListener('change', (event) => {
      const resolution = RESOLUTIONS.find(item => item.id === event.target.value);
      if (!resolution) {
        delete state.drafts.graphics['setting.defaultres'];
        delete state.drafts.graphics['setting.defaultresheight'];
        delete state.drafts.graphics['setting.fullscreen'];
        delete state.drafts.graphics['setting.nowindowborder'];
      } else {
        applyResolution(resolution);
      }
      renderGraphics();
      markDirty();
    });
    $('#gfx-mode')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-gfx-mode]');
      if (!button) return;
      const mode = button.dataset.gfxMode;
      if (mode === 'fullscreen') state.drafts.graphics['setting.fullscreen'] = '1', state.drafts.graphics['setting.nowindowborder'] = '0';
      else if (mode === 'borderless') state.drafts.graphics['setting.fullscreen'] = '0', state.drafts.graphics['setting.nowindowborder'] = '1';
      else { delete state.drafts.graphics['setting.fullscreen']; delete state.drafts.graphics['setting.nowindowborder']; }
      renderGraphics();
      markDirty();
    });
    $('#gfx-search')?.addEventListener('input', (event) => { state.search = event.target.value; renderGfxTable(); });
    $('#gfx-presets')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-preset]');
      if (!button) return;
      applyGraphicsPreset(button.dataset.preset);
      renderGraphics();
      markDirty();
      toast('画质目标已填入，请检查差异', 'ok');
    });
    $('#gfx-body')?.addEventListener('change', handleGfxInput);
    $('#gfx-body')?.addEventListener('input', handleGfxInput);
    $('#stretch-options')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-stretch-resolution]');
      if (!button) return;
      const resolution = RESOLUTIONS.find(item => item.id === button.dataset.stretchResolution);
      if (!resolution) return;
      applyResolution(resolution);
      $('#gfx-res').value = resolution.id;
      renderGraphics();
      markDirty();
      toast('已选择拉伸分辨率；仅生成 4 个安全键', 'ok');
    });
    ['r', 'g', 'b'].forEach(channel => {
      $(`#reticle-${channel}`)?.addEventListener('input', (event) => {
        state.reticle[channel] = num(event.target.value, 0);
        renderReticle();
        queueSessionSave();
      });
    });

    $('#launch-catalog')?.addEventListener('change', (event) => {
      const input = event.target.closest('[data-launch-key]');
      if (!input) return;
      if (input.checked) state.drafts.launch.selected.add(input.dataset.launchKey);
      else state.drafts.launch.selected.delete(input.dataset.launchKey);
      renderLaunchTargetOnly();
      markDirty();
    });
    $('#launch-custom')?.addEventListener('input', (event) => { state.drafts.launch.custom = event.target.value; renderLaunchTargetOnly(); markDirty(); });
    $('#btn-launch-copy')?.addEventListener('click', async () => {
      const ok = await copyText(launchTarget());
      toast(ok ? 'LaunchOptions 已复制' : '复制失败，请手动选择文本', ok ? 'ok' : 'bad');
    });
    $('#btn-launch-review')?.addEventListener('click', createReview);
    $('#btn-launch-open-steam')?.addEventListener('click', () => { window.location.href = 'steam://rungameid/1172470'; });

    $('#btn-review-build')?.addEventListener('click', createReview);
    $('#btn-review-clear')?.addEventListener('click', clearReview);
    $('#btn-export-zip')?.addEventListener('click', () => downloadReviewZip(false));
    $('#btn-export-originals')?.addEventListener('click', () => downloadReviewZip(true));
    $('#btn-export-folder')?.addEventListener('click', saveReviewToFolder);
    $('#export-files')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-export-kind]');
      if (button) downloadOne(button.dataset.exportKind);
    });

    $('#modal-cancel')?.addEventListener('click', () => { const dialog = $('#modal'); if (dialog && dialog.open) dialog.close('cancel'); });
  }

  function handleGfxInput(event) {
    const input = event.target.closest('[data-gfx-key]');
    if (!input) return;
    const key = input.dataset.gfxKey;
    const field = VIDEO_FIELD_MAP.get(key);
    if (!field || field.managed || READONLY_VIDEO.has(field.key)) return;
    state.drafts.graphics[key] = input.value;
    renderGraphicsDiff();
    markDirty();
  }

  function renderLaunchTargetOnly() {
    const target = launchTarget();
    const targetOptions = $('#launch-target-options');
    if (targetOptions) targetOptions.textContent = target || '—';
    const review = $('#btn-launch-review');
    if (review) review.disabled = !(state.files.localconfig && state.files.localconfig.launchSpan && target !== currentLaunchOptions());
    const warnings = $('#launch-warnings');
    if (warnings) {
      warnings.innerHTML = !state.files.localconfig ? '<div class="checkline"><span class="tag">提示</span>没有 localconfig.vdf 时只能复制参数，不会生成文件差异。</div>' : target === currentLaunchOptions() ? '<div class="checkline ok"><span class="tag">一致</span>目标与当前 LaunchOptions 相同。</div>' : '<div class="checkline ok"><span class="tag">可导出</span>生成差异后可下载修改后的 VDF。</div>';
    }
  }

  function boot() {
    bindEvents();
    state.route = currentRoute();
    if (!location.hash) location.hash = 'loader';
    renderShell();
    checkSession().catch(() => {});
    document.documentElement.dataset.ready = '1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
