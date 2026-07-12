import { StyleSheet } from 'react-native';

import { theme } from '../design';

export const styles = StyleSheet.create({
  actionColumn: {
    gap: theme.space[2],
    minWidth: 88,
  },
  address: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  optionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  placeDetailCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  placeType: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  map: {
    width: '100%',
  },
  mapCollapsed: {
    height: 520,
  },
  mapExpanded: {
    height: 260,
  },
  mapSearch: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    height: 640,
    maxWidth: theme.layout.cardMaxW,
    overflow: 'hidden',
    width: '100%',
  },
  mapFullScreenRoot: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
  mapSearchFullScreen: {
    flex: 1,
  },
  dayChipsOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: theme.space[4],
    zIndex: 4,
  },
  mapFeedbackOverlay: {
    bottom: theme.space[5],
    left: theme.space[5],
    position: 'absolute',
    right: theme.space[5],
    zIndex: 5,
  },
  mapSheetWrap: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    maxWidth: theme.layout.cardMaxW,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  routeSheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    ...theme.shadow.md,
  },
  routeSheetCollapsed: {
    maxHeight: 104,
  },
  routeSheetExpanded: {
    maxHeight: '78%',
    position: 'relative',
  },
  rowButton: {
    minHeight: 34,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowSubtitle: {
    gap: theme.space[2],
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  searchButtonDisabled: {
    opacity: 0.55,
  },
  searchButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  searchInput: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  searchNotice: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  searchNoticeTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  searchResultCard: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  searchResultCardSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  searchResultList: {
    gap: theme.space[3],
  },
  searchRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  searchSection: {
    gap: theme.space[4],
    paddingBottom: theme.space[4],
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    height: 4,
    width: 42,
  },
  sheetHandleArea: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  sheetHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  sheetTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  summary: {
    gap: theme.space[1],
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[4],
  },
  summaryHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
