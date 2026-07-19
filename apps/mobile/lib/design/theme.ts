const chit = {
  charcoal: '#111315',
  matteCharcoal: '#191B1F',
  charcoalElevated: '#24272C',
  acidLime: '#C8FF00',
  acidLimeHover: '#B8F000',
  acidLimePressed: '#A6DB00',
  acidLimeSoft: '#F1FFC2',
  acidLimeSofter: '#F8FFE0',
  paper: '#F5F1E8',
  paperElevated: '#FAF7F0',
  surface: '#FFFFFF',
  paperBorder: '#DDD5C8',
  fintechBlue: '#2F6BFF',
  fintechBlueSoft: '#E3EAFF',
  punchRed: '#FF4D5E',
  punchRedSoft: '#FFE5E9',
  stampCoral: '#FF4F2E',
  stampCoralSoft: '#FFE4DD',
} as const;

const green = {
  50: chit.acidLimeSofter,
  100: chit.acidLimeSoft,
  200: '#E7FF75',
  300: '#DCFF4A',
  400: '#D2FF25',
  500: chit.acidLime,
  600: '#A6DB00',
  700: '#7EA600',
  800: '#587300',
  900: '#334200',
} as const;

const amber = {
  50: '#FFF1DC',
  100: '#FFE1BF',
  200: '#FFC48F',
  300: '#FFA160',
  400: '#FF7A3F',
  500: chit.stampCoral,
  600: '#E63F22',
  700: '#BA321B',
} as const;

const ink = {
  0: chit.surface,
  25: chit.paperElevated,
  50: chit.paper,
  100: '#EAE3D6',
  200: chit.paperBorder,
  300: '#C8BDAE',
  400: '#928A80',
  500: '#716A62',
  600: '#524D47',
  700: '#383A36',
  800: chit.charcoalElevated,
  900: chit.charcoal,
} as const;

const red = { 100: chit.punchRedSoft, 500: chit.punchRed, 600: chit.punchRed } as const;
const blue = { 100: chit.fintechBlueSoft, 500: chit.fintechBlue, 600: chit.fintechBlue } as const;
const violet = { 500: '#7C5CFF' } as const;
const pink = { 500: '#FF5CA8' } as const;
const yellow = { 100: '#FFF5B8', 500: chit.stampCoral } as const;

export const color = {
  chit,
  green,
  amber,
  ink,
  red,
  blue,
  violet,
  pink,
  yellow,

  primary: chit.acidLime,
  primaryHover: chit.acidLimeHover,
  primaryPressed: chit.acidLimePressed,
  primarySoft: chit.acidLimeSoft,
  onPrimary: chit.charcoal,
  accent: chit.stampCoral,
  accentSoft: chit.stampCoralSoft,

  bg: chit.paper,
  surface: chit.surface,
  surfaceSunken: chit.paperElevated,
  surfaceSoft: chit.acidLimeSofter,

  textStrong: chit.charcoal,
  textBody: ink[700],
  textMuted: ink[500],
  textFaint: ink[400],
  textOnDark: chit.surface,
  textLink: chit.fintechBlue,

  borderSubtle: '#EAE3D6',
  borderDefault: chit.paperBorder,
  borderStrong: ink[300],

  success: chit.acidLime,
  danger: chit.punchRed,
  warning: chit.stampCoral,
  info: chit.fintechBlue,

  credit: chit.fintechBlue,
  debit: chit.punchRed,
} as const;

export const providerColor = {
  appleBg: chit.charcoal,
  appleText: chit.surface,
  kakaoBg: '#fee500',
  kakaoText: chit.charcoal,
} as const;

export const placeType = {
  sights: { label: '관광지', color: green[600] },
  food: { label: '식당', color: red[500] },
  lodging: { label: '숙소', color: violet[500] },
  cafe: { label: '카페', color: amber[600] },
  shopping: { label: '쇼핑', color: pink[500] },
  transport: { label: '교통', color: blue[600] },
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
    shadowColor: chit.charcoal,
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: chit.charcoal,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: chit.charcoal,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  lg: {
    shadowColor: chit.charcoal,
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
