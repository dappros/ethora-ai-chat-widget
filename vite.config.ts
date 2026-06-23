import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  resolve: {
    // The widget bundles @ethora/chat-component into a single IIFE. React,
    // react-dom and styled-components MUST resolve to one copy each so the
    // library shares the host's React context and styled-components
    // StyleSheetManager (Shadow DOM target). Without dedupe the IIFE ships
    // two React instances -> "Invalid hook call" / styles escaping the shadow.
    dedupe: ['react', 'react-dom', 'styled-components'],
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
