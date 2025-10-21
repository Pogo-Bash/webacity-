# Webacity - Modern Web Audio Editor

A modern, web-based audio editor inspired by Audacity, built with Vue 3, Web Audio API, and WebAssembly for high-performance audio processing.

## Features

### Current (MVP - Phase 1)

- **Multi-track Audio Playback** - Import and play multiple audio tracks simultaneously
- **Waveform Visualization** - Real-time canvas-based waveform display with color coding
- **Basic Audio Effects** - Powered by WebAssembly for near-native performance:
  - Amplify
  - Normalize
  - Fade In/Out
  - Reverse
  - Low/High Pass Filters
  - Compressor
  - Delay & Reverb
  - Distortion
- **File Operations**:
  - Import: WAV, MP3, OGG, FLAC, and other browser-supported formats
  - Export: WAV format
- **Track Controls**:
  - Volume and Pan per track
  - Mute/Solo functionality
  - Track naming and color coding
- **Keyboard Shortcuts**:
  - `Space`: Play/Pause
  - `Ctrl/Cmd + I`: Import audio
  - `Ctrl/Cmd + E`: Toggle effects panel
  - `Delete`: Remove selected track

### Upcoming Features

**Phase 2:**
- Multi-track editing (cut, copy, paste)
- Selection and trimming
- More effects (EQ, chorus, phaser)
- Project save/load with IndexedDB
- Undo/Redo functionality
- Spectral view

**Phase 3:**
- Real-time effects preview
- Plugin system
- VST support via WASM
- Advanced mixing capabilities
- Spectral editing

## Tech Stack

- **Frontend**: Vue 3 (Composition API) + Vite
- **Styling**: Tailwind CSS
- **State Management**: Pinia
- **Audio Processing**: Web Audio API + WASM (Emscripten)
- **Language**: JavaScript/C++

## Project Structure

```
webacity/
├── src/
│   ├── audio/              # Audio engine & WASM bridge
│   │   ├── AudioEngine.js  # Web Audio API wrapper
│   │   ├── WasmBridge.js   # JS/WASM interface
│   │   └── worklets/       # AudioWorklet processors
│   ├── components/         # Vue components
│   │   ├── Track.vue       # Track display & controls
│   │   ├── Timeline.vue    # Timeline ruler & playhead
│   │   ├── Toolbar.vue     # Main toolbar
│   │   └── EffectPanel.vue # Effects sidebar
│   ├── stores/             # Pinia stores
│   │   └── audioStore.js   # Main audio state
│   ├── wasm/               # C++ source for WASM
│   │   ├── audio/          # Audio processors
│   │   ├── effects/        # Effects processors
│   │   ├── Makefile        # WASM build config
│   │   └── build.sh        # Build script
│   ├── App.vue             # Main app component
│   └── main.js             # App entry point
├── public/
│   └── wasm/               # Compiled WASM modules
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- (Optional) Emscripten SDK for compiling WASM modules

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd webacity
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Building WASM Modules (Optional)

The app includes JavaScript fallbacks for all audio processing, but for best performance, compile the WASM modules:

1. Install Emscripten SDK:
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

2. Build WASM modules:
```bash
cd src/wasm
./build.sh
```

The compiled modules will be placed in `public/wasm/`.

## Usage

### Importing Audio

1. Click the **Import Audio** button in the toolbar or press `Ctrl/Cmd + I`
2. Select one or more audio files
3. Each file will be loaded into a new track

### Playing Audio

1. Click the **Play** button or press `Space`
2. Use the **Stop** button to stop playback
3. Click on the timeline to seek to a specific position

### Applying Effects

1. Select a track by clicking on it
2. Click the **Effects** button or press `Ctrl/Cmd + E`
3. Choose an effect and adjust its parameters
4. Click **Apply** to process the audio

### Exporting Audio

1. Select the track you want to export
2. Click the **Export** button
3. The track will be downloaded as a WAV file

## Development

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deployment

Deploy to production platforms like Render, Vercel, Netlify, or Railway:

```bash
npm run build  # Build the app
npm start      # Start production server
```

The app is configured to work with `0.0.0.0` host and respects the `PORT` environment variable for easy deployment.

**Quick Deploy to Render:**
- The included `render.yaml` enables one-click deployment
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions

### Code Structure

- **AudioEngine**: Manages Web Audio API context, tracks, and playback
- **WasmBridge**: Interfaces between JavaScript and WASM processors
- **audioStore**: Centralized state management for all audio data
- **Components**: Vue components for UI and visualization

## Performance Considerations

- WASM modules provide near-native performance for audio processing
- Canvas rendering is optimized with device pixel ratio
- Large audio files are handled efficiently with typed arrays
- Effects are applied destructively (non-real-time) for stability

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (14.1+)
- Web Audio API and WASM required

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Multi-track editing (cut, copy, paste)
- [ ] Selection tools
- [ ] More effects (EQ, chorus, phaser, etc.)
- [ ] Project save/load
- [ ] Undo/Redo
- [ ] Real-time effects
- [ ] Plugin system
- [ ] VST support
- [ ] Spectral editing
- [ ] Audio recording from microphone
- [ ] Time-stretching and pitch-shifting
- [ ] Automation lanes
- [ ] MIDI support

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Inspired by [Audacity](https://www.audacityteam.org/)
- Built with [Vue.js](https://vuejs.org/)
- Audio processing powered by [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- WASM compilation via [Emscripten](https://emscripten.org/)

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation in `/docs`

---

**Note**: This is an MVP implementation. Many advanced features are planned for future releases.
