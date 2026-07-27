const sharedSportsFacade = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedSportsFacade;
window.FootballUI = sharedSportsFacade;

(function initializeSportsUiFacade(namespace) {
  const registry = window.SportsHubRegistry;

  Object.assign(namespace, {
    SportsShell: namespace.SportsShell || namespace.FootballShell,
    SportsCalendar: namespace.SportsCalendar || namespace.FootballCalendar,
    SportsNavigation: namespace.SportsNavigation || namespace.FootballNavigation,
    SportsBottomNavigation: namespace.SportsBottomNavigation || namespace.BottomNavigation,
    SportsRegistry: registry?.SportsRegistry,
    registry: registry?.registry,
    getPageConfig: page => registry?.get?.(page) || null
  });

  namespace.FootballShell = namespace.FootballShell || namespace.SportsShell;
  namespace.FootballCalendar = namespace.FootballCalendar || namespace.SportsCalendar;
  namespace.FootballNavigation = namespace.FootballNavigation || namespace.SportsNavigation;
  namespace.BottomNavigation = namespace.BottomNavigation || namespace.SportsBottomNavigation;
  namespace.calendars = namespace.calendars || {};
})(sharedSportsFacade);