import { forwardRef, type ComponentType, type RefAttributes } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildKeyboardAwareFormScrollConfig,
  type KeyboardAwareFormScrollConfigInput,
} from './keyboard-aware-form-layout';

type NativeKeyboardAwareScrollViewProps = ScrollViewProps & {
  bottomOffset?: number;
  disableScrollOnKeyboardHide?: boolean;
  enabled?: boolean;
  extraKeyboardSpace?: number;
  mode?: 'insets' | 'layout';
  ScrollViewComponent?: unknown;
};

type KeyboardControllerModule = {
  KeyboardAwareScrollView?: ComponentType<NativeKeyboardAwareScrollViewProps & RefAttributes<ScrollView>>;
};

export type KeyboardAwareFormScrollViewProps = ScrollViewProps & {
  keyboardExtraBottomSpacing?: KeyboardAwareFormScrollConfigInput['extraBottomSpacing'];
  keyboardFixedBottomOffset?: KeyboardAwareFormScrollConfigInput['fixedBottomOffset'];
  keyboardMinClearance?: KeyboardAwareFormScrollConfigInput['minClearance'];
};

const FallbackKeyboardAwareScrollView = forwardRef<ScrollView, NativeKeyboardAwareScrollViewProps>(
  (
    {
      bottomOffset: _bottomOffset,
      disableScrollOnKeyboardHide: _disableScrollOnKeyboardHide,
      enabled: _enabled,
      extraKeyboardSpace: _extraKeyboardSpace,
      mode: _mode,
      ScrollViewComponent: _ScrollViewComponent,
      ...scrollProps
    },
    ref,
  ) => <ScrollView ref={ref} {...scrollProps} />,
);
FallbackKeyboardAwareScrollView.displayName = 'FallbackKeyboardAwareScrollView';

function resolveKeyboardAwareScrollView(): ComponentType<
  NativeKeyboardAwareScrollViewProps & RefAttributes<ScrollView>
> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native module is absent in Expo Go; fallback keeps forms usable there.
    const keyboardController = require('react-native-keyboard-controller') as KeyboardControllerModule;
    return keyboardController.KeyboardAwareScrollView ?? FallbackKeyboardAwareScrollView;
  } catch {
    return FallbackKeyboardAwareScrollView;
  }
}

const ResolvedKeyboardAwareScrollView = resolveKeyboardAwareScrollView();

export const KeyboardAwareFormScrollView = forwardRef<ScrollView, KeyboardAwareFormScrollViewProps>(
  (
    {
      contentContainerStyle,
      keyboardDismissMode = 'interactive',
      keyboardExtraBottomSpacing,
      keyboardFixedBottomOffset,
      keyboardMinClearance,
      keyboardShouldPersistTaps = 'handled',
      ...scrollProps
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const keyboardConfig = buildKeyboardAwareFormScrollConfig({
      bottomSafeArea: insets.bottom,
      extraBottomSpacing: keyboardExtraBottomSpacing,
      fixedBottomOffset: keyboardFixedBottomOffset,
      minClearance: keyboardMinClearance,
    });

    return (
      <ResolvedKeyboardAwareScrollView
        bottomOffset={keyboardConfig.keyboardBottomOffset}
        contentContainerStyle={[contentContainerStyle, { paddingBottom: keyboardConfig.contentPaddingBottom }]}
        disableScrollOnKeyboardHide
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        mode="insets"
        ref={ref}
        {...scrollProps}
      />
    );
  },
);
KeyboardAwareFormScrollView.displayName = 'KeyboardAwareFormScrollView';
