# Makefile for building WASM audio modules
# Requires Emscripten SDK (emsdk) to be installed and activated

EMCC = emcc
EMFLAGS = -O3 \
	-s WASM=1 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE=1 \
	-s EXPORT_ES6=1 \
	-s ENVIRONMENT='web,worker' \
	-s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
	--bind

AUDIO_SRC = audio/AudioProcessor.cpp
EFFECTS_SRC = effects/Effects.cpp

AUDIO_OUT = ../../public/wasm/audio-processor.js
EFFECTS_OUT = ../../public/wasm/effects-processor.js

all: audio effects

audio:
	$(EMCC) $(EMFLAGS) $(AUDIO_SRC) -o $(AUDIO_OUT)

effects:
	$(EMCC) $(EMFLAGS) $(EFFECTS_SRC) -o $(EFFECTS_OUT)

clean:
	rm -f ../../public/wasm/*.js ../../public/wasm/*.wasm

.PHONY: all audio effects clean
