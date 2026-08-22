const chit = {
  coral: '#FF6258',
  actionCoral: '#C9433B',
  receiptCream: '#FFF8ED',
  paperWhite: '#FFFFFF',
  ledgerInk: '#22242A',
  softGray: '#F2F3F5',
  clearGreen: '#168A5B',
  alertRed: '#D83A45',
  infoBlue: '#3478D4',
  ticketYellow: '#FFC845',
  warmLine: '#E7E1D7',
  paperLine: '#E5E6E8',
  mutedInk: '#74777F',
  faintInk: '#A7A8AD',
  creamPressed: '#F4EBDD',
  paperPressed: '#F8F8F9',
  inkRaised: '#2C2F36',
  inkSoft: '#F5F0E7',
  greenSoft: '#EAF6F0',
  redSoft: '#FDEBED',
  blueSoft: '#EAF2FD',
  coralSoft: '#FFE9E6',
  yellowSoft: '#FFF3C9',

  // Compatibility aliases retained while current screens migrate to Ledger × Memory names.
  charcoal: '#22242A',
  matteCharcoal: '#2C2F36',
  charcoalElevated: '#363942',
  charcoalRaised: '#454851',
  graphite: '#22242A',
  graphiteShell: '#FFF8ED',
  graphiteRaised: '#FFFFFF',
  graphiteCard: '#FFFFFF',
  graphiteElevated: '#F2F3F5',
  graphiteHighest: '#22242A',
  graphiteSunken: '#F2F3F5',
  graphiteLine: '#E7E1D7',
  graphiteLineStrong: '#D7CEC1',
  offWhiteText: '#FFFFFF',
  mutedText: '#74777F',
  faintText: '#A7A8AD',
  acidLime: '#FF6258',
  acidLimeHover: '#E9544B',
  acidLimePressed: '#C9433B',
  acidLimeSoft: '#FFE9E6',
  acidLimeSofter: '#FFF4F2',
  acidLimeSurface: '#FFE9E6',
  acidLimeSurfacePressed: '#FFDAD6',
  offWhite: '#FFFFFF',
  offWhiteElevated: '#FFFFFF',
  offWhiteSubtle: '#F2F3F5',
  offWhiteBorder: '#E5E6E8',
  warmPaper: '#FFF8ED',
  paper: '#FFF8ED',
  paperElevated: '#FFFFFF',
  surface: '#FFFFFF',
  paperBorder: '#E7E1D7',
  fintechBlue: '#3478D4',
  fintechBlueSoft: '#EAF2FD',
  punchRed: '#D83A45',
  punchRedSoft: '#FDEBED',
  stampCoral: '#FF6258',
  stampCoralSoft: '#FFE9E6',
} as const;

const green = {
  50: chit.greenSoft,
  100: chit.greenSoft,
  200: '#CBEBDC',
  300: '#9CD9BD',
  400: '#4DBB8A',
  500: chit.clearGreen,
  600: '#117247',
  700: '#0D5C39',
  800: '#0A452C',
  900: '#07331F',
} as const;

const amber = {
  50: chit.yellowSoft,
  100: '#FFE8A3',
  200: '#FFDC78',
  300: '#FFD45A',
  400: '#FFCE42',
  500: chit.ticketYellow,
  600: '#D89B1F',
  700: '#A97416',
} as const;

const ink = {
  0: chit.paperWhite,
  25: '#FAFAFB',
  50: chit.paperWhite,
  100: chit.softGray,
  200: chit.paperLine,
  300: '#D1D3D7',
  400: chit.faintInk,
  500: chit.mutedInk,
  600: '#5C5F66',
  700: '#44474F',
  800: chit.inkRaised,
  900: chit.ledgerInk,
} as const;

const red = { 100: chit.redSoft, 500: chit.alertRed, 600: '#B82E38' } as const;
const blue = { 100: chit.blueSoft, 500: chit.infoBlue, 600: '#2467B8' } as const;
const violet = { 500: '#7A6FD6' } as const;
const pink = { 500: '#E76A9B' } as const;
const yellow = { 100: chit.yellowSoft, 500: chit.ticketYellow } as const;

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

  primary: chit.coral,
  primaryHover: '#E9544B',
  primaryPressed: chit.actionCoral,
  primarySoft: chit.coralSoft,
  onPrimary: chit.paperWhite,
  brandAccent: chit.coral,
  actionPrimary: chit.actionCoral,
  actionPrimaryPressed: '#A93631',
  onActionPrimary: chit.paperWhite,
  uiAccent: chit.coral,
  uiAccentSoft: chit.coralSoft,
  onUiAccent: chit.paperWhite,
  accent: chit.ticketYellow,
  accentSoft: chit.yellowSoft,

  bg: chit.receiptCream,
  surface: chit.paperWhite,
  surfaceSunken: chit.softGray,
  surfaceSoft: '#FAFAFB',
  memorySurface: chit.receiptCream,
  ledgerSurface: chit.paperWhite,
  receiptSurface: '#FFFDF8',
  lightEscape: chit.paperWhite,
  shell: chit.receiptCream,
  shellElevated: chit.paperWhite,
  shellRaised: '#FAFAFB',
  shellHighest: chit.ledgerInk,

  textStrong: chit.ledgerInk,
  textBody: '#44474F',
  textMuted: chit.mutedInk,
  textFaint: chit.faintInk,
  textOnDark: chit.paperWhite,
  textOnShell: chit.ledgerInk,
  textOnShellMuted: chit.mutedInk,
  textOnShellFaint: chit.faintInk,
  textLink: chit.infoBlue,
  primaryTextOnLight: chit.ledgerInk,

  borderSubtle: chit.paperLine,
  borderDefault: chit.warmLine,
  borderStrong: '#D7CEC1',

  success: chit.clearGreen,
  danger: chit.alertRed,
  warning: chit.ticketYellow,
  info: chit.infoBlue,

  credit: chit.clearGreen,
  debit: chit.alertRed,
} as const;

export const providerColor = {
  appleBg: chit.ledgerInk,
  appleText: chit.paperWhite,
  kakaoBg: '#fee500',
  kakaoText: chit.ledgerInk,
} as const;

export const placeType = {
  sights: { label: '관광지', color: green[600] },
  food: { label: '식당', color: chit.coral },
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
    shadowColor: chit.ledgerInk,
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: chit.ledgerInk,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  md: {
    shadowColor: chit.ledgerInk,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  lg: {
    shadowColor: chit.ledgerInk,
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
} as const;

export const motion = { fast: 140, normal: 200, slow: 280 } as const;

export const theme = { color, font, layout, motion, placeType, providerColor, radius, shadow, space } as const;

export default theme;
