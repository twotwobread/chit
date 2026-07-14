import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, theme } from '../design';
import type { TodayRoutePreviewSummaryState } from '../trips/today-route-preview';
import type { TravelMode } from '../trips/travel-mode';

export function TodayRouteSummaryCard({
  selectedMode,
  state,
}: {
  selectedMode?: TravelMode | null;
  state: TodayRoutePreviewSummaryState;
}) {
  if (state.status === 'idle') {
    return null;
  }

  if (state.status === 'loading') {
    return (
      <Card style={styles.card}>
        <Text style={styles.eyebrow}>현 위치 기준</Text>
        <Text style={styles.title}>예상 이동 시간을 확인하고 있어요.</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.helper}>{state.message}</Text>
        </View>
      </Card>
    );
  }

  if (state.status === 'success') {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>현 위치 기준</Text>
            <Text style={styles.title}>{state.title}</Text>
          </View>
          <Text style={styles.source}>Google Maps</Text>
        </View>
        <View style={styles.modeGrid}>
          {state.rows.map((row) => {
            const selected = row.mode === selectedMode;
            return (
              <View key={row.mode} style={[styles.modeCard, selected ? styles.modeCardSelected : null]}>
                <View style={styles.modeHeader}>
                  <Text style={[styles.modeLabel, selected ? styles.modeLabelSelected : null]}>{row.modeLabel}</Text>
                  {selected ? <Text style={styles.selectedPill}>선택됨</Text> : null}
                </View>
                {row.status === 'success' ? (
                  <>
                    <Text style={styles.duration}>{row.durationLabel}</Text>
                    <Text style={styles.distance}>{row.distanceLabel}</Text>
                  </>
                ) : (
                  <Text style={styles.unavailable}>{row.message}</Text>
                )}
              </View>
            );
          })}
        </View>
        <Text style={styles.helper}>{state.helper}</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.eyebrow}>현 위치 기준</Text>
      <Text style={styles.title}>{state.title}</Text>
      <Text style={styles.helper}>{state.helper}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.space[4],
  },
  distance: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  duration: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  eyebrow: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
    letterSpacing: 0.6,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: theme.space[1],
  },
  helper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: 18,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  modeCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: theme.space[2],
    minWidth: 96,
    padding: theme.space[3],
  },
  modeCardSelected: {
    backgroundColor: theme.color.green[50],
    borderColor: theme.color.primary,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  modeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'space-between',
  },
  modeLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  modeLabelSelected: {
    color: theme.color.primary,
  },
  selectedPill: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[2],
    paddingVertical: 2,
  },
  source: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  unavailable: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
});
