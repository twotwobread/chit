import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';

import { AvatarGroup, theme } from '../design';

export type AppBarMember = { name: string; color?: string };

export type AppBarProps = {
  tripName: string;
  caption?: string;
  members?: AppBarMember[];
  onPressTitle?: () => void;
  onBack?: () => void;
};

export function AppBar({ caption, members = [], onBack, onPressTitle, tripName }: AppBarProps) {
  const titleContent = (
    <>
      <View style={styles.titleRow}>
        <Text numberOfLines={1} style={styles.title}>
          {tripName}
        </Text>
        {onPressTitle ? <ChevronDown color={theme.color.textMuted} size={17} strokeWidth={2.4} /> : null}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </>
  );

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel="홈으로"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack ?? (() => router.replace('/'))}
        style={({ pressed }) => [styles.side, pressed ? styles.pressed : null]}
      >
        <ChevronLeft color={theme.color.textBody} size={26} strokeWidth={2.2} />
      </Pressable>

      {onPressTitle ? (
        <Pressable
          accessibilityLabel={`${tripName} 여행 전환`}
          accessibilityRole="button"
          onPress={onPressTitle}
          style={({ pressed }) => [styles.titleWrap, pressed ? styles.pressed : null]}
        >
          {titleContent}
        </Pressable>
      ) : (
        <View style={styles.titleWrap}>{titleContent}</View>
      )}

      <View style={[styles.side, styles.sideEnd]}>
        {members.length > 0 ? <AvatarGroup members={members} size={27} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: theme.color.bg,
    flexDirection: 'row',
    gap: theme.space[2],
    minHeight: theme.layout.headerH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  caption: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  pressed: {
    opacity: 0.7,
  },
  side: {
    height: 44,
    justifyContent: 'center',
    width: 54,
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.2,
    maxWidth: 220,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  titleWrap: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    paddingVertical: theme.space[1],
  },
});
