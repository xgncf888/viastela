const expo = require('eslint-config-expo/flat');
const noRawDesignValues = require('./eslint/no-raw-design-values');

const coreImports = {
  paths: [
    { name: 'react', message: 'src/core is pure TypeScript and cannot import React.' },
    { name: 'react-native', message: 'src/core is pure TypeScript and cannot import React Native.' },
    { name: '@supabase/supabase-js', message: 'Only src/data may call Supabase.' },
  ],
  patterns: [
    {
      group: ['@/ui', '@/ui/*', '@/data', '@/data/*', '@/features', '@/features/*', 'expo', 'expo-*', '@supabase/*'],
      message: 'src/core cannot depend on UI, data, features, Expo, or Supabase.',
    },
  ],
};

module.exports = [
  ...expo,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'supabase/**',
      'coverage/**',
      'scripts/**',
      'web-build/**',
      'releases/**',
      '**/*.app/**',
      'ios/**',
      'android/**',
    ],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    plugins: {
      viastela: {
        rules: {
          'no-raw-design-values': noRawDesignValues,
        },
      },
    },
    rules: {
      'viastela/no-raw-design-values': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Only src/data may call Supabase.',
            },
          ],
          patterns: [
            {
              group: ['@/data/client', '**/data/client'],
              message: 'Call the functions in src/data. Do not import the Supabase client from a screen.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/config/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Only src/data may call Supabase.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', coreImports],
    },
  },
];
