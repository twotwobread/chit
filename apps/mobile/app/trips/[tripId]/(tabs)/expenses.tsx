import { TripScreen, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';

export default function TripExpensesTabScreen() {
  return (
    <TripScreen>
      <TripStateCard helper="지출 요약과 등록 흐름을 준비하고 있어요." title="지출을 불러오는 중..." />
    </TripScreen>
  );
}
