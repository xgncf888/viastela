/**
 * Design tokens. Imported by app.config.js, so this file must stay free of React Native.
 * Screens and feature UI take colors and sizes from here; ESLint rejects raw values.
 */
export const theme = {
  color: {
    paper: '#F3EDE4',
    paperDeep: '#E6DDD0',
    card: '#FFFBF6',
    ink: '#1C1915',
    muted: '#6F675C',
    faint: '#A39A8D',
    line: '#E3D9CB',
    accent: '#C4492C',
    accentInk: '#FFFBF6',
    accentSoft: '#F8E6DF',
    moss: '#1F6B4A',
    danger: '#9C2F2F',
    dangerSoft: '#F8E4E1',
    overlay: 'rgba(28, 25, 21, 0.46)',
  },
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
    md: 16,
    lg: 20,
    xl: 28,
    display: 48,
  },
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    pill: 999,
  },
  border: {
    width: 1,
  },
  layout: {
    sidebar: 248,
    content: 680,
    tabBar: 92,
    wide: 960,
    chart: 148,
    control: 48,
  },
} as const;
