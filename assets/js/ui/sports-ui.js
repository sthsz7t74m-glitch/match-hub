window.SportsUI = window.SportsUI || window.FootballUI || {};

(function initializeSportsUiAliases(namespace) {
  const source = window.FootballUI || namespace;

  Object.assign(namespace, source, {
    SportsShell: source.SportsShell || source.FootballShell,
    SportsCalendar: source.SportsCalendar || source.FootballCalendar,
    SportsNavigation: source.SportsNavigation || source.FootballNavigation,
    SportsBottomNavigation: source.SportsBottomNavigation || source.BottomNavigation
  });

  if (source.calendars) namespace.calendars = source.calendars;
})(window.SportsUI);