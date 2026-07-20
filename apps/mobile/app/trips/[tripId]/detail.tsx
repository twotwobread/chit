import { ScrollView, Text, View } from 'react-native';

import { EmptyState, ErrorState, ScreenBackground, SkeletonCard } from '../../../lib/design';
import { TripDetailCard } from '../../../lib/trip-ui/TripDetailScreenParts';
import { styles } from '../../../lib/trip-ui/TripDetailScreenStyles';
import { useTripDetailController } from '../../../lib/trip-ui/useTripDetailController';

export default function TripDetailScreen() {
  const { goHome, goLogin, load, state } = useTripDetailController();

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>여행 상세</Text>
        </View>

        {state.status === 'loading' ? <SkeletonCard title="여행 정보를 불러오는 중..." /> : null}

        {state.status === 'success' ? (
          <TripDetailCard
            currentUserId={state.currentUserId}
            detail={state.detail}
            participants={state.participants}
            participantsLoadFailed={state.participantsLoadFailed}
          />
        ) : null}

        {state.status === 'auth' ? (
          <ErrorState
            action={{ label: '로그인하기', onPress: goLogin, variant: 'primary' }}
            title="다시 로그인해주세요."
          />
        ) : null}

        {state.status === 'notFound' ? (
          <EmptyState
            action={{ label: '홈으로', onPress: goHome, variant: 'primary' }}
            body="삭제되었거나 접근할 수 없는 여행이에요."
            title="여행을 찾을 수 없어요."
          />
        ) : null}

        {state.status === 'error' ? (
          <ErrorState
            action={{ label: '다시 시도', onPress: () => void load(), variant: 'primary' }}
            body="잠시 후 다시 시도해주세요."
            title="여행 정보를 불러올 수 없어요."
          />
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}
