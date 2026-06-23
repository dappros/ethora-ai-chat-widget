import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// We consume @ethora/chat-component from SOURCE (the sibling repo) instead of
// its prebuilt npm dist. Why: the dist bundles its own styled-components copy,
// which (a) can't be retargeted into a Shadow DOM and (b) can't be
// tree-shaken. Building from source means one shared styled-components /
// React / redux instance, so a single StyleSheetManager can pin every style
// into the widget's shadow root (host page styles untouched), and Vite can
// tree-shake unused features to shrink the bundle.
const CHAT_COMPONENT_SRC = resolve(
  __dirname,
  '../ethora-chat-component/src'
);

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  resolve: {
    // Single instance of each shared lib across the shell + chat-component
    // source (load-bearing: prevents duplicate React / styled-components and
    // keeps the StyleSheetManager + redux store singletons shared).
    dedupe: [
      'react',
      'react-dom',
      'styled-components',
      '@reduxjs/toolkit',
      'react-redux',
      'redux',
      'redux-persist',
    ],
    alias: [
      // bare `@ethora/chat-component` -> the library entry (exports Chat etc.)
      {
        find: /^@ethora\/chat-component$/,
        replacement: resolve(CHAT_COMPONENT_SRC, 'main.ts'),
      },
      // subpaths `@ethora/chat-component/<x>` -> source `src/<x>` (lets the
      // shell reach the redux store + slice actions to register the bot room)
      {
        find: /^@ethora\/chat-component\/(.*)$/,
        replacement: `${CHAT_COMPONENT_SRC}/$1`,
      },
      // --- Bundle trimming: stub heavy deps the single-bot assistant never
      // uses, so they drop out of the IIFE. Firebase (push + Google sign-in)
      // is guarded/unused; the emoji dataset + picker only power message
      // reactions, which the assistant disables (config.disableInteractions).
      { find: /^firebase\/app$/, replacement: resolve(__dirname, 'src/widget/stubs/firebase-app.ts') },
      { find: /^firebase\/messaging$/, replacement: resolve(__dirname, 'src/widget/stubs/firebase-messaging.ts') },
      { find: /^firebase\/auth$/, replacement: resolve(__dirname, 'src/widget/stubs/firebase-auth.ts') },
      { find: /^@emoji-mart\/data$/, replacement: resolve(__dirname, 'src/widget/stubs/emoji-data.ts') },
      { find: /^@emoji-mart\/react$/, replacement: resolve(__dirname, 'src/widget/stubs/emoji-react.tsx') },
    ],
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
