import { theme } from '../design/theme';

export type RouteWaypointMarkerStatus = 'done' | 'next' | 'todo' | 'skipped';

export type RouteWaypointMarkerChrome = {
  badgeBorderWidth: number;
  badgeHeight: number;
  badgeMinWidth: number;
  badgeOpacity: number;
  badgeTranslateY: number;
  faded: boolean;
  haloBorderColor: 'transparent';
  haloBorderWidth: 0;
  highlighted: boolean;
};

export type RouteWaypointMarkerStyle = {
  badgeBackgroundColor: string;
  badgeBorderColor: string;
  textColor: string;
};

export function buildRouteWaypointMarkerStyle(
  color: string,
  status?: RouteWaypointMarkerStatus,
): RouteWaypointMarkerStyle {
  if (status === 'next') {
    return {
      badgeBackgroundColor: theme.color.surface,
      badgeBorderColor: color,
      textColor: color,
    };
  }

  return {
    badgeBackgroundColor: color,
    badgeBorderColor: theme.color.surface,
    textColor: theme.color.onPrimary,
  };
}

export function buildRouteWaypointMarkerChrome(status?: RouteWaypointMarkerStatus): RouteWaypointMarkerChrome {
  const faded = status === 'done' || status === 'skipped';
  const highlighted = status === 'next';

  return {
    badgeBorderWidth: highlighted ? 3 : 2,
    badgeHeight: highlighted ? 38 : 30,
    badgeMinWidth: highlighted ? 42 : 34,
    badgeOpacity: faded ? 0.42 : 1,
    badgeTranslateY: highlighted ? -6 : 0,
    faded,
    haloBorderColor: 'transparent',
    haloBorderWidth: 0,
    highlighted,
  };
}
