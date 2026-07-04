import { StyleSheet } from 'react-native';

import { theme } from '../design';

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    gap: theme.space[5],
    minHeight: '100%',
    padding: theme.space[5],
  },
  screenTitle: {
    alignSelf: 'stretch',
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    maxWidth: theme.layout.cardMaxW,
  },
  headerBlock: {
    gap: theme.space[1],
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  errorTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  fieldGroup: {
    gap: theme.space[2],
  },
  input: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  memoInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.color.danger,
  },
  readOnlyText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  validationText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  optionListVertical: {
    gap: theme.space[2],
  },
  optionChip: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  optionChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  optionText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  optionTextSelected: {
    color: theme.color.primary,
  },
  optionDetail: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  placeOption: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[1],
    padding: theme.space[4],
  },
  placeOptionSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  splitList: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  splitRow: {
    alignItems: 'center',
    borderBottomColor: theme.color.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.space[3],
  },
  manualSplitRow: {
    alignItems: 'center',
    borderBottomColor: theme.color.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    padding: theme.space[3],
  },
  manualSplitInput: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minWidth: 120,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    textAlign: 'right',
  },
  amountText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  actions: {
    gap: theme.space[3],
  },
});
