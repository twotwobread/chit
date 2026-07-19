import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronLeft, House, Ticket } from 'lucide-react-native';
import { router } from 'expo-router';

import { AvatarGroup, theme } from '../design';

export type AppBarMember = { name: string; color?: string };

export type AppBarProps = {
  tripName: string;
  caption?: string;
  leadingAction?: 'back' | 'home';
  members?: AppBarMember[];
  onPressMembers?: () => void;
  onPressTickets?: () => void;
  onPressTitle?: () => void;
  onBack?: () => void;
};

export function AppBar({
  caption,
  leadingAction = 'back',
  members = [],
  onBack,
  onPressMembers,
  onPressTickets,
  onPressTitle,
  tripName,
}: AppBarProps) {
  const titleContent = (
    <>
      <View style={styles.titleRow}>
        <Text numberOfLines={1} style={styles.title}>
          {tripName}
        </Text>
        {onPressTitle ? <ChevronDown color={theme.color.textOnShellMuted} size={17} strokeWidth={2.4} /> : null}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </>
  );

  const LeadingIcon = leadingAction === 'home' ? House : ChevronLeft;
  const leadingLabel = leadingAction === 'home' ? '홈으로' : '뒤로가기';

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel={leadingLabel}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack ?? (() => router.replace('/'))}
        style={({ pressed }) => [styles.side, pressed ? styles.pressed : null]}
      >
        <LeadingIcon color={theme.color.textOnShell} size={leadingAction === 'home' ? 23 : 26} strokeWidth={2.2} />
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
        {onPressTickets ? (
          <Pressable
            accessibilityLabel="항공권 보관함 열기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPressTickets}
            style={({ pressed }) => [styles.ticketButton, pressed ? styles.pressed : null]}
          >
            <Ticket color={theme.color.textOnShell} size={23} strokeWidth={2.2} />
            <Text style={styles.ticketLabel}>항공권</Text>
          </Pressable>
        ) : null}
        {members.length > 0 && onPressMembers ? (
          <Pressable
            accessibilityLabel="동행자 보기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPressMembers}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <AvatarGroup members={members} size={27} />
          </Pressable>
        ) : members.length > 0 ? (
          <AvatarGroup members={members} size={27} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: theme.color.shell,
    borderBottomColor: theme.color.shellRaised,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    minHeight: theme.layout.headerH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  caption: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  pressed: {
    opacity: 0.7,
  },
  side: {
    height: theme.layout.tapMin,
    justifyContent: 'center',
    width: 54,
  },
  sideEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'flex-end',
    width: 118,
  },
  ticketButton: {
    alignItems: 'center',
    backgroundColor: theme.color.shellElevated,
    borderColor: theme.color.shellRaised,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 1,
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
    paddingHorizontal: theme.space[2],
  },
  ticketLabel: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  title: {
    color: theme.color.textOnShell,
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
