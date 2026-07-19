import { theme } from '../design/theme';

export const SELECTED_NAV_TAB_SURFACE_STYLE = {
  backgroundColor: theme.color.primary,
  ...theme.shadow.xs,
} as const;
