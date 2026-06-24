import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
const inviteLinkHost = process.env.EXPO_PUBLIC_INVITE_LINK_HOST?.trim() || 'invite.i-um.app';
const usesRealProviderAuth = process.env.EXPO_PUBLIC_AUTH_DEV_MODE !== 'true';
const isPreviewBuild = process.env.EAS_BUILD_PROFILE === 'preview';

if (isPreviewBuild && usesRealProviderAuth && !kakaoNativeAppKey) {
  throw new Error('EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is required for EAS preview Kakao native login builds.');
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = appJson.expo as ExpoConfig;
  const iosConfig = baseConfig.ios ?? {};
  const androidConfig = baseConfig.android ?? {};
  const kakaoPlugin: NonNullable<ExpoConfig['plugins']> = kakaoNativeAppKey
    ? [['@react-native-seoul/kakao-login', { kakaoAppKey: kakaoNativeAppKey, overrideKakaoSDKVersion: '2.22.0' }]]
    : [];
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    'expo-router',
    'expo-secure-store',
    ...kakaoPlugin,
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Pretendard-Regular.otf',
          './assets/fonts/Pretendard-SemiBold.otf',
          './assets/fonts/Pretendard-Bold.otf',
        ],
      },
    ],
  ];

  return {
    ...config,
    ...baseConfig,
    plugins,
    ios: {
      ...iosConfig,
      associatedDomains: unique([...(iosConfig.associatedDomains ?? []), `applinks:${inviteLinkHost}`]),
      infoPlist: {
        ...iosConfig.infoPlist,
        ...(kakaoNativeAppKey ? { KAKAO_APP_SCHEME: `kakao${kakaoNativeAppKey}` } : {}),
      },
    },
    android: {
      ...androidConfig,
      intentFilters: [
        ...(androidConfig.intentFilters ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: inviteLinkHost, pathPrefix: '/invite' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
