export type LogoutFlow = {
  isLoggingOut: () => boolean;
  run: () => Promise<void>;
};

type LogoutFlowDeps = {
  logoutCurrentSession: () => Promise<void>;
  replace: (path: '/login') => void;
};

export function createLogoutFlow(deps: LogoutFlowDeps): LogoutFlow {
  let inFlight: Promise<void> | null = null;

  return {
    isLoggingOut: () => inFlight !== null,
    run: () => {
      if (inFlight) {
        return inFlight;
      }

      const promise = (async () => {
        await deps.logoutCurrentSession();
        deps.replace('/login');
      })().finally(() => {
        if (inFlight === promise) {
          inFlight = null;
        }
      });

      inFlight = promise;
      return promise;
    },
  };
}
