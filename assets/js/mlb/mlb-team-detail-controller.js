window.MLBApp = window.MLBApp || {};

(function initializeMlbTeamDetailController(namespace) {
  const BaseController = namespace.MLBController;
  if (!BaseController) throw new Error('Base MLB controller is unavailable');

  class MLBTeamDetailController extends BaseController {
    constructor(options = {}) {
      super(options);
      this.nodes.teamDialog = this.root.querySelector('#mlbTeamDialog');
      this.nodes.teamDialogBody = this.root.querySelector('#mlbTeamDialogBody');
      this.nodes.teamDialogClose = this.root.querySelector('#closeMlbTeamDialog');
      this.handlers.closeTeamDialog = () => this.view.closeTeamDetail?.();
      this.handlers.teamDialogClick = event => {
        if (event.target === this.nodes.teamDialog) this.view.closeTeamDetail?.();
      };
    }

    handleDocumentClick(event) {
      const teamButton = event.target.closest('[data-open-mlb-team]');
      if (teamButton) {
        event.preventDefault();
        event.stopPropagation();
        this.view.openTeamDetail?.(teamButton.dataset.openMlbTeam);
        return;
      }
      super.handleDocumentClick(event);
    }

    bind() {
      if (this.bound) return this;
      super.bind();
      this.nodes.teamDialogClose?.addEventListener('click', this.handlers.closeTeamDialog);
      this.nodes.teamDialog?.addEventListener('click', this.handlers.teamDialogClick);
      return this;
    }

    destroy() {
      this.nodes.teamDialogClose?.removeEventListener('click', this.handlers.closeTeamDialog);
      this.nodes.teamDialog?.removeEventListener('click', this.handlers.teamDialogClick);
      super.destroy();
    }
  }

  Object.assign(namespace, {
    MLBControllerBase: BaseController,
    MLBTeamDetailController,
    MLBController: MLBTeamDetailController,
    start(options) {
      if (namespace.instance) {
        void namespace.instance.ensureInitialLoad?.({ fresh: true, reason: 'startup-watchdog' });
        return namespace.instance;
      }
      namespace.instance = new MLBTeamDetailController(options).start();
      return namespace.instance;
    }
  });
})(window.MLBApp);
