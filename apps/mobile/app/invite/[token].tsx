import { ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Card, PrimaryButton, theme } from '../../lib/design';
import { invitePlaceholderMessage } from '../../lib/trips/invite';

export default function InvitePlaceholderScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <Card>
        <Text style={styles.title}>초대 링크</Text>
        <Text style={styles.message}>{invitePlaceholderMessage}</Text>
        {token ? <Text style={styles.token}>초대 코드: {token}</Text> : null}
        <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  token: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
});
