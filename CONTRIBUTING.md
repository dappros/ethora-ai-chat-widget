# Contributing

This repository builds and publishes `@ethora/ai-chat-widget` (npm) and the embeddable bundle `ethora_assistant.js`, which the WordPress plugin ships.

Branch names, commits, the local CI gate and releases are described in [docs/WORKFLOW.md](docs/WORKFLOW.md). Read it before opening a branch.

The widget bundles the source of `@ethora/chat-component` at the ref in [chat-component.ref](chat-component.ref). Local builds use a sibling checkout at `../ethora-chat-component`, so `npm run ci:local` does not build. The server builds the bundle with the pinned ref.
