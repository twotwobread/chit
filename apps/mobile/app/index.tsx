import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchHealth } from '../lib/api/health';

type HealthState =
  | { status: 'loading' }
  | { status: 'success'; apiStatus: string }
  | { status: 'error'; message: string };

export default function HealthScreen() {
  const [healthState, setHealthState] = useState<HealthState>({ status: 'loading' });

  const loadHealth = useCallback(async () => {
    setHealthState({ status: 'loading' });

    try {
      const response = await fetchHealth();
      setHealthState({ status: 'success', apiStatus: response.status });
    } catch (error) {
      setHealthState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown API error',
      });
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이음</Text>
      <Text style={styles.subtitle}>Monorepo walking skeleton</Text>

      {healthState.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator />
          <Text style={styles.message}>API 상태 확인 중...</Text>
        </View>
      ) : null}

      {healthState.status === 'success' ? (
        <View style={styles.card}>
          <Text style={styles.successTitle}>API 연결 성공</Text>
          <Text style={styles.message}>status: {healthState.apiStatus}</Text>
        </View>
      ) : null}

      {healthState.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>API 연결 실패</Text>
          <Text style={styles.message}>{healthState.message}</Text>
          <Pressable accessibilityRole="button" onPress={loadHealth} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#666666',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderColor: '#eeeeee',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  message: {
    color: '#333333',
    textAlign: 'center',
  },
  successTitle: {
    color: '#087f5b',
    fontSize: 20,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#c92a2a',
    fontSize: 20,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#222222',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
