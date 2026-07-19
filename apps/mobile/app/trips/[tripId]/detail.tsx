import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Card, PrimaryButton, theme } from '../../../lib/design';
import { TripDetailCard } from '../../../lib/trip-ui/TripDetailScreenParts';
import { styles } from '../../../lib/trip-ui/TripDetailScreenStyles';
import { useTripDetailController } from '../../../lib/trip-ui/useTripDetailController';

export default function TripDetailScreen() {
  const { goHome, goLogin, load, state } = useTripDetailController();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>여행 상세</Text>
      </View>

      {state.status === 'loading' ? (
        <Card style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>여행 정보를 불러오는 중...</Text>
        </Card>
      ) : null}

      {state.status === 'success' ? (
        <TripDetailCard
          currentUserId={state.currentUserId}
          detail={state.detail}
          participants={state.participants}
          participantsLoadFailed={state.participantsLoadFailed}
        />
      ) : null}

      {state.status === 'auth' ? (
        <Card style={styles.card}>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <PrimaryButton label="로그인하기" onPress={goLogin} />
        </Card>
      ) : null}

      {state.status === 'notFound' ? (
        <Card style={styles.card}>
          <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
          <PrimaryButton label="홈으로" onPress={goHome} />
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <Card style={styles.card}>
          <Text style={styles.errorTitle}>여행 정보를 불러올 수 없어요.</Text>
          <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
          <PrimaryButton label="다시 시도" onPress={() => void load()} />
        </Card>
      ) : null}
    </ScrollView>
  );
}
