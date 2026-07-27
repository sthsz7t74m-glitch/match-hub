window.FootballUI = window.FootballUI || {};

(function startFootballComponents(namespace) {
  if (typeof namespace.bootstrap !== 'function') {
    console.warn('Football UI modules are not loaded in the expected order.');
    return;
  }
  namespace.bootstrap();
})(window.FootballUI);
