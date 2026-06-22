import appConfig from '../../app.json';

export const TERMS_URL = 'https://twotwobread.github.io/i-um/terms/';
export const PRIVACY_URL = 'https://twotwobread.github.io/i-um/privacy/';
export const LEGAL_LINK_AFFORDANCE = '열기';
export const LEGAL_LINK_OPEN_ERROR = '링크를 열 수 없어요. 잠시 후 다시 시도해주세요.';

export type LegalLinkId = 'terms' | 'privacy';

export type AppInfoLegalRow =
  | {
      id: 'version';
      label: '앱 버전';
      tappable: false;
      value: string;
    }
  | {
      id: LegalLinkId;
      label: '서비스 이용약관' | '개인정보처리방침';
      tappable: true;
      affordance: typeof LEGAL_LINK_AFFORDANCE;
      url: string;
    };

export type LegalLinkOpenState = {
  openingId: LegalLinkId | null;
  errorMessage: string | null;
};

export type LegalLinkOpenOptions = {
  id: LegalLinkId;
  getState: () => LegalLinkOpenState;
  setState: (state: LegalLinkOpenState) => void;
  opener: (url: string) => Promise<void>;
};

export const initialLegalLinkOpenState: LegalLinkOpenState = {
  openingId: null,
  errorMessage: null,
};

export function appVersion(): string {
  return appConfig.expo.version;
}

export function buildAppInfoLegalRows(): AppInfoLegalRow[] {
  return [
    {
      id: 'version',
      label: '앱 버전',
      tappable: false,
      value: appVersion(),
    },
    {
      id: 'terms',
      label: '서비스 이용약관',
      tappable: true,
      affordance: LEGAL_LINK_AFFORDANCE,
      url: TERMS_URL,
    },
    {
      id: 'privacy',
      label: '개인정보처리방침',
      tappable: true,
      affordance: LEGAL_LINK_AFFORDANCE,
      url: PRIVACY_URL,
    },
  ];
}

export function legalLinkUrl(id: LegalLinkId): string {
  const row = buildAppInfoLegalRows().find((item) => item.id === id);
  if (!row || !row.tappable) {
    throw new Error(`Unsupported legal link: ${id}`);
  }
  return row.url;
}

export async function openLegalLink({ id, getState, setState, opener }: LegalLinkOpenOptions): Promise<LegalLinkOpenState> {
  const currentState = getState();
  if (currentState.openingId === id) {
    return currentState;
  }

  setState({ openingId: id, errorMessage: currentState.errorMessage });

  try {
    await opener(legalLinkUrl(id));
    setState(initialLegalLinkOpenState);
    return initialLegalLinkOpenState;
  } catch {
    const failureState = { openingId: null, errorMessage: LEGAL_LINK_OPEN_ERROR };
    setState(failureState);
    return failureState;
  }
}
