import { StyleSheet } from 'react-native';

import { theme } from '../design';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[7],
    width: '100%',
    ...theme.shadow.sm,
  },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.space[4],
    padding: theme.space[7],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  header: {
    gap: theme.space[3],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  legalError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    padding: theme.space[4],
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  settlementChip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  settlementChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  settlementChipReceive: {
    backgroundColor: theme.color.green[50],
  },
  settlementChipSend: {
    backgroundColor: theme.color.red[100],
  },
  settlementChipText: {
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  settlementChipTextReceive: {
    color: theme.color.credit,
  },
  settlementChipTextSend: {
    color: theme.color.debit,
  },
  settlementDate: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  settlementList: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settlementRow: {
    gap: theme.space[3],
    padding: theme.space[5],
  },
  settlementRowHeader: {
    gap: theme.space[1],
  },
  settlementStack: {
    gap: theme.space[3],
  },
  settlementSummaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  settlementTripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  sectionStack: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  sectionTitle: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  subtitle: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
  },
  title: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
  tripList: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tripSection: {
    gap: theme.space[3],
  },
  tripSectionTitle: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  tripSections: {
    gap: theme.space[5],
  },
});
