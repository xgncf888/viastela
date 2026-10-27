/**
 * Design tokens. Imported by app.config.js, so this file must stay free of React Native.
 * Screens and feature UI take colors and sizes from here; ESLint rejects raw values.
 *
 * Light palette follows Yifeng's warm editorial spec (g-lab DESIGN.md) and the public
 * paper / ink / clay references. Inspired by Claude.ai's warm minimalism; not affiliated
 * with Anthropic. No proprietary font files.
 */
export type Palette = {
  paper: string;
  paperDeep: string;
  card: string;
  surface: string;
  fill: string;
  ink: string;
  muted: string;
  textFaint: string;
  line: string;
  lineSoft: string;
  accent: string;
  accentHover: string;
  accentText: string;
  accentSoft: string;
  accentInk: string;
  toast: string;
  onToast: string;
  moss: string;
  danger: string;
  dangerFill: string;
  dangerSoft: string;
  overlay: string;
};

export const lightColor: Palette = {
  paper: '#F6F5F0',
  paperDeep: '#F1EFE8',
  card: '#FFFFFF',
  surface: '#FBFAF6',
  fill: '#F1EFE8',
  ink: '#26241F',
  muted: '#5F5E57',
  textFaint: '#6A6962',
  line: '#ECEAE2',
  lineSoft: '#F0EEE7',
  accent: '#CC785C',
  accentHover: '#D08A70',
  accentText: '#944A34',
  accentSoft: '#F5ECE5',
  accentInk: '#26241F',
  toast: '#26241F',
  onToast: '#FAF9F5',
  moss: '#6E9079',
  danger: '#9A463E',
  dangerFill: '#9A463E',
  dangerSoft: '#F8EEEB',
  overlay: 'rgba(38, 36, 31, 0.42)',
};

export const darkColor: Palette = {
  paper: '#141413',
  paperDeep: '#1C1C1A',
  card: '#30302E',
  surface: '#262624',
  fill: '#3A3935',
  ink: '#FAF9F5',
  muted: '#B0AEA5',
  textFaint: '#9C9A90',
  line: '#45443F',
  lineSoft: '#3A3935',
  accent: '#CC785C',
  accentHover: '#D08A70',
  accentText: '#E7A08A',
  accentSoft: '#4A3830',
  accentInk: '#141413',
  toast: '#26241F',
  onToast: '#FAF9F5',
  moss: '#8AAB94',
  danger: '#E29B90',
  dangerFill: '#9A463E',
  dangerSoft: '#3C2C2A',
  overlay: 'rgba(0, 0, 0, 0.62)',
};

export const theme = {
  color: lightColor,
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  font: {
    sm: 13,
    md: 15,
    lg: 18,
    xl: 26,
    display: 40,
  },
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Songti SC", "Noto Serif SC", serif',
  },
  radius: {
    sm: 8,
    md: 10,
    lg: 14,
    pill: 999,
  },
  border: {
    width: 1,
  },
  layout: {
    sidebar: 228,
    content: 680,
    tabBar: 88,
    wide: 960,
    chart: 176,
    control: 44,
    dot: 7,
    stroke: 2,
  },
} as const;

export type SpaceName = keyof typeof theme.space;
