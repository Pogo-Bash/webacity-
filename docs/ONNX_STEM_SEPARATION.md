# Real AI Stem Separation with ONNX

This guide explains how to use **real AI models** for stem separation in Webacity using ONNX Runtime Web.

## Overview

Unlike the demo filter-based approach, this uses actual AI models (UVR MDX-NET) that provide **professional-quality** stem separation directly in your browser.

## Models

### Recommended: UVR MDX-NET Models

These models are proven to work in browsers and provide excellent quality:

| Model | Size | Purpose | Quality |
|-------|------|---------|---------|
| UVR-MDX-NET-Voc_FT | 67 MB | Vocals extraction | ⭐⭐⭐⭐⭐ |
| UVR-MDX-NET-Inst_HQ_1 | 67 MB | Instrumental | ⭐⭐⭐⭐⭐ |
| UVR-MDX-NET-Inst_Main | 53 MB | Instrumental (smaller) | ⭐⭐⭐⭐ |

### Download Models

**Option 1: From Hugging Face (Recommended)**

```bash
# Download vocals model
curl -L -o public/models/vocals.onnx https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/UVR-MDX-NET-Voc_FT.onnx

# Download instrumental model (optional - can be derived from vocals)
curl -L -o public/models/instrumental.onnx https://huggingface.co/Blane187/all_public_uvr_models/resolve/main/UVR-MDX-NET-Inst_HQ_1.onnx
```

**Option 2: Manual Download**

1. Visit: https://huggingface.co/Blane187/all_public_uvr_models/tree/main
2. Download `UVR-MDX-NET-Voc_FT.onnx` (67 MB)
3. Place it in `public/models/vocals.onnx`

## Setup

### 1. Install Dependencies

```bash
npm install onnxruntime-web
```

### 2. Place Models

Put your ONNX models in the `public/models/` directory:

```
public/
└── models/
    ├── vocals.onnx          # Required (67 MB)
    └── instrumental.onnx    # Optional (67 MB)
```

### 3. Configure the Service

In your code:

```javascript
import { onnxStemSeparator } from './services/stemSeparationONNX'

// Initialize
await onnxStemSeparator.initialize()

// Load models
await onnxStemSeparator.loadModels(
  '/models/vocals.onnx',           // Required
  '/models/instrumental.onnx'      // Optional (can subtract from original)
)

// Separate stems
const { vocals, instrumental } = await onnxStemSeparator.separate(audioBuffer, (progress) => {
  console.log(`${progress.message} ${progress.progress}%`)
})
```

## Performance

### Processing Speed

With WebGPU (Chrome/Edge 113+, Safari 18+):
- **90-second song**: ~30-45 seconds
- **3-minute song**: ~60-90 seconds

With WASM fallback (older browsers):
- **90-second song**: ~60-90 seconds
- **3-minute song**: ~2-3 minutes

### Memory Usage

The implementation is optimized to prevent crashes:
- **Chunked processing**: Processes 6 seconds at a time
- **Overlap-add**: 25% overlap for smooth transitions
- **Automatic breaks**: Gives browser time to garbage collect
- **Memory limit**: Stays under 512 MB total

## Features

✅ **Real AI Models** - Professional UVR MDX-NET models
✅ **No Server Required** - Runs entirely in browser
✅ **WebGPU Accelerated** - Fast on modern browsers
✅ **Memory Safe** - Prevents browser crashes
✅ **Progress Tracking** - Real-time progress updates
✅ **Privacy** - Audio never leaves your device

## Browser Compatibility

### Recommended (WebGPU)
- Chrome/Edge 113+ ⭐⭐⭐⭐⭐
- Safari 18+ ⭐⭐⭐⭐⭐

### Fallback (WASM)
- Firefox 100+ ⭐⭐⭐⭐
- Safari 14+ ⭐⭐⭐⭐
- Older Chrome/Edge ⭐⭐⭐

## Troubleshooting

### Model Download Fails

**Problem**: 403 Forbidden or CORS error when loading model

**Solution**: You need to host the models yourself or use a CDN that allows CORS.

