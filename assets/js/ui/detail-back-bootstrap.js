(function initializeDetailBackBootstrap(namespace) {
  class DetailBackBootstrap {
    constructor({ selector = '.app-header .back-link' } = {}) {
      this.selector = selector;
      this.control = null;
    }

    render() {
      const root = document.querySelector(this.selector);
      if (!root || !namespace?.BackButton) return this;
      this.control?.destroy?.();
      this.control = new namespace.BackButton({
        root,
        href: root.getAttribute('href') || '',
        label: root.getAttribute('aria-label') || '戻る'
      }).render();
      return this;
    }

    destroy() {
      this.control?.destroy?.();
      this.control = null;
    }
  }

  namespace.DetailBackBootstrap = DetailBackBootstrap;
  namespace.detailBackBootstrap?.destroy?.();
  namespace.detailBackBootstrap = new DetailBackBootstrap().render();
})(window.SportsUI || window.FootballUI);
