const sharedSportsFacade = window.SportsUI || window.FootballUI || {};
window.SportsUI = sharedSportsFacade;
window.FootballUI = sharedSportsFacade;

(function initializeSportsUiFacade(namespace) {
  const registry = window.SportsHubRegistry;
  const core = window.SportsCore || window.FootballCore;
  const components = window.SportsHubComponents;

  Object.assign(namespace, {
    SportsComponent: core?.SportsComponent,
    SportsView: core?.SportsView,
    SportsHeader: namespace.SportsHeader,
    SoccerHeader: namespace.SoccerHeader,
    BaseballHeader: namespace.BaseballHeader,
    SportsShell: namespace.SportsShell || namespace.FootballShell,
    SoccerHubShell: namespace.SoccerHubShell,
    BaseballHubShell: namespace.BaseballHubShell,
    SportsCalendar: namespace.SportsCalendar || namespace.FootballCalendar,
    SportsNavigation: namespace.SportsNavigation || namespace.FootballNavigation,
    SportsBottomNavigation: namespace.SportsBottomNavigation || namespace.BottomNavigation,
    SportsEmptyState: core?.SportsEmptyState,
    SportsScheduleEmptyState: core?.SportsScheduleEmptyState,
    SportsFavoritesEmptyState: core?.SportsFavoritesEmptyState,
    SportsDataEmptyState: core?.SportsDataEmptyState,
    SportsEventCard: components?.SportsEventCard,
    SoccerMatchCard: components?.SoccerMatchCard,
    BaseballGameCard: components?.BaseballGameCard,
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
