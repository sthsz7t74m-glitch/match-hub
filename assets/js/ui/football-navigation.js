window.FootballUI = window.FootballUI || {};

(function initializeFootballNavigation(namespace) {
  if (namespace.FootballNavigation) return;

  const isActiveNavigationItem = item => item?.classList.contains('active');

  class FootballNavigation {
    constructor(root = document.querySelector('.bottom-nav')) {
      this.root = root;
      this.bound = false;
    }

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    bind() {
      if (!this.root || this.bound) return this;
      this.bound = true;

      this.root.addEventListener('click', event => {
        const item = event.target.closest('.nav-item');
        if (!item || !this.root.contains(item) || !isActiveNavigationItem(item)) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        this.scrollToTop();
      }, true);

      return this;
    }
  }

  const start = () => {
    namespace.navigation = namespace.bindNavigation(document.querySelector('.bottom-nav'));
  };

  Object.assign(namespace, {
    FootballNavigation,
    bindNavigation(root) {
      const navigation = new FootballNavigation(root);
      navigation.bind();
      return navigation;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window.FootballUI);
