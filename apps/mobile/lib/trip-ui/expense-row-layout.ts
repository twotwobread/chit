import {
  buildResponsiveLineHeight,
  buildResponsiveTextProfile,
  type ResponsiveTextProfile,
  type ResponsiveTextProfileInput,
} from '../design/responsive-text';
import { theme } from '../design/theme';

export type ExpenseRowLayout = {
  amountPlacement: 'trailing' | 'stacked';
  metaDirection: 'row' | 'column';
  metaLineHeight: number;
  metaNumberOfLines: number;
  minRowHeight: number;
  profile: ResponsiveTextProfile;
  rowAlignItems: 'center' | 'flex-start';
  titleLineHeight: number;
  titleNumberOfLines: number;
};

export function buildExpenseRowLayout(input: ResponsiveTextProfileInput = {}): ExpenseRowLayout {
  const profile = buildResponsiveTextProfile(input);
  const stacked = profile.prefersStackedContent;
  const titleNumberOfLines = stacked ? 2 : 1;
  const metaNumberOfLines = stacked ? 2 : 1;
  const titleLineHeight = buildResponsiveLineHeight({
    fontSize: theme.font.size.body,
    fontScale: profile.fontScale,
  });
  const metaLineHeight = buildResponsiveLineHeight({
    fontSize: theme.font.size.caption,
    fontScale: profile.fontScale,
  });

  return {
    amountPlacement: stacked ? 'stacked' : 'trailing',
    metaDirection: stacked ? 'column' : 'row',
    metaLineHeight,
    metaNumberOfLines,
    minRowHeight: Math.max(theme.layout.tapMin, titleLineHeight + metaLineHeight + theme.space[1] + theme.space[4] * 2),
    profile,
    rowAlignItems: stacked ? 'flex-start' : 'center',
    titleLineHeight,
    titleNumberOfLines,
  };
}
