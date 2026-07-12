import { theme } from '../design/theme';

export type ScheduleTimeEditorLayout = {
  containerGap: number;
  containerPadding: number;
  segmentContentDirection: 'row';
  segmentGap: number;
  segmentHorizontalPadding: number;
  segmentMinHeight: number;
  segmentVerticalPadding: number;
  segmentedControlFillAvailableWidth: boolean;
  segmentedControlHasOuterChrome: boolean;
  standardContainerPadding: number;
  standardControlHeight: number;
};

export function buildScheduleTimeEditorLayout(): ScheduleTimeEditorLayout {
  return {
    containerGap: theme.space[2],
    containerPadding: theme.space[0],
    segmentContentDirection: 'row',
    segmentGap: theme.space[2],
    segmentHorizontalPadding: theme.space[3],
    segmentMinHeight: theme.layout.controlHSm,
    segmentVerticalPadding: theme.space[2],
    segmentedControlFillAvailableWidth: true,
    segmentedControlHasOuterChrome: true,
    standardContainerPadding: theme.space[3],
    standardControlHeight: theme.layout.controlH,
  };
}
