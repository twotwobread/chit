import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Clock, MapPin, Navigation } from 'lucide-react-native';

import { PlacePin, SegmentedControl, theme } from '../design';

export type NextPlace = {
  order: number;
  type: keyof typeof theme.placeType;
  name: string;
  address: string;
  legText: string;
  openText?: string;
};

export type NextPlaceHeroCardProps = {
  place: NextPlace;
  travelMode: string;
  travelOptions?: string[];
  onTravelMode: (value: string) => void;
  routeChip?: string;
  navigationAvailable?: boolean;
  showRoutePreview?: boolean;
  onNavigate: () => void;
  onArrive: () => void;
  arriveDisabled?: boolean;
  arriveLabel?: string;
  onSkip: () => void;
  skipDisabled?: boolean;
  skipLabel?: string;
  onLodging: () => void;
  lodgingDisabled?: boolean;
  lodgingHelper?: string;
  lodgingLabel?: string;
};

const DEFAULT_TRAVEL_OPTIONS = ['대중교통', '도보', '자동차'];
const ROUTE_FALLBACK_COPY = '경로 정보를 준비 중이에요';

export function NextPlaceHeroCard({
  arriveDisabled = false,
  arriveLabel = '도착',
  lodgingDisabled = false,
  lodgingHelper,
  lodgingLabel = '숙소로',
  onArrive,
  onLodging,
  navigationAvailable = true,
  onNavigate,
  onSkip,
  onTravelMode,
  place,
  routeChip,
  showRoutePreview = true,
  skipDisabled = false,
  skipLabel = '건너뛰기',
  travelMode,
  travelOptions = DEFAULT_TRAVEL_OPTIONS,
}: NextPlaceHeroCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.overline}>다음 장소</Text>

      <View style={styles.head}>
        <PlacePin order={place.order} size={44} type={place.type} />
        <View style={styles.headBody}>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.address}>{place.address}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <MapPin color={theme.color.primary} size={15} strokeWidth={2} />
        <Text style={styles.meta}>{place.legText}</Text>
      </View>
      {place.openText ? (
        <View style={styles.metaRow}>
          <Clock color={theme.color.primary} size={15} strokeWidth={2} />
          <Text style={styles.meta}>{place.openText}</Text>
        </View>
      ) : null}

      {navigationAvailable ? (
        <>
          {showRoutePreview ? (
            <View style={styles.routeSummary}>
              <Text style={styles.routeChipText}>{routeChip ?? ROUTE_FALLBACK_COPY}</Text>
            </View>
          ) : null}

          <View style={styles.toggleWrap}>
            <SegmentedControl dark onChange={onTravelMode} options={travelOptions} value={travelMode} />
          </View>
        </>
      ) : null}

      <View style={styles.actionRow}>
        {navigationAvailable ? (
          <Pressable
            accessibilityRole="button"
            onPress={onNavigate}
            style={({ pressed }) => [styles.action, styles.actionLight, pressed ? styles.pressed : null]}
          >
            <Navigation color={theme.color.onPrimary} size={18} strokeWidth={2.2} />
            <Text style={[styles.actionText, styles.actionTextDark]}>길찾기</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: arriveDisabled }}
          disabled={arriveDisabled}
          onPress={onArrive}
          style={({ pressed }) => [
            styles.action,
            styles.actionGreen,
            arriveDisabled ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Check color={theme.color.onPrimary} size={18} strokeWidth={2.6} />
          <Text style={[styles.actionText, styles.actionTextLight]}>{arriveLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.subRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: skipDisabled }}
          disabled={skipDisabled}
          onPress={onSkip}
          style={({ pressed }) => [
            styles.subAction,
            skipDisabled ? styles.disabled : null,
            pressed ? styles.pressedDark : null,
          ]}
        >
          <Text style={styles.subActionText}>{skipLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: lodgingDisabled }}
          disabled={lodgingDisabled}
          onPress={onLodging}
          style={({ pressed }) => [
            styles.subAction,
            lodgingDisabled ? styles.disabled : null,
            pressed ? styles.pressedDark : null,
          ]}
        >
          <Text style={styles.subActionText}>{lodgingLabel}</Text>
        </Pressable>
      </View>
      {lodgingHelper ? <Text style={styles.lodgingHelper}>{lodgingHelper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    flex: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    height: theme.layout.controlHLg,
    justifyContent: 'center',
  },
  actionGreen: {
    backgroundColor: theme.color.primary,
  },
  actionLight: {
    backgroundColor: theme.color.surface,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[3],
  },
  actionText: {
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  actionTextDark: {
    color: theme.color.onPrimary,
  },
  actionTextLight: {
    color: theme.color.onPrimary,
  },
  address: {
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    marginTop: theme.space[1] + 1,
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.chit.charcoalElevated,
    borderRadius: theme.radius['2xl'],
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[6] + 2,
    ...theme.shadow.md,
  },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[4],
    marginTop: theme.space[2],
  },
  disabled: {
    opacity: 0.55,
  },
  headBody: {
    flex: 1,
  },
  meta: {
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  lodgingHelper: {
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  name: {
    color: theme.color.textOnDark,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
  overline: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.2,
  },
  pressed: {
    opacity: 0.82,
  },
  pressedDark: {
    opacity: 0.72,
  },
  routeSummary: {
    alignSelf: 'center',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.pill,
    marginTop: theme.space[3],
    maxWidth: '100%',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    ...theme.shadow.xs,
  },
  routeChipText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  subAction: {
    alignItems: 'center',
    backgroundColor: theme.color.chit.charcoalElevated,
    borderRadius: theme.radius.md,
    flex: 1,
    height: theme.layout.tapMin,
    justifyContent: 'center',
  },
  subActionText: {
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  subRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  toggleWrap: {
    marginTop: theme.space[3],
  },
});
