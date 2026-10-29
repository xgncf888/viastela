import { createElement, type ReactNode } from 'react';
import { expect, jest, test } from '@jest/globals';

// react-dom's server entry has no local type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

const platform = { os: 'ios' };

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platform.os;
    },
    select(spec: Record<string, unknown>) {
      return spec[platform.os] ?? spec.default;
    },
  },
  StyleSheet: { create: (styles: unknown) => styles },
  Text: ({
    children,
    accessibilityLabel,
    ...rest
  }: {
    children?: ReactNode;
    accessibilityLabel?: string;
    'aria-hidden'?: boolean;
    accessible?: boolean;
  }) =>
    createElement(
      'rn-text',
      {
        'data-label': accessibilityLabel ?? '',
        'data-hidden': rest['aria-hidden'] ? '1' : '0',
        'data-accessible': rest.accessible ? '1' : '0',
      },
      children,
    ),
}));

jest.mock('./ThemeProvider', () => ({
  useTheme: () => ({
    color: {
      ink: '#111111',
      muted: '#222222',
      accent: '#333333',
      accentText: '#444444',
      accentInk: '#000000',
      onToast: '#ffffff',
      danger: '#990000',
      moss: '#009900',
      warning: '#999900',
    },
  }),
}));

async function markup(os: 'ios' | 'android' | 'web', masked: boolean): Promise<string> {
  platform.os = os;
  const { MaskedAmount } = await import('./MaskedAmount');
  return renderToStaticMarkup(createElement(MaskedAmount, { text: 'US$4.00', masked, variant: 'body' }));
}

function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

test('ios and android show only the dots and label them 已隐藏金额', async () => {
  for (const os of ['ios', 'android'] as const) {
    const html = await markup(os, true);
    expect(html).toContain('data-label="已隐藏金额"');
    expect(html).toContain('data-accessible="1"');
    expect(visibleText(html)).toBe('••••');
    expect(visibleText(html)).not.toContain('已隐藏金额');
  }
});

test('web still hides the dots and keeps a clipped 已隐藏金额 text node', async () => {
  const html = await markup('web', true);
  expect(html).toContain('data-hidden="1"');
  expect(visibleText(html)).toContain('••••');
  expect(visibleText(html)).toContain('已隐藏金额');
  expect(html).not.toContain('data-accessible="1"');
});

test('an unmasked amount stays the real text on every platform', async () => {
  for (const os of ['ios', 'android', 'web'] as const) {
    const html = await markup(os, false);
    expect(visibleText(html)).toBe('US$4.00');
    expect(html).not.toContain('已隐藏金额');
  }
});
