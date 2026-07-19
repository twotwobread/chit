import {
  buildResponsiveLineHeight,
  buildResponsiveTextProfile,
  type ResponsiveTextProfile,
  type ResponsiveTextProfileInput,
} from '../design/responsive-text';
import { theme } from '../design/theme';

export type ScheduleTimeEditorLayout = {
  containerGap: number;
  containerPadding: number;
  profile: ResponsiveTextProfile;
  segmentContentDirection: 'row' | 'column';
  segmentGap: number;
  segmentHorizontalPadding: number;
  segmentLabelLineHeight: number;
  segmentMinHeight: number;
  segmentTextLineHeight: number;
  segmentVerticalPadding: number;
  segmentedControlFillAvailableWidth: boolean;
  segmentedControlHasOuterChrome: boolean;
  standardContainerPadding: number;
  standardControlHeight: number;
  timeBridgeWidth: number;
};

export function buildScheduleTimeEditorLayout(input: ResponsiveTextProfileInput = {}): ScheduleTimeEditorLayout {
  const profile = buildResponsiveTextProfile(input);
  const compactOrLarge = profile.prefersCompactDensity;
  const segmentContentDirection = compactOrLarge ? 'column' : 'row';
  const segmentGap = compactOrLarge ? theme.space[1] : theme.space[2];
  const segmentHorizontalPadding = compactOrLarge ? theme.space[2] : theme.space[3];
  const segmentVerticalPadding = compactOrLarge ? theme.space[2] : theme.space[2];
  const segmentLabelLineHeight = buildResponsiveLineHeight({
    fontSize: theme.font.size.micro,
    fontScale: profile.fontScale,
  });
  const segmentTextLineHeight = buildResponsiveLineHeight({
    fontSize: theme.font.size.label,
    fontScale: profile.fontScale,
  });
  const contentHeight =
    segmentContentDirection === 'column'
      ? segmentLabelLineHeight + segmentTextLineHeight + segmentGap + segmentVerticalPadding * 2
      : Math.max(segmentLabelLineHeight, segmentTextLineHeight) + segmentVerticalPadding * 2;
  const segmentMinHeight = Math.max(theme.layout.controlHSm, Math.ceil(contentHeight));

  return {
    containerGap: compactOrLarge ? theme.space[3] : theme.space[2],
    containerPadding: theme.space[0],
    profile,
    segmentContentDirection,
    segmentGap,
    segmentHorizontalPadding,
    segmentLabelLineHeight,
    segmentMinHeight,
    segmentTextLineHeight,
    segmentVerticalPadding,
    segmentedControlFillAvailableWidth: true,
    segmentedControlHasOuterChrome: true,
    standardContainerPadding: theme.space[3],
    standardControlHeight: theme.layout.controlH,
    timeBridgeWidth: compactOrLarge ? theme.space[7] : theme.space[8],
  };
}
