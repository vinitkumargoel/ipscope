// Blocking, classic script loaded in <head>. Deliberately not a module: it must
// run before first paint to avoid a light-theme flash, and CSP forbids inline JS.
(function () {
  try {
    var saved = localStorage.getItem('ipscope-theme');
    var dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {
    /* localStorage blocked — fall back to the light theme. */
  }
})();
