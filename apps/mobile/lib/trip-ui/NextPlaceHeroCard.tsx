import { StyleSheet, Text, View } from 'react-native';
import { Clock, MapPin } from 'lucide-react-native';

import { HeroActions, HeroCard, HeroHeader, InlineAction, PlacePin, SegmentedControl, theme } from '../design';

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
    <HeroCard
      variant="graphite"
      header={
        <HeroHeader
          body={place.address}
          eyebrow="다음 장소"
          meta={
            <View style={styles.placeMetaWrap}>
              <View style={styles.head}>
                <PlacePin order={place.order} size={44} type={place.type} />
                <View style={styles.headBody}>
                  <View style={styles.metaRow}>
                    <MapPin color={theme.color.uiAccent} size={15} strokeWidth={2} />
                    <Text style={styles.meta}>{place.legText}</Text>
                  </View>
                  {place.openText ? (
                    <View style={styles.metaRow}>
                      <Clock color={theme.color.uiAccent} size={15} strokeWidth={2} />
                      <Text style={styles.meta}>{place.openText}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          }
          onDark
          title={place.name}
        />
      }
    >
      {navigationAvailable ? (
        <>
          {showRoutePreview ? (
            <View style={styles.routeSummary}>
              <Text style={styles.routeChipText}>{routeChip ?? ROUTE_FALLBACK_COPY}</Text>
            </View>
          ) : null}

          <SegmentedControl dark onChange={onTravelMode} options={travelOptions} value={travelMode} />
        </>
      ) : null}

      <HeroActions
        primary={{ disabled: arriveDisabled, label: arriveLabel, onPress: onArrive, tone: 'lime' }}
        secondary={navigationAvailable ? { label: '길찾기', onPress: onNavigate } : undefined}
      />

      <View style={styles.subRow}>
        <InlineAction disabled={skipDisabled} label={skipLabel} onPress={onSkip} style={styles.subAction} />
        <InlineAction disabled={lodgingDisabled} label={lodgingLabel} onPress={onLodging} style={styles.subAction} />
      </View>
      {lodgingHelper ? <Text style={styles.lodgingHelper}>{lodgingHelper}</Text> : null}
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[4],
  },
  headBody: {
    flex: 1,
    gap: theme.space[2],
  },
  lodgingHelper: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  meta: {
    color: theme.color.textOnShell,
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  placeMetaWrap: {
    marginTop: theme.space[2],
  },
  routeChipText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  routeSummary: {
    alignSelf: 'center',
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.pill,
    maxWidth: '100%',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    ...theme.shadow.xs,
  },
  subAction: {
    flex: 1,
  },
  subRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
});
