import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

import { toKakaoInviteRedirectPath } from '../lib/trips/invite';

const kakaoCallbackFallbackPath = '/' as Href;

export default function KakaoLinkRedirectScreen() {
  const params = useLocalSearchParams<{ inviteToken?: string | string[] }>();
  const href = (toKakaoInviteRedirectPath(params) ?? kakaoCallbackFallbackPath) as Href;

  return <Redirect href={href} />;
}
