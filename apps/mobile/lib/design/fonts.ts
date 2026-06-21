import { useFonts } from 'expo-font';

import { font } from './theme';

export function useDesignFonts() {
  return useFonts({
    [font.family.regular]: require('../../assets/fonts/Pretendard-Regular.otf'),
    [font.family.semibold]: require('../../assets/fonts/Pretendard-SemiBold.otf'),
    [font.family.bold]: require('../../assets/fonts/Pretendard-Bold.otf'),
  });
}
