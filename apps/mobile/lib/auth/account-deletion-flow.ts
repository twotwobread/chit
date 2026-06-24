import { MobileAuthError } from './client';

export const ACCOUNT_DELETION_COPY = {
  sectionTitle: '계정 삭제',
  cta: '계정 삭제',
  confirmationTitle: '계정을 삭제할까요?',
  confirmationBody:
    '계정을 삭제하면 로그인 정보와 프로필이 삭제돼요.\n혼자 만든 여행은 함께 삭제돼요.\n함께 쓰던 여행은 유지되고 내 정보는 탈퇴한 사용자로 표시돼요.\n내가 만든 초대 링크는 비활성화돼요.\n같은 Apple 또는 Kakao로 다시 로그인해도 새 계정으로 시작돼요.\n이 작업은 되돌릴 수 없어요.',
  cancel: '취소',
  confirm: '삭제하기',
  deleting: '계정을 삭제하는 중...',
  authError: '다시 로그인해주세요.',
  retryableError: '지금은 계정을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.',
} as const;

export type AccountDeletionStatus = 'idle' | 'confirming' | 'deleting';

export type AccountDeletionResult =
  | { status: 'success' }
  | { status: 'authError'; message: string }
  | { status: 'retryableError'; message: string };

export type AccountDeletionFlow = {
  getStatus: () => AccountDeletionStatus;
  isDeleting: () => boolean;
  requestConfirmation: () => AccountDeletionStatus;
  cancelConfirmation: () => AccountDeletionStatus;
  confirmDeletion: () => Promise<AccountDeletionResult>;
};

type AccountDeletionFlowDeps = {
  deleteAccount: () => Promise<void>;
  replace: (path: '/login') => void;
};

export function createAccountDeletionFlow(deps: AccountDeletionFlowDeps): AccountDeletionFlow {
  let status: AccountDeletionStatus = 'idle';
  let inFlight: Promise<AccountDeletionResult> | null = null;

  return {
    getStatus: () => status,
    isDeleting: () => inFlight !== null,
    requestConfirmation: () => {
      if (status !== 'deleting') {
        status = 'confirming';
      }
      return status;
    },
    cancelConfirmation: () => {
      if (status === 'confirming') {
        status = 'idle';
      }
      return status;
    },
    confirmDeletion: () => {
      if (inFlight) {
        return inFlight;
      }

      status = 'deleting';
      const promise = (async (): Promise<AccountDeletionResult> => {
        try {
          await deps.deleteAccount();
          status = 'idle';
          deps.replace('/login');
          return { status: 'success' };
        } catch (error) {
          status = 'confirming';
          if (isAuthFailure(error)) {
            return { status: 'authError', message: ACCOUNT_DELETION_COPY.authError };
          }
          return { status: 'retryableError', message: ACCOUNT_DELETION_COPY.retryableError };
        }
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

function isAuthFailure(error: unknown): boolean {
  if (error instanceof MobileAuthError) {
    return error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN';
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return code === 'UNAUTHORIZED' || code === 'INVALID_REFRESH_TOKEN';
  }
  return false;
}
