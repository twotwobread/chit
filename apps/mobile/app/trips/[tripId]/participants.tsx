import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Card, PrimaryButton, ScreenBackground, theme } from '../../../lib/design';
import {
  InviteCard,
  ParticipantListCard,
  RemoveParticipantConfirmationModal,
} from '../../../lib/trip-ui/ParticipantsScreenParts';
import { styles } from '../../../lib/trip-ui/ParticipantsScreenStyles';
import { useParticipantsController } from '../../../lib/trip-ui/useParticipantsController';

export default function TripParticipantsScreen() {
  const {
    cancelRemove,
    confirmRemove,
    copyInvite,
    createInvite,
    goHome,
    goLogin,
    inviteState,
    load,
    removeErrorMessage,
    removeState,
    removingParticipantId,
    requestRemove,
    shareBusy,
    shareFallback,
    shareMessage,
    shareToKakao,
    state,
  } = useParticipantsController();

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>참여자</Text>
        </View>

        {state.status === 'loading' ? (
          <Card>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>참여자를 불러오는 중...</Text>
          </Card>
        ) : null}

        {state.status === 'success' ? (
          <>
            {state.canInvite ? (
              <InviteCard
                inviteState={inviteState}
                onCopy={(inviteUrl) => void copyInvite(inviteUrl)}
                onCreate={() => void createInvite()}
                onFallbackShare={(inviteUrl) => void shareFallback(state.tripName, inviteUrl)}
                onKakaoShare={(inviteUrl) => void shareToKakao(state.tripName, inviteUrl)}
                shareBusy={shareBusy}
                shareMessage={shareMessage}
              />
            ) : null}
            <ParticipantListCard
              onRequestRemove={requestRemove}
              removeErrorMessage={removeErrorMessage}
              removingParticipantId={removingParticipantId}
              viewModel={state.viewModel}
            />
            <RemoveParticipantConfirmationModal
              onCancel={cancelRemove}
              onConfirm={() => void confirmRemove()}
              removeState={removeState}
            />
          </>
        ) : null}

        {state.status === 'auth' ? (
          <Card>
            <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
            <PrimaryButton label="로그인하기" onPress={goLogin} />
          </Card>
        ) : null}

        {state.status === 'invalid' ? (
          <Card>
            <Text style={styles.errorTitle}>잘못된 여행 주소예요.</Text>
            <PrimaryButton label="홈으로" onPress={goHome} />
          </Card>
        ) : null}

        {state.status === 'notFound' ? (
          <Card>
            <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
            <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
            <PrimaryButton label="홈으로" onPress={goHome} />
          </Card>
        ) : null}

        {state.status === 'error' ? (
          <Card>
            <Text style={styles.errorTitle}>참여자 목록을 불러올 수 없어요.</Text>
            <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
            <PrimaryButton label="다시 시도" onPress={() => void load()} />
          </Card>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}
