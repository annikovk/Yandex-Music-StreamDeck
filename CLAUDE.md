# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stream Deck plugin that controls the Yandex Music desktop app using Chrome DevTools Protocol (CDP). The plugin launches the Yandex Music app with remote debugging enabled and interacts with it by executing JavaScript in the browser context to query DOM elements and trigger clicks.

## Build and Development Commands

```bash
# Build the plugin (outputs to com.annikov.yandex-music.sdPlugin/bin/)
npm run build

# Development mode with auto-reload on changes
npm run watch
```

The `watch` command uses the Elgato CLI to automatically restart the plugin in Stream Deck when changes are detected.

## Architecture

### Core Components

**YandexMusicController** (`src/utils/yandex-music-controller.ts`)
- Singleton facade that coordinates all plugin operations
- Delegates to specialized modules organized by domain
- Entry point for all actions to interact with Yandex Music

**Actions** (`src/actions/`)
- Each action class extends `SingletonAction` from Stream Deck SDK
- Decorated with `@action({ UUID: "..." })` to register with Stream Deck
- Handle lifecycle events: `onWillAppear`, `onKeyDown`, `onWillDisappear`
- All actions go through YandexMusicController rather than directly accessing CDP

### Modular Organization

**CDP Layer** (`src/utils/cdp/`)
- `CDPClientManager`: Connection management, port configuration, disconnect handling
- `CDPReconnectionManager`: Automatic reconnection with exponential backoff
- `CDPExecutor`: Executes JavaScript in the browser context via CDP Runtime.evaluate
- `ConnectionLifecycleManager`: Tracks connection grace periods to suppress error reporting during initial connection

**App Layer** (`src/utils/app/`)
- `AppDetector`: Locates Yandex Music app on macOS/Windows
- `AppLauncher`: Launches app with `--remote-debugging-port` flag
- `AppLifecycleManager`: Tracks launch grace periods and waits for UI readiness

**DOM Layer** (`src/utils/dom/`)
- `PlayerControls`: Click operations (play/pause, next/previous, like/dislike, mute)
- `PlayerStateQuery`: Reads state (isPlaying, isLiked, isMuted)
- `TrackInfoExtractor`: Extracts track metadata (title, artist, cover URL, time)
- `DOMQuery`: Utility for executing DOM queries via CDP

**Telemetry** (`src/utils/telemetry/`)
- `analytics-reporter`: Tracks action usage
- `error-reporter`: Reports errors to remote endpoint (suppressed during grace periods)
- `installation-reporter`: Reports installation info on plugin startup

**Core Utilities** (`src/utils/core/`)
- `logger`: Centralized logging (automatically reports errors)
- `installation-id`: Persistent UUID for analytics
- `error-utils`: Error formatting and stack trace extraction

### Key Patterns

**Grace Period Pattern**
- After app launch or CDP connection, a grace period suppresses error reporting
- Prevents false positives while the app is initializing
- `APP_LIFECYCLE_CONFIG.LAUNCH_GRACE_PERIOD_MS` = 10 seconds
- Connection grace period managed by `ConnectionLifecycleManager`
- Check `isInAnyGracePeriod()` before reporting errors

**Retry with Exponential Backoff**
- UI operations retry automatically: `retryUIOperation()` in YandexMusicController
- Increases retry attempts during grace periods to handle slow startup
- Configured via `RETRY_CONFIG` constants

**CSS Selector Centralization**
- All Yandex Music DOM selectors defined in `src/utils/constants/dom-selectors.ts`
- If Yandex Music UI changes and plugin breaks, update selectors here first
- Format: `DOM_SELECTORS.BUTTON_NAME` and `SVG_ICONS.ICON_NAME`

**Singleton Controller Pattern**
- YandexMusicController exported as singleton: `export const yandexMusicController = new YandexMusicController()`
- Actions import and use this singleton instance
- Ensures single CDP connection shared across all actions

## Important Configuration

All configuration constants defined in `src/utils/constants/config.ts`:
- `CDP_CONFIG`: Default port (9222), host, connection timeout
- `RECONNECTION_CONFIG`: Max reconnection attempts, delays
- `APP_LIFECYCLE_CONFIG`: Grace periods, UI ready timeouts
- `RETRY_CONFIG`: Retry attempts for UI operations
- `ANALYTICS_CONFIG`: Telemetry endpoints
- `APP_PATHS`: Yandex Music app paths for macOS/Windows

## Working with Yandex Music DOM

The plugin interacts with Yandex Music by:
1. Querying DOM elements using CSS selectors (defined in `dom-selectors.ts`)
2. Executing JavaScript via CDP's `Runtime.evaluate` to:
   - Read element properties (e.g., checking if pause button exists = playing)
   - Simulate clicks on buttons
   - Extract text content and attributes

**Example pattern** (from `PlayerControls`):
```typescript
// Check if element exists
const exists = await domQuery.elementExists(DOM_SELECTORS.PAUSE_BUTTON);

// Click an element
await domQuery.clickElement(DOM_SELECTORS.PLAY_BUTTON);

// Extract element property
const coverUrl = await domQuery.getElementAttribute(
    DOM_SELECTORS.COVER_IMAGE,
    'src'
);
```

## Plugin Structure

```
com.annikov.yandex-music.sdPlugin/
├── manifest.json          # Plugin metadata, actions, UUID, requirements
├── imgs/                  # Icons for actions and plugin
└── bin/
    └── plugin.js          # Compiled output (rollup bundles src/plugin.ts)
```

The manifest defines 6 actions with UUIDs that must match the `@action` decorator in TypeScript classes.

## Windows Detection Improvements

The Windows app detection has been enhanced with multiple fallback strategies:

1. **Standard Paths**: Checks common installation locations:
   - `%LOCALAPPDATA%\Programs\YandexMusic\` (and variants with spaces/hyphens)
   - `%ProgramFiles%\YandexMusic\`
   - `%ProgramFiles(x86)%\YandexMusic\`
   - Tries both `Яндекс Музыка.exe` and `YandexMusic.exe`

2. **Windows Registry**: Queries registry keys for installation path:
   - `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\YandexMusic`
   - `HKLM` variants for system-wide installations

3. **PowerShell Search**: As a last resort, searches filesystem using PowerShell
   - Recursively searches common directories (depth-limited to avoid slowness)
   - 10-second timeout per search to prevent hanging

If detection fails, users can specify a custom executable path in Stream Deck plugin settings.

## Debugging

- Stream Deck software has debug logs: Stream Deck → Preferences → Plugins → View Logs
- Plugin uses `streamDeck.logger` (set to "info" level in plugin.ts)
- All errors automatically reported via `logAndReportError()` utility
- Detection attempts are logged with "info" level for troubleshooting
- CDP connection issues often indicate:
  - App not running with remote debugging port
  - Port conflict (check CDP_CONFIG.DEFAULT_PORT)
  - DOM selectors outdated (Yandex Music UI changed)

## Technology Stack

- **TypeScript** with ES2022 modules
- **Elgato Stream Deck SDK v3** (`@elgato/streamdeck`)
- **Chrome Remote Interface** (`chrome-remote-interface`) for CDP communication
- **Rollup** for bundling (outputs ES module with package.json type marker)
- **Node.js 20** runtime (embedded in Stream Deck software)
