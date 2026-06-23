import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
const usesRealProviderAuth = process.env.EXPO_PUBLIC_AUTH_DEV_MODE !== 'true';
const isPreviewBuild = process.env.EAS_BUILD_PROFILE === 'preview';

if (isPreviewBuild && usesRealProviderAuth && !kakaoNativeAppKey) {
  throw new Error('EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is required for EAS preview Kakao native login builds.');
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = appJson.expo as ExpoConfig;
  const iosConfig = baseConfig.ios ?? {};
  const kakaoPlugin: NonNullable<ExpoConfig['plugins']> = kakaoNativeAppKey
    ? [['@react-native-seoul/kakao-login', { kakaoAppKey: kakaoNativeAppKey }]]
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
      infoPlist: {
        ...iosConfig.infoPlist,
        ...(kakaoNativeAppKey ? { KAKAO_APP_SCHEME: `kakao${kakaoNativeAppKey}` } : {}),
      },
    },
  };
};
