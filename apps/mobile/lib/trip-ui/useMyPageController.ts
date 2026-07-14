import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import type { AuthMeResponse, GetMySettlementSummaryResponse, TripListItem } from '@i-um/api-contract';

import { initialLegalLinkOpenState, openLegalLink, type LegalLinkId, type LegalLinkOpenState } from '../app-info/legal';
import { getMeWithRefresh, logoutCurrentSession } from '../auth/client';
import { isMobileAuthSessionError } from '../auth/errors';
import { createLogoutFlow, type LogoutFlow } from '../auth/logout-flow';
import { clearStoredSession, readStoredSession } from '../auth/session';
import { getMySettlementSummary } from '../trips/settlement-api';
import { beginStaleWhileRevalidate, resolveStaleWhileRevalidateFailure } from '../trips/stale-refresh';
import { listMyTrips } from '../trips/trip-api';

export type MyPageState =
  | { status: 'loading' }
  | { status: 'ready'; me: AuthMeResponse }
  | { status: 'needsLogin'; message?: string }
  | { status: 'error' };

export type TripListState = { status: 'loading' } | { status: 'ready'; trips: TripListItem[] } | { status: 'error' };

export type SettlementSummaryState =
  | { status: 'loading' }
  | { status: 'ready'; summary: GetMySettlementSummaryResponse }
  | { status: 'error' };

export function useMyPageController() {
  const [state, setState] = useState<MyPageState>({ status: 'loading' });
  const [tripState, setTripState] = useState<TripListState>({ status: 'loading' });
  const [settlementSummaryState, setSettlementSummaryState] = useState<SettlementSummaryState>({ status: 'loading' });
  const [legalLinkState, setLegalLinkState] = useState<LegalLinkOpenState>(initialLegalLinkOpenState);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const legalLinkStateRef = useRef<LegalLinkOpenState>(initialLegalLinkOpenState);
  const logoutFlowRef = useRef<LogoutFlow | null>(null);

  if (logoutFlowRef.current === null) {
    logoutFlowRef.current = createLogoutFlow({
      logoutCurrentSession,
      replace: (path) => router.replace(path),
    });
  }

  const updateLegalLinkState = useCallback((nextState: LegalLinkOpenState) => {
    legalLinkStateRef.current = nextState;
    setLegalLinkState(nextState);
  }, []);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (!isMobileAuthSessionError(error)) {
      return false;
    }

    await clearStoredSession();
    setState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
    return true;
  }, []);

  const loadTrips = useCallback(async () => {
    setTripState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['ready']));

    try {
      const response = await listMyTrips();
      setTripState({ status: 'ready', trips: response.trips });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      const failureState: TripListState = { status: 'error' };
      setTripState((current) =>
        resolveStaleWhileRevalidateFailure(current, failureState, {
          shouldKeepStale: (state) => state.status === 'error',
          staleStatuses: ['ready'],
        }),
      );
    }
  }, [handleAuthError]);

  const loadSettlementSummary = useCallback(async () => {
    setSettlementSummaryState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['ready']));

    try {
      const response = await getMySettlementSummary();
      setSettlementSummaryState({ status: 'ready', summary: response });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      const failureState: SettlementSummaryState = { status: 'error' };
      setSettlementSummaryState((current) =>
        resolveStaleWhileRevalidateFailure(current, failureState, {
          shouldKeepStale: (state) => state.status === 'error',
          staleStatuses: ['ready'],
        }),
      );
    }
  }, [handleAuthError]);

  const load = useCallback(async () => {
    setState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['ready']));
    setTripState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['ready']));
    setSettlementSummaryState((current) => beginStaleWhileRevalidate(current, { status: 'loading' }, ['ready']));
    updateLegalLinkState(initialLegalLinkOpenState);

    try {
      const stored = await readStoredSession();
      if (stored.status === 'missing') {
        setState({ status: 'needsLogin' });
        return;
      }
      if (stored.status === 'corrupt') {
        setState({ status: 'needsLogin', message: '다시 로그인해주세요.' });
        return;
      }

      void loadSettlementSummary();
      void loadTrips();
      const me = await getMeWithRefresh();
      setState({ status: 'ready', me });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      const failureState: MyPageState = { status: 'error' };
      setState((current) =>
        resolveStaleWhileRevalidateFailure(current, failureState, {
          shouldKeepStale: (state) => state.status === 'error',
          staleStatuses: ['ready'],
        }),
      );
    }
  }, [handleAuthError, loadSettlementSummary, loadTrips, updateLegalLinkState]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openLegalLinkRow = useCallback(
    (id: LegalLinkId) => {
      void openLegalLink({
        id,
        getState: () => legalLinkStateRef.current,
        setState: updateLegalLinkState,
        opener: (url) => Linking.openURL(url),
      });
    },
    [updateLegalLinkState],
  );

  const logout = async () => {
    const logoutFlow = logoutFlowRef.current;
    if (!logoutFlow || logoutFlow.isLoggingOut()) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logoutFlow.run();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    isLoggingOut,
    legalLinkState,
    load,
    loadSettlementSummary,
    loadTrips,
    logout,
    openLegalLinkRow,
    settlementSummaryState,
    state,
    tripState,
  };
}
