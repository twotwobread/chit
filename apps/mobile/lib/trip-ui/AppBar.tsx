import { StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronLeft, House, Ticket } from 'lucide-react-native';
import { router } from 'expo-router';

import { AvatarGroup, IconButton, theme } from '../design';
import { InteractiveSurface } from '../design/foundation/interactive-surface';

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
  const leadingHint = leadingAction === 'home' ? '홈 화면으로 이동합니다.' : '이전 화면으로 이동합니다.';

  return (
    <View style={styles.bar}>
      <IconButton
        accessibilityHint={leadingHint}
        accessibilityLabel={leadingLabel}
        onPress={onBack ?? (() => router.replace('/'))}
        style={styles.side}
        variant="ghostOnDark"
      >
        <LeadingIcon color={theme.color.textOnShell} size={leadingAction === 'home' ? 23 : 26} strokeWidth={2.2} />
      </IconButton>

      {onPressTitle ? (
        <InteractiveSurface
          accessibilityHint="다른 여행으로 전환합니다."
          accessibilityLabel={`${tripName} 여행 전환`}
          accessibilityRole="button"
          minHeight={theme.layout.tapMin}
          onPress={onPressTitle}
          style={({ pressed }) => [styles.titleWrap, pressed ? styles.pressed : null]}
        >
          {titleContent}
        </InteractiveSurface>
      ) : (
        <View style={styles.titleWrap}>{titleContent}</View>
      )}

      <View style={[styles.side, styles.sideEnd]}>
        {onPressTickets ? (
          <IconButton
            accessibilityHint="항공권 목록을 엽니다."
            accessibilityLabel="항공권 보관함 열기"
            onPress={onPressTickets}
            style={styles.ticketButton}
            variant="onDark"
          >
            <Ticket color={theme.color.textOnShell} size={23} strokeWidth={2.2} />
            <Text style={styles.ticketLabel}>항공권</Text>
          </IconButton>
        ) : null}
        {members.length > 0 && onPressMembers ? (
          <IconButton
            accessibilityHint="동행자 목록을 엽니다."
            accessibilityLabel="동행자 보기"
            onPress={onPressMembers}
            style={styles.memberButton}
            variant="ghostOnDark"
          >
            <AvatarGroup members={members} size={27} />
          </IconButton>
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
  memberButton: {
    paddingHorizontal: 0,
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
    borderRadius: theme.radius.md,
    gap: 1,
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
    justifyContent: 'center',
    paddingVertical: theme.space[1],
  },
});
