const sharedNavigationUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedNavigationUI;
window.FootballUI = sharedNavigationUI;

(function initializeSportsNavigation(namespace) {
  if (namespace.SportsNavigation) return;

  const isActiveNavigationItem = item => item?.classList.contains('active');

  class SportsNavigation {
    constructor(root = document.querySelector('.bottom-nav')) {
      this.root = root;
      this.bound = false;
      this.handleClick = this.handleClick.bind(this);
    }

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    handleClick(event) {
      const item = event.target.closest('.nav-item');
      if (!item || !this.root?.contains(item) || !isActiveNavigationItem(item)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      this.scrollToTop();
    }

    bind() {
      if (!this.root || this.bound) return this;
      this.bound = true;
      this.root.addEventListener('click', this.handleClick, true);
      return this;
    }

    destroy() {
      if (!this.root || !this.bound) return;
      this.root.removeEventListener('click', this.handleClick, true);
      this.bound = false;
    }
  }

  const bindNavigation = root => new SportsNavigation(root).bind();
  const start = () => {
    namespace.navigation?.destroy?.();
    namespace.navigation = bindNavigation(document.querySelector('.bottom-nav'));
  };

  Object.assign(namespace, {
    SportsNavigation,
    FootballNavigation: SportsNavigation,
    bindNavigation
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(sharedNavigationUI);