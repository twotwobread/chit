import type { DestinationSearchResult } from '@i-um/api-contract';

export type PopularDestinationImageKey =
  | 'osaka'
  | 'tokyo'
  | 'fukuoka'
  | 'jeju'
  | 'bangkok'
  | 'taipei'
  | 'danang'
  | 'sapporo'
  | 'okinawa'
  | 'singapore'
  | 'paris'
  | 'seoul';

export type PopularTripDestination = DestinationSearchResult & {
  imageKey: PopularDestinationImageKey;
  keywords: readonly string[];
  nearbySummary: string;
  rank: number;
};

export const popularTripDestinations: readonly PopularTripDestination[] = [
  {
    cityName: '오사카',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '오사카, 일본',
    nearbySummary: '오사카, 교토, 고베, 나라',
    latitude: 34.6937,
    longitude: 135.5023,
    radiusMeters: 50000,
    provider: 'google',
    providerPlaceId: 'google-city-osaka',
    imageKey: 'osaka',
    keywords: ['osaka', '오사까', '간사이', 'kansai', 'japan', '일본'],
    rank: 1,
  },
  {
    cityName: '도쿄',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '도쿄, 일본',
    nearbySummary: '도쿄, 하코네, 요코하마, 가마쿠라',
    latitude: 35.6764,
    longitude: 139.65,
    radiusMeters: 70000,
    provider: 'google',
    providerPlaceId: 'google-city-tokyo',
    imageKey: 'tokyo',
    keywords: ['tokyo', '동경', 'japan', '일본'],
    rank: 2,
  },
  {
    cityName: '후쿠오카',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '후쿠오카, 일본',
    nearbySummary: '후쿠오카, 유후인, 벳푸, 기타큐슈',
    latitude: 33.5902,
    longitude: 130.4017,
    radiusMeters: 45000,
    provider: 'google',
    providerPlaceId: 'google-city-fukuoka',
    imageKey: 'fukuoka',
    keywords: ['fukuoka', '하카타', 'hakata', 'japan', '일본'],
    rank: 3,
  },
  {
    cityName: '제주',
    countryName: '대한민국',
    countryCode: 'KR',
    displayName: '제주, 대한민국',
    nearbySummary: '제주시, 서귀포, 우도, 성산',
    latitude: 33.4996,
    longitude: 126.5312,
    radiusMeters: 80000,
    provider: 'google',
    providerPlaceId: 'google-city-jeju',
    imageKey: 'jeju',
    keywords: ['jeju', '제주도', 'korea', '대한민국', '한국'],
    rank: 4,
  },
  {
    cityName: '방콕',
    countryName: '태국',
    countryCode: 'TH',
    displayName: '방콕, 태국',
    nearbySummary: '방콕, 아유타야, 파타야, 담넌사두억',
    latitude: 13.7563,
    longitude: 100.5018,
    radiusMeters: 65000,
    provider: 'google',
    providerPlaceId: 'google-city-bangkok',
    imageKey: 'bangkok',
    keywords: ['bangkok', 'thai', 'thailand', '태국'],
    rank: 5,
  },
  {
    cityName: '타이베이',
    countryName: '대만',
    countryCode: 'TW',
    displayName: '타이베이, 대만',
    nearbySummary: '타이베이, 지우펀, 단수이, 예류',
    latitude: 25.033,
    longitude: 121.5654,
    radiusMeters: 45000,
    provider: 'google',
    providerPlaceId: 'google-city-taipei',
    imageKey: 'taipei',
    keywords: ['taipei', '타이페이', 'taiwan', '대만'],
    rank: 6,
  },
  {
    cityName: '다낭',
    countryName: '베트남',
    countryCode: 'VN',
    displayName: '다낭, 베트남',
    nearbySummary: '다낭, 호이안, 바나힐, 후에',
    latitude: 16.0544,
    longitude: 108.2022,
    radiusMeters: 50000,
    provider: 'google',
    providerPlaceId: 'google-city-da-nang',
    imageKey: 'danang',
    keywords: ['danang', 'da nang', 'vietnam', '베트남'],
    rank: 7,
  },
  {
    cityName: '삿포로',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '삿포로, 일본',
    nearbySummary: '삿포로, 오타루, 비에이, 후라노',
    latitude: 43.0618,
    longitude: 141.3545,
    radiusMeters: 55000,
    provider: 'google',
    providerPlaceId: 'google-city-sapporo',
    imageKey: 'sapporo',
    keywords: ['sapporo', '홋카이도', 'hokkaido', 'japan', '일본'],
    rank: 8,
  },
  {
    cityName: '오키나와',
    countryName: '일본',
    countryCode: 'JP',
    displayName: '오키나와, 일본',
    nearbySummary: '나하, 차탄, 온나, 츄라우미',
    latitude: 26.2124,
    longitude: 127.6809,
    radiusMeters: 70000,
    provider: 'google',
    providerPlaceId: 'google-city-okinawa',
    imageKey: 'okinawa',
    keywords: ['okinawa', '나하', 'naha', 'japan', '일본'],
    rank: 9,
  },
  {
    cityName: '싱가포르',
    countryName: '싱가포르',
    countryCode: 'SG',
    displayName: '싱가포르, 싱가포르',
    nearbySummary: '마리나베이, 센토사, 차이나타운, 주얼',
    latitude: 1.3521,
    longitude: 103.8198,
    radiusMeters: 45000,
    provider: 'google',
    providerPlaceId: 'google-city-singapore',
    imageKey: 'singapore',
    keywords: ['singapore', '싱가폴'],
    rank: 10,
  },
  {
    cityName: '파리',
    countryName: '프랑스',
    countryCode: 'FR',
    displayName: '파리, 프랑스',
    nearbySummary: '파리, 베르사유, 몽생미셸, 지베르니',
    latitude: 48.8566,
    longitude: 2.3522,
    radiusMeters: 60000,
    provider: 'google',
    providerPlaceId: 'google-city-paris',
    imageKey: 'paris',
    keywords: ['paris', 'france', '프랑스'],
    rank: 11,
  },
  {
    cityName: '서울',
    countryName: '대한민국',
    countryCode: 'KR',
    displayName: '서울, 대한민국',
    nearbySummary: '서울, 인천, 수원, 가평',
    latitude: 37.5665,
    longitude: 126.978,
    radiusMeters: 55000,
    provider: 'google',
    providerPlaceId: 'google-city-seoul',
    imageKey: 'seoul',
    keywords: ['seoul', 'korea', '대한민국', '한국'],
    rank: 12,
  },
] as const;

export const popularTripDestinationSearchResults: readonly DestinationSearchResult[] = popularTripDestinations.map(
  ({ imageKey: _imageKey, keywords: _keywords, nearbySummary: _nearbySummary, rank: _rank, ...destination }) =>
    destination,
);

export function filterPopularTripDestinations(query: string, limit = 8): PopularTripDestination[] {
  const normalizedQuery = normalizeSearchText(query);
  const candidates = normalizedQuery
    ? popularTripDestinations.filter((destination) => matchesPopularDestination(destination, normalizedQuery))
    : popularTripDestinations;

  return candidates.slice(0, limit).map((destination) => ({ ...destination }));
}

function matchesPopularDestination(destination: PopularTripDestination, normalizedQuery: string): boolean {
  return [
    destination.cityName,
    destination.countryName,
    destination.countryCode,
    destination.displayName,
    ...destination.keywords,
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s,.-]+/g, '');
}
