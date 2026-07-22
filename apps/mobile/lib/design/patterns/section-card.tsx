import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '../components/card';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type SectionCardTone = 'surface' | 'sunken' | 'notice' | 'danger';

export type SectionCardProps = {
  children: ReactNode;
  footer?: ReactNode;
  helper?: string;
  meta?: string;
  style?: StyleProp<ViewStyle>;
  title?: string;
  tone?: SectionCardTone;
};

export function SectionCard({ children, footer, helper, meta, style, title, tone = 'surface' }: SectionCardProps) {
  const hasHeader = Boolean(title || meta || helper);

  return (
    <Card style={[styles.sectionCard, sectionCardToneStyle(tone), style]}>
      {hasHeader ? (
        <View style={styles.sectionCardHeader}>
          <View style={styles.sectionCardTitleGroup}>
            {title ? (
              <ResponsiveLabel fontSize={theme.font.size.label} style={styles.sectionCardTitle}>
                {title}
              </ResponsiveLabel>
            ) : null}
            {helper ? (
              <ResponsiveLabel fontSize={theme.font.size.caption} style={styles.sectionCardHelper}>
                {helper}
              </ResponsiveLabel>
            ) : null}
          </View>
          {meta ? (
            <ResponsiveLabel fontSize={theme.font.size.caption} style={styles.sectionCardMeta}>
              {meta}
            </ResponsiveLabel>
          ) : null}
        </View>
      ) : null}
      {children}
      {footer ? <View style={styles.sectionCardFooter}>{footer}</View> : null}
    </Card>
  );
}

function sectionCardToneStyle(tone: SectionCardTone): StyleProp<ViewStyle> {
  if (tone === 'sunken') return styles.sectionCardSunken;
  if (tone === 'notice') return styles.sectionCardNotice;
  if (tone === 'danger') return styles.sectionCardDanger;
  return null;
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: theme.radius.xl,
    gap: theme.space[4],
    padding: theme.space[4],
  },
  sectionCardDanger: {
    backgroundColor: theme.color.red[100],
    borderColor: theme.color.danger,
  },
  sectionCardFooter: {
    gap: theme.space[3],
  },
  sectionCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  sectionCardHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  sectionCardMeta: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  sectionCardNotice: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
  },
  sectionCardSunken: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
  },
  sectionCardTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  sectionCardTitleGroup: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
});
