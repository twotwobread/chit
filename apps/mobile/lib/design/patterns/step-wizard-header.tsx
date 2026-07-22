import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '../components/card';
import { InlineAction } from '../components/link';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type StepWizardHeaderAction = {
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
};

export type StepWizardHeaderProps = {
  backAction?: StepWizardHeaderAction;
  currentStep: number;
  label: string;
  style?: StyleProp<ViewStyle>;
  totalSteps: number;
};

export function StepWizardHeader({ backAction, currentStep, label, style, totalSteps }: StepWizardHeaderProps) {
  return (
    <Card style={[styles.stepWizardHeader, style]}>
      <View style={styles.stepWizardHeaderTopRow}>
        <View style={styles.stepWizardHeaderTitleGroup}>
          <ResponsiveLabel fontSize={theme.font.size.micro} style={styles.stepWizardHeaderEyebrow}>
            STEP {currentStep} OF {totalSteps}
          </ResponsiveLabel>
          <ResponsiveLabel
            fontSize={theme.font.size.titleLg}
            leading={theme.font.leading.tight}
            style={styles.stepWizardHeaderTitle}
          >
            {label}
          </ResponsiveLabel>
        </View>
        {backAction ? (
          <InlineAction disabled={backAction.disabled} label={backAction.label} onPress={backAction.onPress} />
        ) : null}
      </View>
      <StepProgressSegments activeIndex={currentStep - 1} totalSteps={totalSteps} />
    </Card>
  );
}

function StepProgressSegments({ activeIndex, totalSteps }: { activeIndex: number; totalSteps: number }) {
  const segmentCount = Math.max(1, totalSteps);

  return (
    <View accessibilityLabel={`여행 만들기 ${activeIndex + 1}단계`} style={styles.stepWizardProgressSegments}>
      {Array.from({ length: segmentCount }, (_, index) => (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          key={index}
          style={[
            styles.stepWizardProgressSegment,
            index <= activeIndex ? styles.stepWizardProgressSegmentActive : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stepWizardHeader: {
    backgroundColor: theme.color.surfaceSoft,
    borderRadius: theme.radius.xl,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  stepWizardHeaderEyebrow: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.1,
  },
  stepWizardHeaderTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
  stepWizardHeaderTitleGroup: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
  stepWizardHeaderTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  stepWizardProgressSegment: {
    backgroundColor: theme.color.ink[100],
    borderRadius: theme.radius.pill,
    flex: 1,
    height: 6,
  },
  stepWizardProgressSegmentActive: {
    backgroundColor: theme.color.uiAccent,
  },
  stepWizardProgressSegments: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
});
