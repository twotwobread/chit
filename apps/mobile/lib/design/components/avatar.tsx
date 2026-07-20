import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export function Avatar({
  color = theme.color.primary,
  name,
  ring = theme.color.bg,
  size = 30,
}: {
  name: string;
  color?: string;
  size?: number;
  ring?: string;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: color,
          borderColor: ring,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{avatarInitial(name)}</Text>
    </View>
  );
}

function avatarInitial(name: string): string {
  return name.trim().slice(0, 1) || '?';
}

export function AvatarGroup({
  max,
  members,
  overlap,
  size = 30,
}: {
  members: { name: string; color?: string }[];
  size?: number;
  max?: number;
  overlap?: number;
}) {
  const overflowCount = max != null && max > 0 && members.length > max ? members.length - max + 1 : 0;
  const visibleCount = overflowCount > 0 && max != null ? Math.max(max - 1, 0) : members.length;
  const visibleMembers = members.slice(0, visibleCount);
  const overlapAmount = overlap ?? size * 0.3;

  return (
    <View style={styles.avatarGroup}>
      {visibleMembers.map((member, index) => (
        <View key={`${member.name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -overlapAmount }}>
          <Avatar color={member.color} name={member.name} size={size} />
        </View>
      ))}
      {overflowCount > 0 ? (
        <View style={{ marginLeft: visibleMembers.length === 0 ? 0 : -overlapAmount }}>
          <View style={[styles.avatar, styles.avatarOverflow, { borderRadius: size / 2, height: size, width: size }]}>
            <Text style={[styles.avatarOverflowText, { fontSize: size * 0.34 }]}>+{overflowCount}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
  },
  avatarGroup: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatarOverflow: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.bg,
  },
  avatarOverflowText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  avatarText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
});
