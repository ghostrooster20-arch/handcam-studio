# Deployment — GitHub Pages

The project is live at:

```text
https://ghostrooster20-arch.github.io/handcam-studio/
```

Pushing to `main` builds `dist/` with GitHub Actions and deploys it to Pages.

## Pairing

1. Open the site in the desktop browser.
2. Click **Pair phone**.
3. Scan the QR code with the phone.
4. Approve camera permission on the phone and confirm the verification code.
5. Position the phone above the desk as the down-facing camera.

The phone should open the same site and run `?view=phone`; the QR code creates that link.

## Security

- Camera video stays on the phone.
- The phone sends hand landmarks, not audio or video.
- AI credentials remain in the desktop browser's `localStorage`.
- Do not commit API keys or personal credentials.
