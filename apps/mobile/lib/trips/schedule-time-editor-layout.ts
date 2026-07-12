import { theme } from '../design/theme';

export type ScheduleTimeEditorLayout = {
  containerGap: number;
  containerHasOuterChrome: boolean;
  containerPadding: number;
  pillContentDirection: 'row';
  pillFillAvailableWidth: boolean;
  pillGap: number;
  pillHorizontalPadding: number;
  pillMinHeight: number;
  pillVerticalPadding: number;
  standardContainerPadding: number;
  standardControlHeight: number;
};

export function buildScheduleTimeEditorLayout(): ScheduleTimeEditorLayout {
  return {
    containerGap: theme.space[2],
    containerHasOuterChrome: false,
    containerPadding: theme.space[0],
    pillContentDirection: 'row',
    pillFillAvailableWidth: false,
    pillGap: theme.space[2],
    pillHorizontalPadding: theme.space[3],
    pillMinHeight: theme.layout.controlHSm,
    pillVerticalPadding: theme.space[2],
    standardContainerPadding: theme.space[3],
    standardControlHeight: theme.layout.controlH,
  };
}
