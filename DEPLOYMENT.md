# Deployment — Phone Pairing

The phone companion cannot use a camera on a private HTTP address in most browsers. Deploy the static build on any HTTPS static host, or use a local secure setup.

## Static deployment

```powershell
npm run build
# upload dist/* to your static host
```

Then share:

```text
https://<your-host>/?view=phone
```

## Pairing

1. Desktop opens with `?view=desktop` or no parameter.
2. Click **Pair phone**.
3. PC displays a QR code and a short verification number.
4. Phone opens the link and grants camera access.
5. Desktop verifies the short-lived room/peer code before accepting landmark frames.
6. Phone streams hands to the desktop over PeerJS/WebRTC.

## Security

- Pairing room and verification token are random and expire quickly.
- Only one phone may connect per session.
- No video or audio is transmitted.
- Keys and logs never leave the browser except for intentional AI requests.
- If the phone disconnects, desktop shows a warning and stops accepting remote hand data until repaired.

## Local development fallback

For desktop testing without deployment, use `localhost` on the desktop browser. Phone pairing still requires either HTTPS or a tunnel (for example `cloudflared tunnel` or `ngrok http 5173`). Don't expose your machine without authentication.
