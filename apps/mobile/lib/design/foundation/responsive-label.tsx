import type { ReactNode } from 'react';
import { Text, useWindowDimensions, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { buildResponsiveLineHeight } from '../responsive-text';
import { theme } from '../theme';

export type ResponsiveLabelProps = {
  accessibilityLiveRegion?: TextProps['accessibilityLiveRegion'];
  accessibilityLabel?: string;
  children: ReactNode;
  fontSize?: number;
  leading?: number;
  numberOfLines?: TextProps['numberOfLines'];
  style?: StyleProp<TextStyle>;
};

export function ResponsiveLabel({
  accessibilityLiveRegion,
  accessibilityLabel,
  children,
  fontSize = theme.font.size.body,
  leading,
  numberOfLines,
  style,
}: ResponsiveLabelProps) {
  const { fontScale } = useWindowDimensions();
  const lineHeight = buildResponsiveLineHeight({ fontSize, fontScale, leading });

  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={accessibilityLiveRegion}
      numberOfLines={numberOfLines}
      style={[{ lineHeight }, style]}
    >
      {children}
    </Text>
  );
}
