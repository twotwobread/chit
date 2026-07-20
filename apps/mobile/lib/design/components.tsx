import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { buildCriticalTextLayout, buildResponsiveLineHeight } from './responsive-text';
import { theme } from './theme';

export type CardVariant = 'content' | 'hero' | 'dark' | 'shelf';

const ICON_BUTTON_HIT_SLOP = theme.space[3];

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
};

export function Card({ children, style, variant = 'content' }: CardProps) {
  const variantStyle =
    variant === 'hero'
      ? styles.cardHero
      : variant === 'dark'
        ? styles.cardDark
        : variant === 'shelf'
          ? styles.cardShelf
          : null;

  return <View style={[styles.card, variantStyle, style]}>{children}</View>;
}

export type BrandStampSize = 'sm' | 'md' | 'lg';

const BRAND_STAMP_SIZE: Record<BrandStampSize, { box: number; font: number; radius: number; offset: number }> = {
  sm: { box: 38, font: 18, radius: theme.radius.md, offset: 3 },
  md: { box: 52, font: 25, radius: theme.radius.lg, offset: 4 },
  lg: { box: 70, font: 34, radius: theme.radius.xl, offset: 5 },
};

export function BrandStamp({
  accessibilityLabel = '칫 브랜드 로고',
  decorative = false,
  size = 'md',
  style,
}: {
  accessibilityLabel?: string;
  decorative?: boolean;
  size?: BrandStampSize;
  style?: StyleProp<ViewStyle>;
}) {
  const metrics = BRAND_STAMP_SIZE[size];

  return (
    <View
      accessibilityElementsHidden={decorative}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      accessibilityRole={decorative ? undefined : 'image'}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={[
        styles.brandStampWrap,
        {
          height: metrics.box + metrics.offset,
          width: metrics.box + metrics.offset,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.brandStampOffset,
          {
            borderRadius: metrics.radius,
            height: metrics.box,
            width: metrics.box,
          },
        ]}
      />
      <View
        style={[
          styles.brandStamp,
          {
            borderRadius: metrics.radius,
            height: metrics.box,
            width: metrics.box,
          },
        ]}
      >
        <Text style={[styles.brandStampText, { fontSize: metrics.font }]}>칫</Text>
      </View>
    </View>
  );
}

export function ScreenBackground({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={styles.screenBackground}>
      <View style={[styles.screenContent, style]}>{children}</View>
    </View>
  );
}

export function PrimaryButton({
  accessibilityLabel,
  disabled,
  label,
  loading,
  loadingLabel,
  onPress,
  style,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlH,
    verticalPadding: theme.space[4],
  });
  const isDisabled = disabled || loading;
  const visibleLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? visibleLabel}
      accessibilityRole="button"
      accessibilityState={buildAccessibilityState({ busy: loading, disabled: isDisabled })}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        { minHeight: textLayout.minHeight },
        pressed && !isDisabled ? styles.primaryButtonPressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.color.onActionPrimary} />
          <Text style={[styles.primaryButtonText, { lineHeight: textLayout.lineHeight }]}>{visibleLabel}</Text>
        </View>
      ) : (
        <Text style={[styles.primaryButtonText, { lineHeight: textLayout.lineHeight }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  style,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlH,
    verticalPadding: theme.space[4],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={buildAccessibilityState({ disabled })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { minHeight: textLayout.minHeight },
        pressed && !disabled ? styles.secondaryButtonPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.secondaryButtonText, { lineHeight: textLayout.lineHeight }]}>{label}</Text>
    </Pressable>
  );
}

export type IconButtonVariant = 'plain' | 'soft' | 'onDark';

