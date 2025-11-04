# FFmpeg.wasm Setup Guide

This guide explains how to set up FFmpeg.wasm for the audio application with optimal performance and reliability.

## Overview

The application uses FFmpeg.wasm for universal audio format support. It tries to load FFmpeg from multiple sources in this order:

1. **Self-hosted files** (fastest, most reliable) - `/public/ffmpeg/`
2. **jsdelivr CDN** (backup)
3. **unpkg CDN** (last resort)
4. **Web Audio API** (fallback if FFmpeg fails completely)

## Self-Hosting FFmpeg Files (Recommended)

For best performance and reliability, host the FFmpeg core files locally:

### Step 1: Download FFmpeg Core Files

Download these three files from the CDN:

```bash
# Create directory
mkdir -p public/ffmpeg

# Download FFmpeg core files (version 0.12.6)
curl -L -o public/ffmpeg/ffmpeg-core.js https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js

curl -L -o public/ffmpeg/ffmpeg-core.wasm https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm

curl -L -o public/ffmpeg/ffmpeg-core.worker.js https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js
```

Or download manually:
- [ffmpeg-core.js](https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js)
- [ffmpeg-core.wasm](https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm)
- [ffmpeg-core.worker.js](https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js)

### Step 2: Verify Files

Check that all three files are in place:

```bash
ls -lh public/ffmpeg/
```

You should see:
- `ffmpeg-core.js` (~500 KB)
- `ffmpeg-core.wasm` (~32 MB)
- `ffmpeg-core.worker.js` (~2 KB)

### Step 3: Test

Start the development server:

```bash
npm run dev
```

Open the browser console and load an audio file. You should see:

```
Attempting to load FFmpeg from self-hosted...
✅ FFmpeg.wasm loaded successfully from self-hosted
```

## CDN-Only Setup (No Download Required)

If you don't want to self-host the files, the application will automatically use CDN fallback:

1. **jsdelivr CDN** (primary fallback)
2. **unpkg CDN** (secondary fallback)

The application will log which source was used:

```javascript
console.log('Attempting to load FFmpeg from jsdelivr...')
// or
console.log('Attempting to load FFmpeg from unpkg...')
```

## Supported Audio Formats

### With FFmpeg.wasm (Recommended)

**Import formats:**
- MP3
- AAC
- OPUS
- FLAC
- OGG
- M4A
- WAV
- WMA
- And many more...

**Export formats:**
- MP3 (64-320 kbps)
- AAC (64-320 kbps)
- OPUS (64-510 kbps)
- FLAC (lossless)
- WAV (uncompressed)

### Without FFmpeg (Fallback)

If FFmpeg fails to load, the application falls back to Web Audio API:

**Import formats (limited):**
- WAV
- MP3
- OGG
- M4A (browser-dependent)

**Export format:**
- WAV only (uncompressed)

## Troubleshooting

### FFmpeg fails to load from self-hosted

**Problem:** Console shows "Failed to load FFmpeg from self-hosted"

**Solutions:**
1. Verify files are in `/public/ffmpeg/` directory
2. Check file sizes (wasm should be ~32 MB)
3. Clear browser cache
4. Check browser console for CORS errors

### All FFmpeg sources fail

**Problem:** Console shows "Failed to load FFmpeg from all sources"

**Impact:** Limited to Web Audio API formats (WAV, MP3, OGG)

**Solutions:**
1. Check internet connection (for CDN)
2. Check if CDNs are accessible from your network
3. Use self-hosted files (recommended)
4. Disable any ad blockers or content filters

### File conversion fails

**Problem:** "FFmpeg conversion failed, falling back to Web Audio API"

**Solutions:**
1. Check if file format is supported
2. Try a different file
3. Check browser console for specific error
4. File may be corrupted

## Performance Comparison

