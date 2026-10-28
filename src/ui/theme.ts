/**
 * Design tokens. Imported by app.config.js, so this file must stay free of React Native.
 * Screens and feature UI take colors and sizes from here; ESLint rejects raw values.
 *
 * Light palette follows the warm editorial spec in DESIGN.md. Inspired by Claude.ai's
 * warm minimalism; not affiliated with Anthropic. No proprietary font files.
 *
 * `accentText` and `accentSoft` stay until call sites move to ink. New UI does not use them.
 */
export type Palette = {
  paper: string;
  paperDeep: string;
  card: string;
  surface: string;
  fill: string;
  bar: string;
  ink: string;
  muted: string;
  textFaint: string;
  line: string;
  lineSoft: string;
  accent: string;
  accentHover: string;
  accentInk: string;
  accentText: string;
  accentSoft: string;
  pos: string;
  moss: string;
  target: string;
  chartGrid: string;
  chartAxis: string;
  toast: string;
  onToast: string;
  danger: string;
  dangerFill: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  overlay: string;
};

export const lightColor: Palette = {
  paper: '#F6F5F0',
  paperDeep: '#F1EFE8',
  card: '#FFFFFF',
  surface: '#FBFAF6',
  fill: '#F1EFE8',
  bar: '#F6F5F0',
  ink: '#26241F',
  muted: '#5F5E57',
  textFaint: '#6A6962',
  line: '#ECEAE2',
  lineSoft: '#F0EEE7',
  accent: '#CC785C',
  accentHover: '#D08A70',
  accentInk: '#26241F',
  accentText: '#944A34',
  accentSoft: '#F5ECE5',
  pos: '#4F6F5A',
  moss: '#6E9079',
  target: '#7A786F',
  chartGrid: '#ECEAE2',
  chartAxis: '#5F5E57',
  toast: '#26241F',
  onToast: '#FAF9F5',
  danger: '#9A463E',
  dangerFill: '#9A463E',
  dangerSoft: '#F8EEEB',
  warning: '#8A5A12',
  warningSoft: '#FBF3E4',
  overlay: 'rgba(38, 36, 31, 0.42)',
};

export const darkColor: Palette = {
  paper: '#141413',
  paperDeep: '#191918',
  card: '#1E1E1C',
  surface: '#232321',
  fill: '#2A2A27',
  bar: '#1E1E1C',
  ink: '#FAF9F5',
  muted: '#B0AEA5',
  textFaint: '#9C9A90',
  line: '#3A3934',
  lineSoft: '#2A2A27',
  accent: '#CC785C',
  accentHover: '#D08A70',
  accentInk: '#141413',
  accentText: '#E7A08A',
  accentSoft: '#4A3830',
  pos: '#8AAB94',
  moss: '#8AAB94',
  target: '#8C8A82',
  chartGrid: '#2A2A27',
  chartAxis: '#6A6962',
  toast: '#26241F',
  onToast: '#FAF9F5',
  danger: '#E29B90',
  dangerFill: '#9A463E',
  dangerSoft: '#3C2C2A',
  warning: '#E3B26B',
  warningSoft: '#3A3222',
  overlay: 'rgba(0, 0, 0, 0.62)',
};

export const theme = {
  color: lightColor,
  space: {
    xs: 4,
    sm: 8,
    ms: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  font: {
    tick: 10,
    caption: 12,
    sm: 13,
    tab: 14,
    md: 15,
    lg: 16,
    metric: 20,
    xl: 28,
    display: 32,
  },
  lineHeight: {
    tick: 12,
    caption: 16,
    sm: 18,
    tab: 20,
    md: 22,
    lg: 22,
    metric: 26,
    xl: 34,
    display: 38,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
  },
  /** Caps for `Text`'s `maxFontSizeMultiplier`. Body copy is 1.3; titles, figures, and nav are 1.2. */
  fontScale: {
    body: 1.3,
    heading: 1.2,
  },
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    serif: '"Songti SC", "Noto Serif CJK SC", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  radius: {
    sm: 8,
    md: 10,
    lg: 10,
    bar: 2,
    pill: 999,
  },
  border: {
    width: 1,
    indicator: 2,
  },
  breakpoint: {
    tablet: 600,
    desktop: 1024,
  },
  layout: {
    sidebar: 228,
    sidebarCompact: 184,
    content: 680,
    contentWide: 1080,
    /** Login column on web once the viewport is wider than a phone. */
    auth: 360,
    /** Up to this width the login column stays full bleed. Covers 320 and 390. */
    authFull: 480,
    tabBar: 56,
    control: 44,
    controlMini: 28,
    row: 48,
    chart: 176,
    chartPhone: 120,
    chartShort: 96,
    chartWide: 220,
    chartTrend: 240,
    axisGutter: 32,
    dot: 5,
    dotLast: 8,
    stroke: 1.5,
    progress: 4,
    mark: 22,
    maskWidth: 64,
    timeColumn: 44,
  },
} as const;

export type SpaceName = keyof typeof theme.space;