export function IconButton({
  accessibilityHint,
  accessibilityLabel,
  children,
  disabled,
  onPress,
  selected,
  style,
  variant = 'plain',
}: {
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: IconButtonVariant;
}) {
  const variantStyle =
    variant === 'soft'
      ? styles.iconButtonSoft
      : variant === 'onDark'
        ? styles.iconButtonOnDark
        : styles.iconButtonPlain;
  const pressedStyle = variant === 'onDark' ? styles.iconButtonOnDarkPressed : styles.iconButtonPressed;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={buildAccessibilityState({ disabled, selected })}
      disabled={disabled}
      hitSlop={ICON_BUTTON_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        variantStyle,
        selected ? styles.iconButtonSelected : null,
        pressed && !disabled ? pressedStyle : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export type TextLinkTone = 'info' | 'strong' | 'danger' | 'muted';

export function TextLink({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  label,
  onPress,
  style,
  textStyle,
  tone = 'info',
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: TextLinkTone;
}) {
  const { fontScale } = useWindowDimensions();
  const lineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.label, fontScale });

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="link"
      accessibilityState={buildAccessibilityState({ disabled })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textLinkHitArea,
        pressed && !disabled ? styles.textLinkPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.textLinkText, textLinkToneStyle(tone), { lineHeight }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export type InlineActionTone = 'neutral' | 'primary' | 'danger';

export function InlineAction({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  label,
  leading,
  onPress,
  style,
  tone = 'neutral',
  trailing,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  leading?: ReactNode;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  tone?: InlineActionTone;
  trailing?: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlHSm,
    verticalPadding: theme.space[3],
  });

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={buildAccessibilityState({ disabled })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.inlineAction,
        inlineActionToneStyle(tone),
        { minHeight: textLayout.minHeight },
        pressed && !disabled ? styles.inlineActionPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {leading}
      <Text style={[styles.inlineActionText, inlineActionTextToneStyle(tone), { lineHeight: textLayout.lineHeight }]}>
        {label}
      </Text>
      {trailing}
    </Pressable>
  );
}

export type ActionRowTone = 'default' | 'danger';

export function ActionRow({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  leading,
  meta,
  onPress,
  selected,
  style,
  subtitle,
  title,
  tone = 'default',
  trailing,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  leading?: ReactNode;
  meta?: string;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
  tone?: ActionRowTone;
  trailing?: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const titleLineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.body, fontScale });
  const metaLineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.caption, fontScale });
  const resolvedAccessibilityLabel = accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityRole="button"
      accessibilityState={buildAccessibilityState({ disabled, selected })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        selected ? styles.actionRowSelected : null,
        tone === 'danger' ? styles.actionRowDanger : null,
        pressed && !disabled ? styles.actionRowPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {leading ? <View style={styles.actionRowLeading}>{leading}</View> : null}
      <View style={styles.actionRowBody}>
        <Text
          style={[
            styles.actionRowTitle,
            tone === 'danger' ? styles.actionRowTitleDanger : null,
            { lineHeight: titleLineHeight },
          ]}
        >
          {title}
        </Text>
        {subtitle ? <Text style={[styles.actionRowSubtitle, { lineHeight: metaLineHeight }]}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={[styles.actionRowMeta, { lineHeight: metaLineHeight }]}>{meta}</Text> : null}
      {trailing}
    </Pressable>
  );
}

export type FormFieldTone = 'default' | 'danger';

