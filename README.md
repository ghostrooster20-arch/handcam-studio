# HandCam Studio — Complete Build

This is the home implementation of the EP-25 AR piano.

## Start here

```powershell
cd "J:\virtual piano\handcam-studio"
npm install
npm run dev
```

Open `http://localhost:5173` for the desktop app.

For the phone companion page, use the same app URL with:

```text
?view=phone
```

A public HTTPS deployment is required for camera access. The recommended chain is:

1. Static hosting (Cloudflare Pages/GitHub Pages/Netlify)
2. Peer pairing via PeerJS cloud or your own PeerJS-compatible server
3. Phone scans the QR, grants camera permission, sends hand landmarks

## Desktop actions

- `Z` / `X` — octave down/up
- `M` — mute/unmute
- `1`–`6` — pads 1–6
- `Space` — sustain while held
- Mouse click on keys/pads
- Camera toggle in top bar

## AI requirements

No AI call is made until you explicitly request an action. Open Settings → AI and provide keys for OpenAI, Gemini, or an OpenAI-compatible OpenCode endpoint. Keys are stored locally in browser localStorage and are not logged.

## Logging

Open the Logs panel. You can filter, copy, clear, and export the current session logs. AI key material and camera video are never logged.

## Build artifacts

```powershell
npm run build
npm run preview
npm run electron
```

`npm run build` emits a static bundle to `dist/`. The public phone page uses the same bundle and the query parameter `?view=phone`.
