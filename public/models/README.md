# AI Models for Stem Separation

This directory should contain ONNX models for audio stem separation.

## Required Models

### 2-Stem Separation (Vocals/Instrumental)
Place a quantized ONNX model file here named:
- `demucs-2stem.onnx` (Recommended: Demucs v4 Hybrid Transformer)

## Where to Get Models

### Option 1: Hugging Face (Recommended)
Search for pre-converted ONNX models:
- https://huggingface.co/models?library=onnx&search=demucs
- https://huggingface.co/models?library=onnx&search=audio+separation

### Option 2: Convert from PyTorch
If you have a trained PyTorch model (like Demucs), convert it to ONNX:

```python
import torch
import onnx

# Load your PyTorch model
model = torch.load('demucs_model.pth')
model.eval()

# Export to ONNX
dummy_input = torch.randn(1, 2, 44100*30)  # 30 seconds stereo audio
torch.onnx.export(
    model,
    dummy_input,
    "demucs-2stem.onnx",
    opset_version=13,
    input_names=['audio'],
    output_names=['vocals', 'instrumental']
)
```

### Option 3: Use Pre-quantized Models
For better browser performance, use INT8 quantized models:
- Target size: 40-80MB
- Processing time: 30-60s for 3-minute song

## Model Requirements

- Format: ONNX (`.onnx` extension)
- Input: Stereo audio at 44.1kHz sample rate
- Output: 2 or 4 stems (vocals, instrumental, drums, bass)
- Recommended: Quantized to INT8 for browser performance

## Testing Your Model

After adding a model file:
1. Restart the dev server
2. Load an audio file in Webacity
3. Click "Separate Stems" in the toolbar
4. Wait for processing (30-60 seconds)
5. Download individual stems

## Performance Notes

Browser-based AI inference is slower than server-side:
- **Good**: Modern CPU (2020+), 8GB+ RAM
- **Better**: With WebGPU support (Chrome 113+)
- **Best**: Dedicated GPU + WebGPU

Expected processing times for 3-minute song:
- 2-stem: 30-60 seconds
- 4-stem: 60-120 seconds
