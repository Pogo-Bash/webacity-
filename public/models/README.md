# Stem Separation

Webacity uses **browser-based stem separation** to split audio into vocals and instrumental tracks.

## Current Implementation: Demo Mode

The app currently uses **Web Audio API frequency filters** for fast stem separation:

### How It Works
- **Vocals**: Isolates mid-range frequencies (300Hz - 3kHz) where human voice sits
- **Instrumental**: Emphasizes bass/treble, reduces mid-range vocals

### Performance
- ⚡ **Speed**: 1-2 seconds (extremely fast)
- ✅ **No downloads**: Works immediately
- 🎓 **Educational**: Shows how frequency-based separation works
- ⚠️ **Quality**: Approximate - not AI-powered

### Best Used For
- Quick previews
- Learning/education
- Karaoke practice tracks
- Rough vocal isolation

## Upgrading to AI-Based Separation

### Why It's Challenging
Browser-based AI stem separation faces several hurdles:

1. **Model Size**: Professional models (Spleeter, Demucs) are 100-500MB
   - Too large for fast browser loading
   - Requires significant memory

2. **Processing Power**: AI separation needs significant computation
   - 30-60 seconds for 3-minute song (even with WebGL)
   - Can freeze browser on slower machines

3. **Model Availability**: Few TensorFlow.js-ready models exist
   - Most are Python/TensorFlow only
   - Conversion is complex

### Alternative Approaches

#### 🏆 Recommended: Hybrid Approach
**Keep demo mode + add server-side option**

```javascript
// Pseudocode
if (userHasPremium && serverAvailable) {
  // Send to server with Spleeter/Demucs
  stems = await separateOnServer(audio)
} else {
  // Use fast filter-based demo
  stems = await separateWithFilters(audio)
}
```

Benefits:
- Free users get instant demo mode
- Premium users get professional quality
- No browser performance issues

#### Option 2: Spleeter Backend API
Set up a simple Flask/FastAPI server:

```python
# server.py
from spleeter.separator import Separator
from flask import Flask, request, send_file

app = Flask(__name__)
separator = Separator('spleeter:2stems')

@app.route('/separate', methods=['POST'])
def separate():
    audio_file = request.files['audio']
    stems = separator.separate(audio_file)
    return {"vocals": vocals_url, "instrumental": inst_url}
```

Then call from browser:
```javascript
const formData = new FormData()
formData.append('audio', audioBlob)
const response = await fetch('http://yourserver/separate', {
  method: 'POST',
  body: formData
})
```

#### Option 3: TensorFlow.js Model (Advanced)
If you find or create a TensorFlow.js model:

1. Place model in `public/models/stem-separation/`
2. Update `src/services/stemSeparation.js`:
```javascript
// Line 36-37, uncomment:
this.model = await tf.loadGraphModel('/models/stem-separation/model.json')
this.useAIModel = true
```

**Model Requirements:**
- Format: TensorFlow.js GraphModel
- Size: < 50MB (quantized recommended)
- Input: Audio tensor [batch, channels, samples]
- Output: 2 stems [vocals, instrumental]

### Finding TensorFlow.js Models

**Search locations:**
- TensorFlow Hub: https://tfhub.dev/?q=audio
- Hugging Face: https://huggingface.co/models?library=tfjs
- GitHub: Search "audio separation tfjs"

**Example searches:**
- "audio source separation tensorflow.js"
- "vocal isolation tfjs model"
- "music demixing tensorflowjs"

## Improving Demo Mode Quality

The current demo mode can be enhanced:

### 1. Better Frequency Targeting
```javascript
// Enhance vocal isolation
const vocalEQ = [
  { freq: 200, type: 'highpass', Q: 1.0 },
  { freq: 1200, type: 'peaking', Q: 2.0, gain: 3 },  // Boost vocal presence
  { freq: 3000, type: 'peaking', Q: 1.5, gain: 2 },  // Brighten vocals
  { freq: 8000, type: 'lowpass', Q: 0.7 }
]
```

### 2. Phase Inversion
Use stereo phase differences to isolate center vocals:
```javascript
// vocals ≈ (left - right) / 2  // Center channel
// instrumental ≈ (left + right) / 2  // Side channels
```

### 3. Multi-band Processing
Split into frequency bands, process separately:
- Low (< 250Hz): Bass, kick drum
- Mid (250Hz - 4kHz): Vocals, snare
- High (> 4kHz): Cymbals, air

## Real-World Examples

### Companies Using Browser ML for Audio

**Lalal.ai** - Server-side Spleeter
- Upload audio → process on servers → download stems
- Professional quality
- Requires payment

**Moises.ai** - Hybrid approach
- Quick preview in browser
- Full separation on servers
- Freemium model

**Vocal Remover (Chrome Extension)**
- Uses server-side processing
- Free tier with limitations

## Performance Comparison

| Method | Speed | Quality | Cost | Offline |
|--------|-------|---------|------|---------|
| Demo (filters) | ⚡ 1-2s | ⭐⭐ | Free | ✅ |
| Browser AI | 🐌 30-60s | ⭐⭐⭐ | Free | ✅ |
| Server (Spleeter) | ⚡ 5-10s | ⭐⭐⭐⭐⭐ | Server cost | ❌ |
| Server (Demucs) | 🐌 20-30s | ⭐⭐⭐⭐⭐ | Server cost | ❌ |

## Recommendation

**For your use case:**

1. **Start**: Keep the fast demo mode ✅ (already working!)
2. **Improve**: Add phase-based vocal isolation
3. **Enhance**: Multi-band frequency processing
4. **Future**: Add server-side Spleeter as premium feature

The demo mode is actually quite useful for:
- Quick vocal removal
- Karaoke backing tracks
- Educational purposes
- Prototyping

**For professional quality**, you really need server-side processing. Browser AI is possible but limited by:
- Model size constraints
- Processing speed
- Memory limitations
- Battery/CPU usage

## Code Examples Ready to Use

The infrastructure is in place:
- ✅ TensorFlow.js initialized
- ✅ Service architecture ready
- ✅ UI components built
- ✅ Progress tracking
- ✅ Stem download/import

Just needs:
- A TensorFlow.js model file (if going browser AI route)
- Or a backend API endpoint (if going server route)

---

**Bottom line**: The current demo mode is a great starting point. For professional quality, consider a hybrid approach with server-side processing for premium users.