| Method | Load Time | Reliability | Bandwidth |
|--------|-----------|-------------|-----------|
| Self-hosted | <1s | ⭐⭐⭐⭐⭐ | None |
| jsdelivr CDN | 2-5s | ⭐⭐⭐⭐ | ~32 MB |
| unpkg CDN | 3-7s | ⭐⭐⭐ | ~32 MB |
| Web Audio API | N/A | ⭐⭐ | None |

## Advanced Configuration

### Custom CDN

Edit `src/services/ffmpegService.js` to add custom CDN:

```javascript
const cdnURLs = {
  jsdelivr: `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${version}/dist/umd`,
  unpkg: `https://unpkg.com/@ffmpeg/core@${version}/dist/umd`,
  custom: 'https://your-cdn.com/path/to/ffmpeg'  // Add this
}
```

### Disable Self-Hosted

Remove self-hosted from the sources array:

```javascript
const sources = [
  // { name: 'self-hosted', loader: () => this.loadFromSelfHosted() },  // Commented out
  { name: 'jsdelivr', loader: () => this.loadFromCDN('jsdelivr') },
  { name: 'unpkg', loader: () => this.loadFromCDN('unpkg') }
]
```

### Force Web Audio API Only

Skip FFmpeg entirely:

```javascript
// In audioStore.js, comment out FFmpeg loading:
// if (!ffmpegService.isLoaded) {
//   await ffmpegService.load(...)
// }
```

## Checking FFmpeg Status

In browser console:

```javascript
// Check if FFmpeg is loaded
ffmpegService.getStatus()

// Returns:
{
  isLoaded: true,
  source: 'self-hosted',  // or 'jsdelivr', 'unpkg', null
  progress: 100
}
```

## File Size Considerations

### Self-Hosted Files
- Total: ~32.5 MB
- Cached after first load
- No external dependencies

### CDN Bandwidth
- Initial load: ~32 MB download
- Cached by browser
- Requires internet connection

## Browser Compatibility

FFmpeg.wasm requires:
- ✅ Chrome/Edge 87+
- ✅ Firefox 89+
- ✅ Safari 14.1+
- ❌ Internet Explorer (not supported)

Web Audio API fallback works on all modern browsers.

## Security Considerations

### Self-Hosted
- ✅ No external dependencies
- ✅ Full control over files
- ✅ No CDN downtime issues
- ✅ Works offline (after first load)

### CDN
- ⚠️ Requires trust in CDN provider
- ⚠️ Subject to CDN availability
- ⚠️ Network dependency
- ✅ Subresource Integrity (SRI) can be added

## Production Recommendations

1. **Always self-host** for production environments
2. Keep CDN fallback for redundancy
3. Enable gzip compression on server
4. Set proper cache headers (1 year)
5. Use a CDN (Cloudflare, etc.) for self-hosted files
6. Monitor FFmpeg load success rate
7. Have Web Audio API fallback as last resort

## Example Server Configuration

### Nginx

```nginx
location /ffmpeg/ {
    # Cache for 1 year
    expires 1y;
    add_header Cache-Control "public, immutable";

    # Enable gzip
    gzip on;
    gzip_types application/javascript application/wasm;
}
```

### Apache

```apache
<Directory /path/to/public/ffmpeg>
    # Cache for 1 year
    ExpiresActive On
    ExpiresDefault "access plus 1 year"

    # Enable gzip
    AddOutputFilterByType DEFLATE application/javascript application/wasm
</Directory>
```

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify file integrity (checksums)
3. Try different browsers
4. Clear cache and reload
5. Check network tab in dev tools
6. File an issue with:
   - Browser version
   - FFmpeg load source attempted
   - Console error messages
   - Network tab screenshots

## License

FFmpeg.wasm is licensed under LGPL 2.1 or later.

See: https://github.com/ffmpegwasm/ffmpeg.wasm

---

**Last Updated:** 2025-11-02
**FFmpeg.wasm Version:** 0.12.6
**@ffmpeg/ffmpeg Version:** 0.12.10
