import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Pencil } from 'lucide-react-native';

import { Avatar, theme } from '../design';

export type AccountProvider = 'apple' | 'kakao';

export type ProfileCardProps = {
  name: string;
  provider?: AccountProvider;
  providerLabel?: string;
  helperLabel?: string | null;
  avatarColor?: string;
  onEdit?: () => void;
};

export type StatRowProps = {
  stats: { value: number | string; label: string }[];
};

export type SettingsListProps = {
  title?: string;
  children: ReactNode;
};

export type SettingRowProps = {
  icon?: ReactNode;
  label: string;
  value?: string;
  affordance?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  first?: boolean;
};

const PROVIDER_META: Record<AccountProvider, { bg: string; fg: string; label: string }> = {
  apple: { bg: theme.providerColor.appleBg, fg: theme.providerColor.appleText, label: 'Apple로 로그인됨' },
  kakao: { bg: theme.providerColor.kakaoBg, fg: theme.providerColor.kakaoText, label: '카카오로 로그인됨' },
};

export function ProfileCard({
  avatarColor = theme.color.primary,
  helperLabel,
  name,
  onEdit,
  provider = 'kakao',
  providerLabel,
}: ProfileCardProps) {
  const providerMeta = PROVIDER_META[provider];

  return (
    <View style={styles.profile}>
      <Avatar color={avatarColor} name={name} size={60} />
      <View style={styles.profileBody}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        {helperLabel ? <Text style={styles.profileHelper}>{helperLabel}</Text> : null}
        <View style={[styles.providerBadge, { backgroundColor: providerMeta.bg }]}>
          <Text style={[styles.providerText, { color: providerMeta.fg }]}>{providerLabel ?? providerMeta.label}</Text>
        </View>
      </View>
      {onEdit ? (
        <Pressable
          accessibilityLabel="이름 수정"
          accessibilityRole="button"
          onPress={onEdit}
          style={({ pressed }) => [styles.editButton, pressed ? styles.pressed : null]}
        >
          <Pencil color={theme.color.textBody} size={17} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatRow({ stats }: StatRowProps) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <View style={styles.statRow}>
      {stats.map((stat) => (
        <View key={`${stat.label}-${stat.value}`} style={styles.statTile}>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function SettingsList({ children, title }: SettingsListProps) {
  return (
    <View style={styles.settingsList}>
      {title ? <Text style={styles.groupLabel}>{title}</Text> : null}
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function SettingRow({
  affordance,
  danger = false,
  disabled = false,
  first = false,
  icon,
  label,
  onPress,
  value,
}: SettingRowProps) {
  const content = (
    <>
      {icon ? <View style={[styles.rowIcon, danger ? styles.rowIconDanger : null]}>{icon}</View> : null}
      <Text style={[styles.rowLabel, danger ? styles.rowLabelDanger : null]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {affordance ? (
        <Text style={[styles.rowAffordance, disabled ? styles.rowValueDisabled : null]}>{affordance}</Text>
      ) : null}
      {onPress && !affordance ? <ChevronRight color={theme.color.textFaint} size={18} strokeWidth={2} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          first ? null : styles.rowDivider,
          pressed ? styles.pressed : null,
          disabled ? styles.rowDisabled : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, first ? null : styles.rowDivider, disabled ? styles.rowDisabled : null]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  editButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    height: theme.layout.tapMin,
    justifyContent: 'center',
    width: theme.layout.tapMin,
  },
  group: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    ...theme.shadow.sm,
  },
  groupLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.space[2],
    marginLeft: theme.space[1],
  },
  name: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
  profile: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[5],
    padding: theme.space[5],
    width: '100%',
    ...theme.shadow.sm,
  },
  profileBody: {
    flex: 1,
    gap: theme.space[2],
  },
  profileHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  providerBadge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  providerText: {
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin + theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  rowAffordance: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rowIconDanger: {
    backgroundColor: theme.color.red[100],
  },
  rowLabel: {
    color: theme.color.textStrong,
    flex: 1,
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  rowLabelDanger: {
    color: theme.color.danger,
  },
  rowValue: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'right',
  },
  rowValueDisabled: {
    color: theme.color.textFaint,
  },
  settingsList: {
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  statLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    marginTop: theme.space[1],
  },
  statRow: {
    flexDirection: 'row',
    gap: theme.space[3],
    width: '100%',
  },
  statTile: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    paddingVertical: theme.space[4],
    ...theme.shadow.xs,
  },
  statValue: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
});
