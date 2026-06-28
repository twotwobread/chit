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
  onNavigate: () => void;
  onArrive: () => void;
  onSkip: () => void;
  onLodging: () => void;
};

const DEFAULT_TRAVEL_OPTIONS = ['대중교통', '도보', '자동차'];
const ROUTE_FALLBACK_COPY = '경로 정보를 준비 중이에요';

export function NextPlaceHeroCard({
  onArrive,
  onLodging,
  onNavigate,
  onSkip,
  onTravelMode,
  place,
  routeChip,
  travelMode,
  travelOptions = DEFAULT_TRAVEL_OPTIONS,
}: NextPlaceHeroCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.overline}>NEXT · 다음 장소</Text>

      <View style={styles.head}>
        <PlacePin order={place.order} size={44} type={place.type} />
        <View style={styles.headBody}>
          <Text style={styles.name}>{place.name}</Text>
          <Text style={styles.address}>{place.address}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <MapPin color={theme.color.green[100]} size={15} strokeWidth={2} />
        <Text style={styles.meta}>{place.legText}</Text>
      </View>
      {place.openText ? (
        <View style={styles.metaRow}>
          <Clock color={theme.color.green[100]} size={15} strokeWidth={2} />
          <Text style={styles.meta}>{place.openText}</Text>
        </View>
      ) : null}

      <View style={styles.routeBox}>
        <View style={styles.routeCanvas}>
          <View style={[styles.routeDot, styles.routeDotStart]} />
          <View style={styles.routeLine} />
          <View style={[styles.routeDot, styles.routeDotEnd]} />
          <View style={styles.routeChip}>
            <Text style={styles.routeChipText}>{routeChip ?? ROUTE_FALLBACK_COPY}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onNavigate}
          style={({ pressed }) => [styles.routeHandoff, pressed ? styles.pressedDark : null]}
        >
          <Text style={styles.routeHandoffText}>상세 안내는 길찾기에서 이어져요</Text>
          <Text style={styles.routeHandoffCta}>길찾기 ›</Text>
        </Pressable>
      </View>

      <View style={styles.toggleWrap}>
        <SegmentedControl dark onChange={onTravelMode} options={travelOptions} value={travelMode} />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onNavigate}
          style={({ pressed }) => [styles.action, styles.actionLight, pressed ? styles.pressed : null]}
        >
          <Navigation color={theme.color.green[800]} size={18} strokeWidth={2.2} />
          <Text style={[styles.actionText, styles.actionTextDark]}>길찾기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onArrive}
          style={({ pressed }) => [styles.action, styles.actionGreen, pressed ? styles.pressed : null]}
        >
          <Check color={theme.color.onPrimary} size={18} strokeWidth={2.6} />
          <Text style={[styles.actionText, styles.actionTextLight]}>도착</Text>
        </Pressable>
      </View>

      <View style={styles.subRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => [styles.subAction, pressed ? styles.pressedDark : null]}
        >
          <Text style={styles.subActionText}>건너뛰기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onLodging}
          style={({ pressed }) => [styles.subAction, pressed ? styles.pressedDark : null]}
        >
          <Text style={styles.subActionText}>숙소로</Text>
        </Pressable>
      </View>
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
    backgroundColor: theme.color.green[500],
  },
  actionLight: {
    backgroundColor: theme.color.onPrimary,
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
    color: theme.color.green[800],
  },
  actionTextLight: {
    color: theme.color.onPrimary,
  },
  address: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    marginTop: theme.space[1] + 1,
  },
  card: {
    backgroundColor: theme.color.green[900],
    borderRadius: theme.radius['2xl'],
    gap: theme.space[3],
    padding: theme.space[6] + 2,
    ...theme.shadow.lg,
  },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[4],
    marginTop: theme.space[2],
  },
  headBody: {
    flex: 1,
  },
  meta: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  name: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
  overline: {
    color: theme.color.green[200],
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
  routeBox: {
    borderColor: theme.color.green[800],
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: theme.space[3],
    overflow: 'hidden',
  },
  routeCanvas: {
    backgroundColor: theme.color.green[50],
    height: 120,
    justifyContent: 'flex-start',
    padding: theme.space[3],
  },
  routeChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    ...theme.shadow.xs,
  },
  routeChipText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  routeDot: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.surface,
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    position: 'absolute',
    width: 14,
    zIndex: 1,
  },
  routeDotEnd: {
    bottom: theme.space[4],
    right: theme.space[8],
  },
  routeDotStart: {
    left: theme.space[8],
    top: theme.space[8],
  },
  routeHandoff: {
    alignItems: 'center',
    backgroundColor: theme.color.green[800],
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  routeHandoffCta: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  routeHandoffText: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  routeLine: {
    backgroundColor: theme.color.green[300],
    borderRadius: theme.radius.pill,
    bottom: theme.space[6],
    height: 4,
    left: theme.space[9],
    position: 'absolute',
    right: theme.space[9],
    transform: [{ rotate: '-14deg' }],
  },
  subAction: {
    alignItems: 'center',
    backgroundColor: theme.color.green[800],
    borderRadius: theme.radius.md,
    flex: 1,
    height: theme.layout.tapMin,
    justifyContent: 'center',
  },
  subActionText: {
    color: theme.color.green[100],
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
