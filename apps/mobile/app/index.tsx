import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchHealthAndReadiness } from '../lib/api/health';

type DiagnosticState =
  | { status: 'loading' }
  | { status: 'success'; apiStatus: string; dbStatus: string; schema: string }
  | { status: 'error' };

export default function HealthScreen() {
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>({ status: 'loading' });

  const loadDiagnostics = useCallback(async () => {
    setDiagnosticState({ status: 'loading' });

    try {
      const response = await fetchHealthAndReadiness();
      setDiagnosticState({
        status: 'success',
        apiStatus: response.health.status,
        dbStatus: response.readiness.checks.database.status,
        schema: response.readiness.checks.metadata.schema,
      });
    } catch {
      setDiagnosticState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이음</Text>
      <Text style={styles.subtitle}>Monorepo DB readiness</Text>

      {diagnosticState.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator />
          <Text style={styles.message}>API 및 DB 상태 확인 중...</Text>
        </View>
      ) : null}

      {diagnosticState.status === 'success' ? (
        <View style={styles.card}>
          <Text style={styles.successTitle}>API 연결 성공</Text>
          <Text style={styles.message}>status: {diagnosticState.apiStatus}</Text>
          <Text style={styles.successTitle}>DB 연결 성공</Text>
          <Text style={styles.message}>database: {diagnosticState.dbStatus}</Text>
          <Text style={styles.message}>schema: {diagnosticState.schema}</Text>
        </View>
      ) : null}

      {diagnosticState.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>API 또는 DB 연결 실패</Text>
          <Pressable accessibilityRole="button" onPress={loadDiagnostics} style={styles.button}>
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