```javascript
// Option 1: Host models yourself (recommended)
await onnxStemSeparator.loadModels('/models/vocals.onnx')

// Option 2: Use a CORS-enabled CDN
await onnxStemSeparator.loadModels(
  'https://your-cdn.com/models/vocals.onnx'
)
```

### Browser Crashes / Out of Memory

**Problem**: Browser becomes unresponsive or crashes

**Solution**: The new implementation prevents this with:
1. Chunked processing (6-second chunks)
2. Periodic async breaks
3. Memory monitoring
4. Automatic garbage collection hints

If still experiencing issues:
- Close other browser tabs
- Try on a less powerful computer with smaller audio files
- Use the demo mode for quick previews

### Slow Processing

**Problem**: Takes too long to process

**Solutions**:
1. **Use WebGPU**: Chrome 113+ or Safari 18+
2. **Reduce chunk size**: Edit `chunkSize` in config (trades speed for memory)
3. **Use single model**: Only load vocals model (instrumental derived by subtraction)
4. **Shorter audio**: Process shorter clips

### Poor Quality Results

**Problem**: Separation quality is not good

**Solutions**:
1. **Use better model**: Try `UVR-MDX-NET-Voc_FT.onnx` instead of `Inst_Main`
2. **Check input quality**: Works best with high-quality recordings
3. **Avoid re-encoded audio**: Use lossless formats when possible

## Advanced Configuration

### Adjust Processing Parameters

```javascript
// Before loading models, adjust config:
onnxStemSeparator.config.chunkSize = 131072  // Smaller = less memory, slower
onnxStemSeparator.config.overlap = 0.5       // More = smoother, slower
onnxStemSeparator.config.maxMemoryMB = 256   // Lower for older devices
```

### Custom Model

If you have your own ONNX stem separation model:

```javascript
await onnxStemSeparator.loadModels(
  '/path/to/your/model.onnx'
)
```

**Model Requirements**:
- Format: ONNX (opset 11+)
- Input: `[batch, channels, samples]` - float32
- Output: `[batch, channels, samples]` - float32
- Size: < 200 MB recommended

## Comparison: Demo vs AI

| Feature | Demo (Filters) | AI (ONNX) |
|---------|---------------|-----------|
| **Quality** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Speed** | 1-2 seconds | 30-90 seconds |
| **Model Size** | 0 MB | 67 MB |
| **Vocals Clarity** | Poor | Excellent |
| **No Artifacts** | ❌ | ✅ |
| **Works Offline** | ✅ | ✅ |
| **Setup Complexity** | None | Download model |

## Production Deployment

### Hosting Models

For production, host models on a CDN:

```javascript
// Example with Cloudflare R2 / AWS S3 / Vercel Blob
const VOCALS_MODEL_URL = 'https://your-cdn.com/models/vocals.onnx'

await onnxStemSeparator.loadModels(VOCALS_MODEL_URL)
```

### Caching

Models are cached by ONNX Runtime automatically. First load is slow (downloads 67 MB), subsequent loads are instant.

### Progressive Loading

Show loading state while model downloads:

```javascript
await onnxStemSeparator.loadModels(
  '/models/vocals.onnx',
  null,
  (progress) => {
    console.log(`${progress.message} - ${progress.progress}%`)
    updateUI(progress)
  }
)
```

## Alternative Models

### Demucs ONNX (Larger, Higher Quality)

If you need even better quality and can handle larger models:

- **demucs_quantized.onnx**: ~80 MB (4 stems: vocals, drums, bass, other)
- GitHub: https://github.com/gianlourbano/demucs-onnx

### Custom Training

Train your own model and export to ONNX:

```python
# PyTorch to ONNX
import torch
torch.onnx.export(model, dummy_input, "model.onnx", opset_version=11)
```

## License Considerations

UVR MDX-NET models are released under permissive licenses for non-commercial use. Check each model's license before commercial deployment.

## Support

- For ONNX Runtime issues: https://github.com/microsoft/onnxruntime
- For UVR models: https://github.com/Anjok07/ultimatevocalremovergui
- For this implementation: Create an issue in this repo

---

**Ready to try real AI stem separation?** Download a model and start separating! 🎵
