# Deployment Guide - Webacity

This guide covers deploying Webacity to various platforms.

## Deploying to Render

### Option 1: One-Click Deploy (Recommended)

1. Push your code to GitHub (if not already done)
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click **New** → **Web Service**
4. Connect your GitHub repository
5. Render will automatically detect the `render.yaml` configuration

The app will be deployed automatically with these settings:
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Port: Automatically assigned by Render

### Option 2: Manual Configuration

If you prefer to configure manually:

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Web Service**
3. Connect your repository
4. Configure the following:
   - **Name**: `webacity` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `claude/web-audio-editor-011CUKZAP5YUbKuJtNkYSanY` (or main)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid plan)

5. Click **Create Web Service**

### Environment Variables

No additional environment variables are required for basic deployment. The app automatically uses Render's `PORT` environment variable.

### Post-Deployment

After deployment:
1. Your app will be available at `https://your-app-name.onrender.com`
2. First build may take 2-3 minutes
3. Free tier apps may sleep after 15 minutes of inactivity

## Deploying to Other Platforms

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts

Or use the Vercel dashboard to import your GitHub repository.

### Netlify

1. Build the app: `npm run build`
2. Drag the `dist` folder to [Netlify Drop](https://app.netlify.com/drop)

Or connect your GitHub repository in the Netlify dashboard:
- Build command: `npm run build`
- Publish directory: `dist`

### Railway

1. Go to [Railway](https://railway.app/)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway will auto-detect the configuration
5. Set start command to: `npm start`

### Heroku

1. Create `Procfile` in root:
   ```
   web: npm start
   ```

2. Deploy:
   ```bash
   heroku create your-app-name
   git push heroku main
   ```

## WASM Module Deployment

The app includes JavaScript fallbacks for all audio processing, so WASM modules are optional.

### To deploy with WASM modules:

1. Install Emscripten SDK locally
2. Build WASM modules:
   ```bash
   cd src/wasm
   ./build.sh
   ```
3. Commit the compiled modules in `public/wasm/`
4. Deploy as normal

The compiled WASM files will be served from the `public/wasm/` directory.

## Performance Optimization

For production deployment:

1. **Enable HTTPS**: Always use HTTPS for Web Audio API
2. **Enable Compression**: Most platforms enable gzip/brotli by default
3. **CDN**: Use a CDN for static assets (most platforms include this)
4. **WASM**: Compile WASM modules for better audio processing performance

## Troubleshooting

### App not loading

- Check browser console for errors
- Ensure HTTPS is enabled (required for Web Audio API)
- Check that all environment variables are set correctly

### Audio not working

- Ensure the browser supports Web Audio API (all modern browsers do)
- Check that you're using HTTPS (HTTP won't work for audio in many browsers)
- Verify audio files are in supported formats

### Build failures

- Ensure Node.js version is 18 or higher
- Run `npm install` to ensure all dependencies are installed
- Check build logs for specific errors

## Custom Domain

Most platforms allow custom domains:
- **Render**: Settings → Custom Domain
- **Vercel**: Project Settings → Domains
- **Netlify**: Site Settings → Domain Management

## Monitoring

Consider adding:
- Error tracking (Sentry, LogRocket)
- Analytics (Google Analytics, Plausible)
- Performance monitoring (Web Vitals)

## Security Headers

For production, consider adding these headers (usually configured in platform dashboard):
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: microphone=(self)
```

## Support

For deployment issues:
- Check the platform's documentation
- Review build logs
- Open an issue on GitHub

---

Happy deploying! 🚀
