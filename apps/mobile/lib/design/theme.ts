const green = {
  50: '#e7f7f0',
  100: '#c4ecdc',
  200: '#93ddc1',
  300: '#57c9a3',
  400: '#23b187',
  500: '#0e9c72',
  600: '#098563',
  700: '#086e53',
  800: '#0a5743',
  900: '#0a4537',
} as const;

const amber = {
  50: '#fff6e6',
  100: '#ffe8bf',
  200: '#ffd485',
  300: '#ffbe4d',
  400: '#fba91c',
  500: '#f08c00',
  600: '#d97606',
  700: '#b65d07',
} as const;

const ink = {
  0: '#ffffff',
  25: '#fafaf7',
  50: '#f4f4ef',
  100: '#e9e9e2',
  200: '#d8d8cf',
  300: '#bfbfb4',
  400: '#9a9a8e',
  500: '#74746a',
  600: '#56564e',
  700: '#3c3c36',
  800: '#2a2a26',
  900: '#1a1a17',
} as const;

const red = { 100: '#ffe3e3', 500: '#fa5252', 600: '#e03131' } as const;
const blue = { 100: '#d7e7ff', 500: '#3b82f6', 600: '#2563eb' } as const;
const yellow = { 100: '#fff3bf', 500: '#f7b500' } as const;

export const color = {
  green,
  amber,
  ink,
  red,
  blue,
  yellow,

  primary: green[600],
  primaryHover: green[700],
  primaryPressed: green[800],
  primarySoft: green[50],
  onPrimary: ink[0],
  accent: amber[500],
  accentSoft: amber[50],

  bg: ink[25],
  surface: ink[0],
  surfaceSunken: ink[50],
  surfaceSoft: green[50],

  textStrong: ink[900],
  textBody: ink[700],
  textMuted: ink[500],
  textFaint: ink[400],
  textOnDark: ink[0],
  textLink: green[700],

  borderSubtle: ink[100],
  borderDefault: ink[200],
  borderStrong: ink[300],

  success: green[600],
  danger: red[600],
  warning: yellow[500],
  info: blue[600],

  credit: green[600],
  debit: red[600],
} as const;

export const providerColor = {
  appleBg: ink[900],
  appleText: ink[0],
  kakaoBg: '#fee500',
  kakaoText: ink[900],
} as const;

export const placeType = {
  sights: { label: '관광지', color: green[500] },
  food: { label: '식당', color: red[500] },
  lodging: { label: '숙소', color: '#7048e8' },
  cafe: { label: '카페', color: amber[600] },
  shopping: { label: '쇼핑', color: '#e64980' },
  etc: { label: '기타', color: ink[500] },
} as const;

export const font = {
  family: {
    regular: 'Pretendard-Regular',
    semibold: 'Pretendard-SemiBold',
    bold: 'Pretendard-Bold',
  },
  size: {
    display: 32,
    titleLg: 26,
    title: 22,
    headline: 19,
    subhead: 17,
    body: 15,
    label: 14,
    caption: 13,
    micro: 11,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  leading: { tight: 1.2, snug: 1.35, normal: 1.5, relaxed: 1.65 },
} as const;

export const space = {
  0: 0,
  1: 2,
  2: 4,
  3: 8,
  4: 12,
  5: 16,
  6: 20,
  7: 24,
  8: 32,
  9: 40,
  10: 48,
  12: 64,
} as const;

export const layout = {
  gutter: 20,
  gapCard: 12,
  padCard: 16,
  padCardLg: 20,
  tapMin: 44,
  controlHSm: 36,
  controlH: 48,
  controlHLg: 56,
  screenMax: 420,
  cardMaxW: 360,
  tabbarH: 64,
  headerH: 56,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  pill: 999,
} as const;

export const shadow = {
  xs: {
    shadowColor: ink[900],
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: ink[900],
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: ink[900],
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  lg: {
    shadowColor: ink[900],
    shadowOpacity: 0.14,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

export const motion = {
  durFast: 120,
  durBase: 200,
  durSlow: 320,
} as const;

export const theme = { color, providerColor, placeType, font, space, layout, radius, shadow, motion } as const;

export default theme;
