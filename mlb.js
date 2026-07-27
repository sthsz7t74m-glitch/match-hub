(function bootstrapMlbHub(namespace) {
  const start = () => {
    if (!namespace?.start) {
      console.warn('MLB application controller is unavailable');
      return;
    }

    try {
      namespace.start();
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
