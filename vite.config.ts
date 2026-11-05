import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __DEV__: JSON.stringify(mode !== 'production'),
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY': JSON.stringify(vapidKey),
    },
    resolve: {
      alias: [
        { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') },
        {
          find: /^react-native$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/react-native-dom.tsx'),
        },
        {
          find: /^react-native-svg$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/react-native-svg.tsx'),
        },
        {
          find: /^react-native-safe-area-context$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/safe-area-context.tsx'),
        },
        {
          find: /^@react-native-async-storage\/async-storage$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/async-storage.ts'),
        },
        {
          find: /^expo-router\/head$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-misc.ts'),
        },
        {
          find: /^expo-router$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-router.tsx'),
        },
        {
          find: /^expo-status-bar$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-misc.ts'),
        },
        {
          find: /^expo-system-ui$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-misc.ts'),
        },
        {
          find: /^expo-constants$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-misc.ts'),
        },
        {
          find: /^expo-linking$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-misc.ts'),
        },
        {
          find: /^react-native-gesture-handler$/,
          replacement: path.resolve(__dirname, 'src/lib/web-shims/expo-misc.ts'),
        },
      ],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 3000,
    },
    server: {
      port: 4173,
      strictPort: true,
      host: true,
    },
  };
});
