// Applies the saved UI theme before the first paint. Loaded as a blocking
// classic script from index.html (no inline JS: CSP script-src 'self').
// Served with no-cache by scripts/serve-with-api-proxy.mjs.
(function () {
  try {
    var key = 'project-goods.ui-theme';
    var theme = localStorage.getItem(key) === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
