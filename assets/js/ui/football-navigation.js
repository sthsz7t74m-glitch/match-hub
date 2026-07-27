const sharedNavigationUI = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedNavigationUI;
window.FootballUI = sharedNavigationUI;

(function initializeSportsNavigation(namespace) {
  if (namespace.SportsNavigation?.NAVIGATION_VERSION >= 2) return;

  const Core = window.SportsCore || window.FootballCore || {};
  const ComponentBase = Core.SportsComponent || class {
    constructor({ root = null } = {}) { this.root = root; }
  };
  const isActiveNavigationItem = item => item?.classList.contains('active');

  class SportsNavigation extends ComponentBase {
    static NAVIGATION_VERSION = 2;

    constructor(root = document.querySelector('.bottom-nav')) {
      super({ root });
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
      if (this.root && this.bound) this.root.removeEventListener('click', this.handleClick, true);
      this.bound = false;
      super.destroy?.();
    }
  }

  class SoccerNavigation extends SportsNavigation {}
  class BaseballNavigation extends SportsNavigation {}

  const createNavigation = root => {
    const NavigationClass = document.body.dataset.sport === 'baseball'
      ? BaseballNavigation
      : SoccerNavigation;
    return new NavigationClass(root);
  };

  const bindNavigation = root => createNavigation(root).bind();
  const start = () => {
    namespace.navigation?.destroy?.();
    namespace.navigation = bindNavigation(document.querySelector('.bottom-nav'));
  };

  Object.assign(namespace, {
    SportsNavigation,
    SoccerNavigation,
    BaseballNavigation,
    FootballNavigation: SoccerNavigation,
    createNavigation,
    bindNavigation
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(sharedNavigationUI);
