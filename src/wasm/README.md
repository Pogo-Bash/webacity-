# WASM Audio Processing Modules

This directory contains C++ source code for high-performance audio processing compiled to WebAssembly.

## Prerequisites

Install Emscripten SDK:
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

## Building

From this directory:
```bash
./build.sh
```

Or manually with make:
```bash
make all
```

## Modules

### AudioProcessor
Basic audio operations:
- Amplify
- Normalize
- Fade In/Out
- Reverse
- Mix

### EffectsProcessor
Audio effects:
- Low/High Pass Filters
- Compressor
- Delay
- Reverb
- Distortion

## Output

Compiled modules are placed in `public/wasm/`:
- `audio-processor.js` + `audio-processor.wasm`
- `effects-processor.js` + `effects-processor.wasm`

## Adding New Effects

1. Add your effect function to the appropriate `.cpp` file
2. Add the binding in the `EMSCRIPTEN_BINDINGS` section
3. Rebuild with `./build.sh`
4. Import and use in JavaScript/Vue components
