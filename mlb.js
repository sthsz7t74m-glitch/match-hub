(function bootstrapMlbHub(namespace) {
  const ensureAutomaticLoad = (instance, delay = 0) => {
    window.setTimeout(() => {
      if (!instance) return;

      const hasDynamicData = (instance.state?.games?.length || 0) > 0
        || (instance.state?.standings?.length || 0) > 0;
      if (hasDynamicData) return;

      void instance.ensureInitialLoad?.({
        fresh: true,
        reason: 'startup-watchdog'
      });
    }, delay);
  };

  const start = () => {
    if (!namespace?.start) {
      console.warn('MLB application controller is unavailable');
      return;
    }

    try {
      const instance = namespace.start();
      ensureAutomaticLoad(instance);
      ensureAutomaticLoad(instance, 2000);
    } catch (error) {
      console.error('MLB Hub failed to start:', error);
      window.SportsHub?.toast?.('MLB画面を初期化できませんでした', 2600);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})(window.MLBApp);