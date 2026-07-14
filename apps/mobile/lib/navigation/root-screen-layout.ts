import { theme } from '../design/theme';

export function getRootScreenContentTopPadding(safeAreaTop: number): number {
  return safeAreaTop + theme.space[7];
}
