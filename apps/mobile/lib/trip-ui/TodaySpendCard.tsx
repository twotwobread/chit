import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AmountText, Badge, HeroActions, HeroCard, HeroHeader, HeroMetricPanel, InlineAction, theme } from '../design';

export type TodaySpendCardProps = {
  totalAmount: number;
  totalAmountLabel?: string;
  currency?: 'KRW' | 'JPY' | string;
  paidByMeAmount?: number;
  mySpendLabel?: string;
  myRegularSpendLabel?: string;
  myPublicFundSpendLabel?: string;
  regularTotalLabel?: string;
  publicFundTotalLabel?: string;
  settlementTitle?: string;
  settlementHelper?: string;
  excludedPublicFundLabel?: string | null;
  needsReviewCount?: number;
  pendingSyncCount?: number;
  failedSyncCount?: number;
  additionalAmountLabels?: string[];
  onPressAdd: () => void;
  onPressRetryFailed?: () => void;
  addLabel?: string;
};

export function TodaySpendCard({
  addLabel = '지출 등록',
  additionalAmountLabels = [],
  currency = 'JPY',
  excludedPublicFundLabel,
  myPublicFundSpendLabel,
  myRegularSpendLabel,
  mySpendLabel,
  needsReviewCount = 0,
  onPressAdd,
  onPressRetryFailed,
  paidByMeAmount,
  pendingSyncCount = 0,
  failedSyncCount = 0,
  publicFundTotalLabel,
  regularTotalLabel,
  settlementHelper,
  settlementTitle,
  totalAmount,
  totalAmountLabel,
}: TodaySpendCardProps) {
  const primaryAmountLabel = totalAmountLabel ?? formatHeroAmount(totalAmount, currency);
  const [showBreakdownDetails, setShowBreakdownDetails] = useState(false);
  const { fontScale, width } = useWindowDimensions();
  const shouldStackSummary = width < 390 || fontScale >= 1.2;
  const hasBreakdownDetails = Boolean(
    myRegularSpendLabel || myPublicFundSpendLabel || regularTotalLabel || publicFundTotalLabel,
  );
  const syncMeta =
    failedSyncCount > 0
      ? `저장 실패 ${failedSyncCount}`
      : pendingSyncCount > 0
        ? `저장 대기 ${pendingSyncCount}`
        : null;
  const syncHelper =
    failedSyncCount > 0
      ? '서버 저장에 실패한 지출이 있어요. 연결/로그인 상태를 확인한 뒤 다시 시도해주세요.'
      : pendingSyncCount > 0
        ? '기기에 보관된 지출을 연결되면 자동으로 저장해요.'
        : null;

  return (
    <HeroCard
      variant="panel"
      header={
        <HeroHeader
          body="오늘 쓴 돈만 빠르게 확인해요."
          eyebrow="오늘 지출"
          meta={
            syncMeta ? (
              <Badge label={syncMeta} tone={failedSyncCount > 0 ? 'danger' : 'amber'} />
            ) : needsReviewCount > 0 ? (
              <Badge label={`확인 필요 ${needsReviewCount}`} tone="amber" />
            ) : null
          }
          title="금액만 확인하면 끝."
        />
      }
    >
      <HeroMetricPanel label="오늘 총 지출" value={primaryAmountLabel} />
      {additionalAmountLabels.length > 0 ? (
        <View style={styles.additionalAmounts}>
          {additionalAmountLabels.map((label) => (
            <Text key={label} style={styles.additionalAmountText}>
              + {label}
            </Text>
          ))}
        </View>
      ) : null}
      {mySpendLabel ? (
        <View style={[styles.summaryGrid, shouldStackSummary ? styles.summaryGridStacked : null]}>
          <SpendMiniPanel label="내 소비" value={mySpendLabel} />
          <SpendMiniPanel
            label="정산 스냅샷"
            helper={settlementHelper}
            value={settlementTitle ?? '정산할 금액 없어요'}
          />
        </View>
      ) : null}
      {excludedPublicFundLabel ? <Text style={styles.excludedPublicFundPill}>{excludedPublicFundLabel}</Text> : null}
      {syncHelper ? (
        <Text style={failedSyncCount > 0 ? styles.syncErrorText : styles.syncPendingText}>{syncHelper}</Text>
      ) : null}
      {hasBreakdownDetails ? (
        <InlineAction
          accessibilityLabel={showBreakdownDetails ? '오늘 지출 구성 숨기기' : '오늘 지출 구성 보기'}
          expanded={showBreakdownDetails}
          label={showBreakdownDetails ? '지출 구성 숨기기' : '지출 구성 보기'}
          onPress={() => setShowBreakdownDetails((visible) => !visible)}
          style={styles.breakdownToggle}
        />
      ) : null}
      {showBreakdownDetails && (myRegularSpendLabel || myPublicFundSpendLabel) ? (
        <View style={styles.breakdownBox}>
          <Text style={styles.breakdownTitle}>내 소비 구성</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>일반</Text>
            <Text style={styles.breakdownValue}>{myRegularSpendLabel ?? '0엔'}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>공금</Text>
            <Text style={styles.breakdownValue}>{myPublicFundSpendLabel ?? '0엔'}</Text>
          </View>
        </View>
      ) : null}
      {showBreakdownDetails && (regularTotalLabel || publicFundTotalLabel) ? (
        <View style={styles.breakdownBox}>
          <Text style={styles.breakdownTitle}>오늘 지출 구성</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>일반 지출</Text>
            <Text style={styles.breakdownValue}>{regularTotalLabel ?? '0엔'}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>공금 지출</Text>
            <Text style={styles.breakdownValue}>{publicFundTotalLabel ?? '0엔'}</Text>
          </View>
        </View>
      ) : null}
      {paidByMeAmount == null ? null : (
        <View style={styles.paidByMeRow}>
          <Text style={styles.paidByMeLabel}>내가 낸 금액</Text>
          <AmountText currency={currency} size="sm" value={paidByMeAmount} style={styles.paidByMeAmount} />
        </View>
      )}
      <HeroActions
        primary={{ label: addLabel, onPress: onPressAdd }}
        secondary={
          failedSyncCount > 0 && onPressRetryFailed ? { label: '다시 저장', onPress: onPressRetryFailed } : undefined
        }
      />
    </HeroCard>
  );
}

