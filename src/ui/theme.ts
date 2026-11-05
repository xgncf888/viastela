/**
 * Design tokens. Imported by app.config.js, so this file must stay free of React Native.
 * Screens and feature UI take colors and sizes from here; ESLint rejects raw values.
 *
 * Unified 5-Platform Design System (`DESIGN.md`):
 * - Default Light Theme (`Warm`): `#FAF9F5` unified canvas & sidebar, `#FFFFFF` elevated card,
 *   `#F5F4ED` secondary fill, `#F0EEE6` pill/selected fill, `#D97757` terracotta accent.
 * - Selectable Dark Theme (`Obsidian Gold · 星途暗金`): `#121318` deep obsidian canvas,
 *   `#1A1C23` card, `#22252F` secondary fill, `#F5B942` gold accent.
 */
export type Palette = {
  paper: string;
  paperDeep: string;
  card: string;
  surface: string;
  fill: string;
  pill: string;
  pillHover: string;
  /** Full-bleed press wash for rows, tappable cards, and tabs. */
  pressed: string;
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
  green: string;
  greenSoft: string;
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
  /** Skeleton blocks sitting on `card`. */
  skeleton: string;
};

export const lightColor: Palette = {
  paper: '#FAF9F5',
  paperDeep: '#F5F4ED',
  card: '#FFFFFF',
  surface: '#F5F4ED',
  fill: '#F5F4ED',
  pill: '#F0EEE6',
  pillHover: '#E8E6E0',
  pressed: 'rgba(38, 36, 31, 0.06)',
  bar: '#FAF9F5',
  ink: '#141413',
  muted: '#3D3D3A',
  textFaint: '#73726C',
  line: '#DCDAD3',
  lineSoft: '#E8E6E0',
  accent: '#D97757',
  accentHover: '#C2603F',
  accentInk: '#141413',
  accentText: '#944A34',
  accentSoft: '#F5ECE5',
  pos: '#2F7613',
  moss: '#6E9079',
  green: '#1F5E4B',
  greenSoft: '#E5F1EC',
  target: '#73726C',
  chartGrid: '#E8E6E0',
  chartAxis: '#73726C',
  toast: '#141413',
  onToast: '#FAF9F5',
  danger: '#B53333',
  dangerFill: '#B53333',
  dangerSoft: '#F8EEEB',
  warning: '#8A5A12',
  warningSoft: '#FBF3E4',
  overlay: 'rgba(20, 20, 19, 0.42)',
  skeleton: '#E2DFD5',
};

export const darkColor: Palette = {
  paper: '#121318',
  paperDeep: '#161820',
  card: '#1A1C23',
  surface: '#22252F',
  fill: '#22252F',
  pill: 'rgba(245, 185, 66, 0.12)',
  pillHover: 'rgba(245, 185, 66, 0.20)',
  pressed: 'rgba(250, 249, 245, 0.08)',
  bar: '#121318',
  ink: '#F4F3EF',
  muted: '#9CA3AF',
  textFaint: '#6B7280',
  line: 'rgba(245, 185, 66, 0.22)',
  lineSoft: 'rgba(255, 255, 255, 0.08)',
  accent: '#F5B942',
  accentHover: '#E5A93C',
  accentInk: '#121318',
  accentText: '#FDE68A',
  accentSoft: 'rgba(245, 185, 66, 0.14)',
  pos: '#34D399',
  moss: '#6EE7B7',
  green: '#34D399',
  greenSoft: 'rgba(52, 211, 153, 0.14)',
  target: '#9CA3AF',
  chartGrid: '#22252F',
  chartAxis: '#9CA3AF',
  toast: '#1A1C23',
  onToast: '#F4F3EF',
  danger: '#F87171',
  dangerFill: '#B53333',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  warning: '#F5B942',
  warningSoft: 'rgba(245, 185, 66, 0.14)',
  overlay: 'rgba(0, 0, 0, 0.68)',
  skeleton: '#363632',
};

export const theme = {
  color: lightColor,
  space: {
    xs: 4,
    sm: 8,
    ms: 12,
    md: 16,
    page: 20,
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
    lg: 17,
    metric: 20,
    xl: 30,
    display: 36,
  },
  lineHeight: {
    tick: 12,
    caption: 16,
    sm: 18,
    muted: 20,
    tab: 20,
    md: 24,
    lg: 24,
    metric: 26,
    xl: 34,
    display: 40,
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
    sm: 10,
    mini: 10,
    button: 12,
    md: 14,
    card: 14,
    lg: 14,
    sheet: 16,
    bar: 2,
    pill: 999,
  },
  border: {
    width: 1,
    indicator: 2,
  },
  shadow: {
    card: {
      web: '0 1px 2px rgba(20,20,19,.04), 0 0 0 1px rgba(20,20,19,.06)',
      ios: {
        shadowColor: '#141413',
        shadowOpacity: 0.06,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 1,
      },
    },
  },
  /**
   * Press and sheet motion tokens (v2: 50ms press, 160ms release, 280ms sheet).
   * Disabled opacity stays the existing 0.55.
   */
  press: {
    inMs: 50,
    releaseMs: 160,
    sheetMs: 280,
    easing: 'cubic-bezier(0.2, 0, 0, 1)',
    sheetEasing: 'cubic-bezier(0.32, 0.72, 0, 1)',
    opacity: 0.86,
    scale: 0.98,
    disabledOpacity: 0.55,
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
    strokeSelected: 1.8,
    strokeMinor: 1.2,
    progress: 4,
    mark: 22,
    maskWidth: 64,
    timeColumn: 44,
    /** Crayon empty-state illustration, inside the 96–128 range. */
    illustration: 112,
    /** Circular profile portrait. */
    avatar: 72,
  },
} as const;

export type SpaceName = keyof typeof theme.space;
