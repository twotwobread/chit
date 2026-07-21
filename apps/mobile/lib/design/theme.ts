const chit = {
  charcoal: '#111315',
  matteCharcoal: '#191B1F',
  charcoalElevated: '#24272C',
  charcoalRaised: '#30343A',
  graphite: '#303740',
  graphiteShell: '#101215',
  graphiteRaised: '#1A1E23',
  graphiteCard: '#20252B',
  graphiteElevated: '#262C33',
  graphiteHighest: '#303740',
  graphiteSunken: '#171B20',
  graphiteLine: 'rgba(255,255,255,0.08)',
  graphiteLineStrong: 'rgba(255,255,255,0.15)',
  offWhiteText: '#F7F7F2',
  mutedText: '#C5C9C1',
  faintText: '#8E958B',
  acidLime: '#C8FF00',
  acidLimeHover: '#B8F000',
  acidLimePressed: '#A6DB00',
  acidLimeSoft: '#F1FFC2',
  acidLimeSofter: '#F8FFE0',
  acidLimeSurface: '#273218',
  acidLimeSurfacePressed: '#1E2814',
  offWhite: '#F7F7F2',
  offWhiteElevated: '#FCFCF8',
  offWhiteSubtle: '#F0F0EA',
  offWhiteBorder: '#E4E3DA',
  warmPaper: '#F5F1E8',
  paper: '#F7F7F2',
  paperElevated: '#FCFCF8',
  surface: '#FCFCF8',
  paperBorder: '#E4E3DA',
  fintechBlue: '#78A7FF',
  fintechBlueSoft: '#18243A',
  punchRed: '#FF5A67',
  punchRedSoft: '#321A20',
  stampCoral: '#FF765C',
  stampCoralSoft: '#33211E',
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
  25: chit.offWhiteElevated,
  50: chit.offWhite,
  100: chit.offWhiteSubtle,
  200: chit.offWhiteBorder,
  300: '#C9C8BE',
  400: '#8E8D84',
  500: '#6F6F66',
  600: '#51524B',
  700: '#363832',
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
  primarySoft: chit.acidLimeSurface,
  onPrimary: chit.charcoal,
  brandAccent: chit.acidLime,
  actionPrimary: chit.graphiteHighest,
  actionPrimaryPressed: chit.graphiteElevated,
  onActionPrimary: chit.offWhiteText,
  uiAccent: chit.acidLime,
  uiAccentSoft: chit.acidLimeSurface,
  onUiAccent: chit.charcoal,
  accent: chit.stampCoral,
  accentSoft: chit.stampCoralSoft,

  bg: chit.graphiteShell,
  surface: chit.graphiteCard,
  surfaceSunken: chit.graphiteSunken,
  surfaceSoft: chit.graphiteElevated,
  lightEscape: chit.offWhiteElevated,
  shell: chit.graphiteShell,
  shellElevated: chit.graphiteRaised,
  shellRaised: chit.graphiteElevated,
  shellHighest: chit.graphiteHighest,

  textStrong: chit.offWhiteText,
  textBody: chit.mutedText,
  textMuted: chit.faintText,
  textFaint: 'rgba(247,247,242,0.48)',
  textOnDark: chit.offWhiteText,
  textOnShell: chit.offWhiteText,
  textOnShellMuted: 'rgba(247,247,242,0.72)',
  textOnShellFaint: 'rgba(247,247,242,0.52)',
  textLink: chit.fintechBlue,
  primaryTextOnLight: chit.offWhiteText,

  borderSubtle: chit.graphiteLine,
  borderDefault: chit.graphiteLine,
  borderStrong: chit.graphiteLineStrong,

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
  sights: { label: '관광지', color: green[800] },
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
    body: 16,
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
  controlHSm: 44,
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
