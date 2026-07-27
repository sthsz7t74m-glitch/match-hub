const sharedSportsComponents = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedSportsComponents;
window.FootballUI = sharedSportsComponents;

(function startSportsComponents(namespace) {
  if (typeof namespace.bootstrap !== 'function') {
    console.warn('Sports UI modules are not loaded in the expected order.');
    return;
  }

  namespace.bootstrap();
})(sharedSportsComponents);