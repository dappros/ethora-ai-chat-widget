import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import dts from 'vite-plugin-dts';

// Read package.json once at config load so the bundle's logged version
// always matches the published version, instead of drifting against a
// hardcoded src/version.ts string.
const pkgJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf8')
);

export default defineConfig(({ mode }) => {
  const isLibraryBuild = mode === 'library';

  return {
    plugins: [react(), ...(isLibraryBuild ? [dts({ include: ['src'] })] : [])],
    define: {
      'process.env': {},
      __ETHORA_AI_CHAT_WIDGET_VERSION__: JSON.stringify(pkgJson.version || ''),
    },
    build: isLibraryBuild
      ? {
          sourcemap: true,
          // Don't wipe dist/. The deploy runs `npm run build:lib` (library
          // bundle, consumed by ethora-app-reactjs as a file: dep) and
          // `npm run build` (standalone IIFE bundle, served by nginx as
          // `assistant.js` for the AI Widget embed) in sequence. Both
          // write to the same dist/, so vite's default emptyOutDir:true
          // means the second one wipes the first. Setting this to false
          // for library mode lets the standalone bundle survive a
          // subsequent build:lib (which happens on every deploy via
          // prepare_local_frontend_dependency_overrides). The standalone
          // build is left at default emptyOutDir:true since it runs
          // first in the deploy and benefits from a clean slate.
          emptyOutDir: false,
          lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            formats: ['es'],
            fileName: 'main',
          },
          rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
          },
        }
      : {
          sourcemap: true,
          lib: {
            entry: resolve(__dirname, 'src/main.tsx'),
            name: 'ChatContentAssistant',
            formats: ['iife'],
            fileName: () => 'ethora_assistant.js',
          },
          rollupOptions: {
            external: [],
            output: {
              globals: {},
            },
          },
        },
  };
});
