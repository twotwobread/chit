import type { TripDestinationInput } from '@i-um/api-contract';

export const createTripWizardSteps = ['destinations', 'dates', 'settings', 'review'] as const;

export type CreateTripWizardStep = (typeof createTripWizardSteps)[number];

export function nextCreateTripWizardStep(step: CreateTripWizardStep): CreateTripWizardStep {
  const index = createTripWizardSteps.indexOf(step);
  return createTripWizardSteps[Math.min(index + 1, createTripWizardSteps.length - 1)] ?? 'review';
}

export function previousCreateTripWizardStep(step: CreateTripWizardStep): CreateTripWizardStep {
  const index = createTripWizardSteps.indexOf(step);
  return createTripWizardSteps[Math.max(index - 1, 0)] ?? 'destinations';
}

export function suggestTripName(
  destinations: readonly TripDestinationInput[],
  startDate: string,
  endDate: string,
): string {
  const destinationLabel = destinationNameLabel(destinations);
  const durationLabel = tripDurationLabel(startDate, endDate);

  if (destinationLabel && durationLabel) {
    return `${destinationLabel} ${durationLabel}`;
  }
  if (destinationLabel) {
    return `${destinationLabel} 여행`;
  }
  return '새 여행';
}

export function applySuggestedTripName(currentName: string, suggestedName: string, manuallyEdited: boolean): string {
  if (manuallyEdited) {
    return currentName;
  }
  return suggestedName;
}

function destinationNameLabel(destinations: readonly TripDestinationInput[]): string {
  const names = destinations
    .map((destination) => destination.cityName.trim() || destination.displayName.split(',')[0]?.trim() || '')
    .filter(Boolean);
  if (names.length === 0) {
    return '';
  }
  return names.slice(0, 2).join('·');
}

function tripDurationLabel(startDate: string, endDate: string): string {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || end < start) {
    return '';
  }

  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount <= 1) {
    return '당일치기';
  }
  return `${dayCount - 1}박 ${dayCount}일`;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
