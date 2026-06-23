import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  build: {
    sourcemap: false,
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
});