function SpendMiniPanel({ helper, label, value }: { helper?: string; label: string; value: string }) {
  return (
    <View style={styles.miniPanel}>
      <Text style={styles.miniPanelLabel}>{label}</Text>
      <Text style={styles.miniPanelValue}>{value}</Text>
      {helper ? <Text style={styles.miniPanelHelper}>{helper}</Text> : null}
    </View>
  );
}

function formatHeroAmount(value: number, currency: 'KRW' | 'JPY' | string): string {
  const suffix = currency === 'KRW' ? '원' : currency === 'JPY' ? '엔' : '';
  return `${Math.abs(Math.round(value)).toLocaleString('ko-KR')}${suffix}`;
}

const styles = StyleSheet.create({
  additionalAmounts: {
    gap: theme.space[1],
  },
  additionalAmountText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  breakdownBox: {
    backgroundColor: theme.color.surfaceSoft,
    borderRadius: theme.radius.md,
    gap: theme.space[2],
    padding: theme.space[3],
  },
  breakdownLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  breakdownRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  breakdownTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  breakdownToggle: {
    alignSelf: 'flex-start',
  },
  breakdownValue: {
    color: theme.color.textStrong,
    flexShrink: 0,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  excludedPublicFundPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  miniPanel: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
    padding: theme.space[3],
  },
  miniPanelHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  miniPanelLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  miniPanelValue: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  paidByMeAmount: {
    color: theme.color.textStrong,
  },
  paidByMeLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  paidByMeRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  summaryGridStacked: {
    flexDirection: 'column',
  },
  syncErrorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  syncPendingText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
});
