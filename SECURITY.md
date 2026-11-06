# Security

## AI credentials

- User-entered keys are stored only in `localStorage` on the desktop browser.
- No key is sent anywhere except the provider endpoint selected by the user.
- Do not put real keys in `.env.example`, source, git history, logs, QR codes, or screenshots.
- Clear keys from **Settings → AI → Clear keys** when lending the machine.

## Phone pairing

- Pairing tokens are random, single-use, and short-lived.
- The QR link contains a room/peer identifier, never the AI key.
- Reject duplicate/stale connections.
- The desktop must display and verify a visible code before accepting remote input.
- Disconnects are treated as stale until a new handshake succeeds.
- Remote landmark input cannot change AI settings or reveal keys.

## Privacy

- Camera video stays in the local browser; the phone page uses on-device detection.
- No video, audio, or photos are transmitted over WebRTC.
- AI prompts include only entered/asked data, not camera frames by default.

## Network

- Plain HTTP on a LAN is not sufficient for camera permissions in most mobile browsers.
- Prefer HTTPS static hosting or a local tunnel.
- Never use public plain HTTP with real credentials.
