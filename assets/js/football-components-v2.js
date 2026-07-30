const sharedSportsComponents = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedSportsComponents;
window.FootballUI = sharedSportsComponents;

(function startSportsComponents(namespace) {
  if (typeof namespace.bootstrap !== 'function') {
    console.warn('Sports UI modules are not loaded in the expected order.');
    return;
  }

  namespace.bootstrap();

  const loadStyle = href => {
    if (document.querySelector(`link[href^="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${href}?v=1`;
    document.head.appendChild(link);
  };

  const loadScript = src => {
    if (document.querySelector(`script[src^="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = `${src}?v=1`;
    script.defer = true;
    document.head.appendChild(script);
  };

  loadStyle('./assets/css/sports-head-to-head.css');
  loadScript('./assets/js/ui/sports-head-to-head.js');
})(sharedSportsComponents);