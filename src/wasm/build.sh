#!/bin/bash

# Build script for WASM modules
# Requires Emscripten SDK (emsdk)

set -e

echo "Building WASM audio processing modules..."

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: emcc not found. Please install and activate Emscripten SDK."
    echo "Visit: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p ../../public/wasm

# Build using Makefile
make -C . all

echo "WASM modules built successfully!"
echo "Output files are in public/wasm/"
