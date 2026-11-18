/* 早期错误边界：在任何其它脚本之前加载，保证语法/初始化错误可见（写入 data-js-error）。 */
(() => {
  const mark = (text) => { try { document.documentElement.dataset.jsError = String(text).slice(0, 800); } catch (e) { } };
  window.addEventListener('error', (e) => mark((e.message || 'error') + ' @ ' + (e.filename || '') + ':' + (e.lineno || 0)));
  window.addEventListener('unhandledrejection', (e) => mark(e.reason && (e.reason.stack || e.reason.message) || e.reason));
})();