export function FormField({
  children,
  disabled,
  errorText,
  helperText,
  label,
  required,
  style,
  tone = 'default',
}: {
  children: ReactNode;
  disabled?: boolean;
  errorText?: string;
  helperText?: string;
  label: string;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: FormFieldTone;
}) {
  const { fontScale } = useWindowDimensions();
  const labelLineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.label, fontScale });
  const helperLineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.caption, fontScale });
  const hasError = Boolean(errorText);

  return (
    <View style={[styles.formField, disabled ? styles.disabled : null, style]}>
      <View style={styles.formLabelRow}>
        <Text
          style={[
            styles.formLabel,
            tone === 'danger' || hasError ? styles.formLabelDanger : null,
            { lineHeight: labelLineHeight },
          ]}
        >
          {label}
        </Text>
        {required ? <Text style={[styles.formRequired, { lineHeight: labelLineHeight }]}>필수</Text> : null}
      </View>
      {children}
      {errorText ? (
        <Text accessibilityLiveRegion="polite" style={[styles.formErrorText, { lineHeight: helperLineHeight }]}>
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={[styles.formHelperText, { lineHeight: helperLineHeight }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export type StateAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
};

export function EmptyState({ action, body, title }: { action?: StateAction; body?: string; title: string }) {
  return <StatusStateCard action={action} body={body} title={title} visual={<BrandStamp decorative size="sm" />} />;
}

export function ErrorState({ action, body, title }: { action?: StateAction; body?: string; title: string }) {
  return (
    <StatusStateCard
      action={action}
      body={body}
      title={title}
      tone="danger"
      visual={<View style={styles.statusSignalDanger} />}
    />
  );
}

export function LoadingState({ action, body, title }: { action?: StateAction; body?: string; title: string }) {
  return (
    <StatusStateCard
      action={action}
      body={body}
      title={title}
      visual={<ActivityIndicator color={theme.color.textStrong} />}
    />
  );
}

export type FilterChipTone = 'neutral' | 'accent';

export function FilterChip({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  selected,
  style,
  tone = 'neutral',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: FilterChipTone;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlHSm,
    verticalPadding: theme.space[2],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={buildAccessibilityState({ disabled, selected })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        { minHeight: textLayout.minHeight },
        selected ? filterChipSelectedStyle(tone) : styles.filterChipIdle,
        pressed && !disabled ? styles.filterChipPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected ? styles.filterChipTextSelected : null,
          { lineHeight: textLayout.lineHeight },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export type ChoiceChipTone = 'neutral' | 'accent';

export function ChoiceChip({
  accessibilityLabel,
  disabled,
  label,
  onPress,
  selected,
  style,
  tone = 'neutral',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: ChoiceChipTone;
}) {
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlHSm,
    verticalPadding: theme.space[2],
  });

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      accessibilityState={buildAccessibilityState({ disabled, selected })}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceChip,
        { minHeight: textLayout.minHeight },
        selected ? choiceChipSelectedStyle(tone) : styles.choiceChipIdle,
        pressed && !disabled ? styles.choiceChipPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.choiceChipText,
          selected ? styles.choiceChipTextSelected : null,
          { lineHeight: textLayout.lineHeight },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatusStateCard({
  action,
  body,
  title,
  tone = 'default',
  visual,
}: {
  action?: StateAction;
  body?: string;
  title: string;
  tone?: 'default' | 'danger';
  visual?: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const titleLineHeight = buildResponsiveLineHeight({
    fontSize: theme.font.size.headline,
    fontScale,
    leading: theme.font.leading.snug,
  });
  const bodyLineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.body, fontScale });

  return (
    <View style={[styles.statusCard, tone === 'danger' ? styles.statusCardDanger : null]}>
      {visual ? <View style={styles.statusVisual}>{visual}</View> : null}
      <Text
        style={[
          styles.statusTitle,
          tone === 'danger' ? styles.statusTitleDanger : null,
          { lineHeight: titleLineHeight },
        ]}
      >
        {title}
      </Text>
      {body ? <Text style={[styles.statusBody, { lineHeight: bodyLineHeight }]}>{body}</Text> : null}
      {action ? (
        <View style={styles.statusAction}>
          <SecondaryButton
            accessibilityLabel={action.accessibilityLabel}
            disabled={action.disabled}
            label={action.label}
            onPress={action.onPress}
          />
        </View>
      ) : null}
    </View>
  );
}

function buildAccessibilityState({
  busy,
  disabled,
  selected,
}: {
  busy?: boolean;
  disabled?: boolean;
  selected?: boolean;
}): PressableProps['accessibilityState'] {
  const state: NonNullable<PressableProps['accessibilityState']> = {};

  if (busy !== undefined) {
    state.busy = busy;
  }
  if (disabled !== undefined) {
    state.disabled = disabled;
  }
  if (selected !== undefined) {
    state.selected = selected;
  }

  return state;
}

function textLinkToneStyle(tone: TextLinkTone): StyleProp<TextStyle> {
  if (tone === 'danger') {
    return styles.textLinkTextDanger;
  }
  if (tone === 'muted') {
    return styles.textLinkTextMuted;
  }
  if (tone === 'strong') {
    return styles.textLinkTextStrong;
  }
  return styles.textLinkTextInfo;
}

function inlineActionToneStyle(tone: InlineActionTone): StyleProp<ViewStyle> {
  if (tone === 'primary') {
    return styles.inlineActionPrimary;
  }
  if (tone === 'danger') {
    return styles.inlineActionDanger;
  }
  return styles.inlineActionNeutral;
}

function inlineActionTextToneStyle(tone: InlineActionTone): StyleProp<TextStyle> {
  if (tone === 'primary') {
    return styles.inlineActionTextPrimary;
  }
  if (tone === 'danger') {
    return styles.inlineActionTextDanger;
  }
  return styles.inlineActionTextNeutral;
}

function filterChipSelectedStyle(tone: FilterChipTone): StyleProp<ViewStyle> {
  return tone === 'accent' ? styles.filterChipSelectedAccent : styles.filterChipSelected;
}

function choiceChipSelectedStyle(tone: ChoiceChipTone): StyleProp<ViewStyle> {
  return tone === 'accent' ? styles.choiceChipSelectedAccent : styles.choiceChipSelected;
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    minHeight: theme.layout.controlHLg,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  actionRowBody: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
  actionRowDanger: {
    borderColor: theme.color.red[100],
  },
  actionRowLeading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  actionRowMeta: {
    color: theme.color.textMuted,
    flexShrink: 0,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  actionRowPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderStrong,
  },
  actionRowSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  actionRowSubtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  actionRowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  actionRowTitleDanger: {
    color: theme.color.danger,
  },
  brandStamp: {
    alignItems: 'center',
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.shellRaised,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    transform: [{ rotate: '-3deg' }],
    ...theme.shadow.md,
  },
  brandStampOffset: {
    backgroundColor: theme.color.brandAccent,
    bottom: 0,
    position: 'absolute',
    right: 0,
    transform: [{ rotate: '-3deg' }],
  },
  brandStampText: {
    color: theme.color.brandAccent,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -1,
  },
  brandStampWrap: {
    position: 'relative',
  },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[6],
    width: '100%',
    ...theme.shadow.sm,
  },
  cardDark: {
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.shellRaised,
    ...theme.shadow.md,
  },
  cardHero: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius['2xl'],
    gap: theme.space[5],
    padding: theme.space[7],
    ...theme.shadow.md,
  },
  cardShelf: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderSubtle,
    shadowOpacity: 0,
  },
  choiceChip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2],
  },
  choiceChipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  choiceChipPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.uiAccent,
  },
  choiceChipSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  choiceChipSelectedAccent: {
    backgroundColor: theme.color.uiAccent,
    borderColor: theme.color.uiAccent,
  },
  choiceChipText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  choiceChipTextSelected: {
    color: theme.color.onUiAccent,
  },
  disabled: {
    opacity: 0.5,
  },
  filterChip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2],
  },
  filterChipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  filterChipPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.uiAccent,
  },
  filterChipSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  filterChipSelectedAccent: {
    backgroundColor: theme.color.uiAccent,
    borderColor: theme.color.uiAccent,
  },
  filterChipText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  filterChipTextSelected: {
    color: theme.color.onUiAccent,
  },
  formErrorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  formField: {
    gap: theme.space[3],
    width: '100%',
  },
  formHelperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  formLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  formLabelDanger: {
    color: theme.color.danger,
  },
  formLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  formRequired: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
    paddingHorizontal: theme.space[2],
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  iconButtonOnDark: {
    backgroundColor: theme.color.shellElevated,
    borderColor: theme.color.shellRaised,
    borderWidth: 1,
  },
  iconButtonOnDarkPressed: {
    backgroundColor: theme.color.shellRaised,
  },
  iconButtonPlain: {
    backgroundColor: 'transparent',
  },
  iconButtonPressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  iconButtonSelected: {
    backgroundColor: theme.color.uiAccent,
    borderColor: theme.color.uiAccent,
  },
  iconButtonSoft: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderWidth: 1,
    ...theme.shadow.xs,
  },
  inlineAction: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  inlineActionDanger: {
    backgroundColor: theme.color.red[100],
    borderColor: theme.color.red[100],
  },
  inlineActionNeutral: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  inlineActionPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderStrong,
  },
  inlineActionPrimary: {
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.actionPrimary,
  },
  inlineActionText: {
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  inlineActionTextDanger: {
    color: theme.color.danger,
  },
  inlineActionTextNeutral: {
    color: theme.color.textStrong,
  },
  inlineActionTextPrimary: {
    color: theme.color.onActionPrimary,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    justifyContent: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.actionPrimary,
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  primaryButtonPressed: {
    backgroundColor: theme.color.actionPrimaryPressed,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: theme.color.onActionPrimary,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  screenBackground: {
    backgroundColor: theme.color.bg,
    flex: 1,
    overflow: 'hidden',
  },
  screenContent: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  secondaryButtonPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.shellHighest,
  },
  secondaryButtonText: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  statusAction: {
    alignSelf: 'stretch',
    marginTop: theme.space[2],
  },
  statusBody: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'center',
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[7],
    width: '100%',
    ...theme.shadow.sm,
  },
  statusCardDanger: {
    borderColor: theme.color.red[100],
  },
  statusSignalDanger: {
    backgroundColor: theme.color.danger,
    borderRadius: theme.radius.pill,
    height: theme.space[5],
    width: theme.space[5],
  },
  statusTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  statusTitleDanger: {
    color: theme.color.danger,
  },
  statusVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  textLinkHitArea: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[2],
  },
  textLinkPressed: {
    opacity: 0.68,
  },
  textLinkText: {
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textDecorationLine: 'underline',
  },
  textLinkTextDanger: {
    color: theme.color.danger,
  },
  textLinkTextInfo: {
    color: theme.color.textLink,
  },
  textLinkTextMuted: {
    color: theme.color.textMuted,
  },
  textLinkTextStrong: {
    color: theme.color.textStrong,
  },
});
