import type { FlightPassenger, TripParticipantListItem } from '@i-um/api-contract';

export type AddableFlightPassengerOption = {
  participantId: string;
  displayName: string;
  selected: boolean;
};

export function buildAddableFlightPassengerOptions({
  participants,
  passengers,
  selectedPassengerIds,
}: {
  participants: TripParticipantListItem[];
  passengers: FlightPassenger[];
  selectedPassengerIds: string[];
}): AddableFlightPassengerOption[] {
  const existingPassengerIds = new Set(passengers.map((passenger) => passenger.participantId));
  const selectedIds = new Set(selectedPassengerIds);
  return participants
    .filter((participant) => !existingPassengerIds.has(participant.participantId))
    .map((participant) => ({
      participantId: participant.participantId,
      displayName: participant.displayName.trim() || '이름 없는 참여자',
      selected: selectedIds.has(participant.participantId),
    }));
}

export function toggleFlightPassengerSelection(selectedPassengerIds: string[], participantId: string): string[] {
  if (selectedPassengerIds.includes(participantId)) {
    return selectedPassengerIds.filter((id) => id !== participantId);
  }
  return [...selectedPassengerIds, participantId];
}

export function validateAddFlightPassengers(selectedPassengerIds: string[]): string | null {
  return selectedPassengerIds.length > 0 ? null : '추가할 탑승자를 1명 이상 선택해주세요.';
}

export function canSubmitAddFlightPassengers(selectedPassengerIds: string[], saving: boolean): boolean {
  return !saving && validateAddFlightPassengers(selectedPassengerIds) === null;
}
