# Stem Separation - TensorFlow.js Models

Webacity uses **TensorFlow.js** for browser-based AI stem separation.

## Current Status: Demo Mode

The app currently runs in **Demo Mode** using frequency-based audio filters:
- **Vocals**: Emphasizes mid-range frequencies (300Hz - 3kHz) where human voice typically sits
- **Instrumental**: Emphasizes bass/treble, reduces mid-range

**Demo Mode Performance:**
- ✅ Very fast (1-2 seconds processing)
- ✅ Works immediately, no model download needed
- ⚠️ Approximate results (not AI-based)
- ⚠️ Best for quick previews or learning

## Upgrading to AI-Based Separation

For professional-quality stem separation, you can add a TensorFlow.js model.

### Required Model Format

Place a TensorFlow.js model in this directory:
```
public/models/stem-separation/
├── model.json          # Model architecture
├── group1-shard1of1.bin  # Model weights
└── (other weight shards if needed)
```

### Model Requirements

- **Format**: TensorFlow.js Graph Model
- **Input**: Audio tensor (stereo, 44.1kHz sample rate)
- **Output**: 2 stems (vocals + instrumental) or 4 stems (vocals, drums, bass, other)
- **Recommended size**: < 100MB for browser performance

### Finding TensorFlow.js Models

#### Option 1: Pre-converted Models (Easiest)

Search TensorFlow Hub or Hugging Face:
```
https://tfhub.dev/?q=audio%20separation
https://huggingface.co/models?library=tfjs&search=audio+separation
```

#### Option 2: Convert Existing Models

Convert from PyTorch, Keras, or SavedModel format:

**From Python/Keras:**
```python
import tensorflowjs as tfjs

# Load your Keras model
model = tf.keras.models.load_model('your_model.h5')

# Convert to TensorFlow.js format
tfjs.converters.save_keras_model(
    model,
    'public/models/stem-separation'
)
```

**From SavedModel:**
```bash
pip install tensorflowjs

tensorflowjs_converter \
    --input_format=tf_saved_model \
    --output_format=tfjs_graph_model \
    /path/to/saved_model \
    public/models/stem-separation
```

**From PyTorch (via ONNX):**
```python
# 1. Export PyTorch to ONNX
torch.onnx.export(model, dummy_input, "model.onnx")

# 2. Convert ONNX to TensorFlow SavedModel
onnx_tf.backend.prepare(onnx_model).export_graph("saved_model")

# 3. Convert SavedModel to TensorFlow.js
tensorflowjs_converter \
    --input_format=tf_saved_model \
    saved_model \
    public/models/stem-separation
```

#### Option 3: Use Open-Source Models

**Spleeter (Deezer)**
- GitHub: https://github.com/deezer/spleeter
- Pre-trained models for 2-stem, 4-stem, 5-stem separation
- Can be converted to TensorFlow.js format

**Demucs (Meta Research)**
- GitHub: https://github.com/facebookresearch/demucs
- State-of-the-art separation quality
- Requires conversion from PyTorch

**Open-Unmix**
- Multiple implementations available
- Good quality for open-source

### Integrating Your Model

Once you have a TensorFlow.js model in `public/models/stem-separation/`:

1. **Update the code** (in `src/services/stemSeparation.js`):
```javascript
// Uncomment these lines and update the path:
this.model = await tf.loadGraphModel('/models/stem-separation/model.json')
this.useAIModel = true
```

2. **Restart the dev server**:
```bash
npm run dev
```

3. **The app will automatically use the AI model** instead of filters

### Model Performance Tips

**For Faster Processing:**
- Use quantized models (INT8 instead of FLOAT32)
- Reduce model complexity
- Enable WebGL backend (automatic in TensorFlow.js)

**For Better Quality:**
- Use larger models (but slower)
- Train on more diverse datasets
- Use ensemble models

## Browser Compatibility

TensorFlow.js supports multiple backends:

| Backend | Speed | Compatibility |
|---------|-------|---------------|
| WebGL   | Fast  | Chrome 60+, Firefox 51+, Safari 11+ |
| WASM    | Medium | Most modern browsers |
| CPU     | Slow  | Universal fallback |

The app automatically selects the best available backend.

## Example: Quick Test with Spleeter

If you want to quickly test with a real model:

```bash
# Install Spleeter
pip install spleeter

# Export 2-stem model
spleeter separate -p spleeter:2stems -o output audio.mp3

# Convert model to TensorFlow.js (requires additional setup)
# See: https://github.com/tensorflow/tfjs/tree/master/tfjs-converter
```

## Troubleshooting

**Model won't load:**
- Check browser console for errors
- Verify model.json is in correct location
- Ensure CORS headers allow model loading

**Out of memory:**
- Use a smaller model
- Process shorter audio chunks
- Reduce model precision (quantization)

**Slow processing:**
- Check if WebGL backend is active (console log shows backend)
- Close other browser tabs
- Try a lighter model

## Current Implementation

The stem separator service (`src/services/stemSeparation.js`) includes:
- ✅ TensorFlow.js initialization
- ✅ WebGL backend selection
- ✅ Fallback to filter-based demo mode
- ✅ Model loading infrastructure
- ⏳ TODO: Complete AI model inference pipeline

## Resources

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [TensorFlow.js Converter](https://github.com/tensorflow/tfjs/tree/master/tfjs-converter)
- [Audio Processing with TensorFlow](https://www.tensorflow.org/tutorials/audio/simple_audio)
- [Spleeter Repository](https://github.com/deezer/spleeter)
- [Demucs Repository](https://github.com/facebookresearch/demucs)
