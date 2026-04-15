import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  const isLibraryBuild = mode === 'library';

  return {
    plugins: [react(), ...(isLibraryBuild ? [dts({ include: ['src'] })] : [])],
    define: {
      'process.env': {},
    },
    build: isLibraryBuild
      ? {
          sourcemap: true,
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
