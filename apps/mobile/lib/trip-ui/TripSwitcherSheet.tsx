import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, MapPin, Plus, X } from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, theme } from '../design';

export type SwitchableTrip = {
  id: string;
  name: string;
  dates: string;
  color?: string;
  current?: boolean;
};

export type TripSwitcherSheetProps = {
  visible: boolean;
  trips: SwitchableTrip[];
  onClose: () => void;
  hrefForTrip?: (id: string) => Href;
  onPressCreateTrip?: () => void;
};

const defaultHrefForTrip = (id: string): Href => `/trips/${id}/today` as Href;

export function TripSwitcherSheet({
  hrefForTrip = defaultHrefForTrip,
  onClose,
  onPressCreateTrip,
  trips,
  visible,
}: TripSwitcherSheetProps) {
  const insets = useSafeAreaInsets();

  const handleCreateTrip = () => {
    onClose();
    if (onPressCreateTrip) {
      onPressCreateTrip();
      return;
    }
    router.push('/trips/new');
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { paddingTop: insets.top + theme.space[5] }]}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>여행 전환</Text>
            <Pressable
              accessibilityLabel="닫기"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <X color={theme.color.textMuted} size={19} strokeWidth={2.2} />
            </Pressable>
          </View>

          {trips.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>전환할 여행이 없어요</Text>
              <Text style={styles.emptyBody}>새 여행을 만들면 이곳에서 바로 전환할 수 있어요.</Text>
            </View>
          ) : (
            trips.map((trip) => {
              const current = trip.current === true;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  key={trip.id}
                  onPress={() => {
                    if (current) {
                      onClose();
                      return;
                    }
                    onClose();
                    router.replace(hrefForTrip(trip.id));
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    current ? styles.rowCurrent : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: trip.color ?? theme.color.primary }]}>
                    <MapPin color={theme.color.onPrimary} size={20} strokeWidth={2} />
                  </View>
                  <View style={styles.body}>
                    <View style={styles.nameRow}>
                      <Text numberOfLines={1} style={styles.name}>
                        {trip.name}
                      </Text>
                      {current ? <Badge label="진행 중" solid tone="primary" /> : null}
                    </View>
                    <Text style={styles.dates}>{trip.dates}</Text>
                  </View>
                  {current ? <Check color={theme.color.primary} size={20} strokeWidth={2.6} /> : null}
                </Pressable>
              );
            })
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleCreateTrip}
            style={({ pressed }) => [styles.newRow, pressed ? styles.pressed : null]}
          >
            <View style={[styles.icon, styles.newIcon]}>
              <Plus color={theme.color.textMuted} size={20} strokeWidth={2.4} />
            </View>
            <Text style={styles.newText}>새 여행 만들기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  dates: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    marginTop: 2,
  },
  emptyBody: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.lg,
    gap: theme.space[2],
    marginBottom: theme.space[3],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[6],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  eyebrow: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: theme.space[4],
    paddingHorizontal: theme.space[2],
  },
  icon: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  name: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  newIcon: {
    backgroundColor: theme.color.surfaceSunken,
  },
  newRow: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md + 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    marginTop: theme.space[2],
    minHeight: theme.layout.tapMin,
    padding: theme.space[3] + 1,
  },
  newText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
  root: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderRadius: theme.radius.md + 2,
    flexDirection: 'row',
    gap: theme.space[4],
    marginBottom: theme.space[1] + 1,
    minHeight: theme.layout.tapMin,
    padding: theme.space[3] + 1,
  },
  rowCurrent: {
    backgroundColor: theme.color.primarySoft,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.ink[900],
    opacity: 0.42,
  },
  sheet: {
    backgroundColor: theme.color.surface,
    borderBottomLeftRadius: theme.radius['2xl'],
    borderBottomRightRadius: theme.radius['2xl'],
    left: 0,
    paddingBottom: theme.space[5],
    paddingHorizontal: theme.space[4],
    position: 'absolute',
    right: 0,
    top: 0,
    ...theme.shadow.lg,
  },
});
