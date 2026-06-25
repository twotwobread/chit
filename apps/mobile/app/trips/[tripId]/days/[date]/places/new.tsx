import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { theme } from '../../../../../../lib/design';
import { buildDayItineraryRoute } from '../../../../../../lib/trips/day-itinerary';
import { buildGooglePlaceSearchRoute } from '../../../../../../lib/places/google-search';

export default function NewManualPlaceScreen() {
  const { tripId: tripIdParam, date: dateParam } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;

  const goToSearch = () => {
    if (tripId && date) {
      router.replace(buildGooglePlaceSearchRoute(tripId, date));
      return;
    }
    router.replace('/');
  };

  const backToDay = () => {
    if (tripId && date) {
      router.replace(buildDayItineraryRoute(tripId, date));
      return;
    }
    router.replace('/');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Google 장소 검색을 사용해주세요.</Text>
        <Text style={styles.message}>
          경로 미리보기와 지도 기능을 정확하게 제공하기 위해 새 일정 장소는 Google 장소로 추가합니다.
        </Text>
        <Pressable accessibilityRole="button" onPress={goToSearch} style={styles.button}>
          <Text style={styles.buttonText}>장소 검색으로 이동</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={backToDay} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>오늘 일정으로 돌아가기</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
  content: {
    gap: theme.space[6],
    padding: theme.space[6],
  },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[5],
    shadowColor: theme.shadow.md.shadowColor,
    shadowOffset: theme.shadow.md.shadowOffset,
    shadowOpacity: theme.shadow.md.shadowOpacity,
    shadowRadius: theme.shadow.md.shadowRadius,
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
});
