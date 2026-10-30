# Changelog

All notable changes to `@ethora/ai-chat-widget` and the embeddable bundle `ethora_assistant.js` are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are the release date written as `yy.m.d` and match the `package.json` version.

The Release workflow moves everything under `[Unreleased]` into a dated section and uses that section as the GitHub release notes. Write the entries while you work, one line per change.

## [Unreleased]

### Fixed

- Keep the opening greeting once at the beginning when a visitor reloads or moves between pages.
- Draw the launcher from cached appearance immediately and refresh its configuration in the background.
- A visitor coming back to a panel left open (reopening it, returning to the tab, or typing) renews the session at most every 5 minutes, so the bot is back in the conversation after the server let the quiet room go.

## [26.10.1] - 2026-10-21

### Added

- Language picker, resizable panel, quick-reply buttons and a new typing indicator.
- The widget applies the appearance saved in the admin's AI Widget tab.
- The visitor session is provisioned on first open and resumed on return. The session request carries the page the widget runs on.
- pdf.js is no longer inside the bundle: it is loaded from `pdfjs/` next to the script when a PDF is shown.

### Changed

- The bundle is built as ASCII, so it renders on pages that are not UTF-8.
- The pdf.js asset base is resolved from the script's directory, not its origin.
- One bot identity per widget, and the widget has an icon of its own.

### Fixed

- The history loader no longer flashes over a fresh conversation.
- The composer grows with its text and keeps compact padding.
- The New Messages divider no longer lands above the greeting.
