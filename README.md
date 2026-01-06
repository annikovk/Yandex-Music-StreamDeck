# Yandex Music for Stream Deck

[![Get it on Elgato Marketplace](https://docs.elgato.com/img/badges/get-it-on-marketplace--dark.svg)](https://marketplace.elgato.com/product/yandex-music)

Control Yandex Music desktop app directly from your Stream Deck.

## Features

- **Play/Pause** - Toggle playback
- **Play/Pause with Cover** - Toggle playback and display current track cover art
- **Previous Track** - Skip to previous track
- **Next Track** - Skip to next track
- **Like** - Like the current track
- **Dislike** - Dislike the current track
- **Mute** - Toggle mute

## Requirements

- Stream Deck software version 6.9 or higher
- Yandex Music desktop app
- macOS 12+ or Windows 10+

## Installation

1. Download and install from the [Elgato Marketplace](https://marketplace.elgato.com/product/yandex-music)
2. The plugin will appear in your Stream Deck actions list under "Yandex Music" category
3. Drag and drop actions onto your Stream Deck

## Development

### Prerequisites

- Node.js 20+
- Stream Deck software
- Elgato CLI tools

### Setup

```bash
cd yandex-music
npm install
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run watch
```

This will watch for changes and automatically restart the plugin.

## Technology

Built with:
- TypeScript
- Elgato Stream Deck SDK v3
- Chrome Remote Interface (for controlling Yandex Music app)
- Rollup for bundling

## Author

Konstantin Annikov

## License

See license file for details.
