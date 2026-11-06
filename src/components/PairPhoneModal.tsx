import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { LinkState } from '../pairing/PeerLink';

interface PairingState {
  status: LinkState | 'idle';
  url: string;
  code: string;
  room: string;
  phoneName: string;
  detail: string;
}

interface PairPhoneModalProps {
  open: boolean;
  pairing: PairingState;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
}

export default function PairPhoneModal({ open, pairing, onClose, onStart, onStop }: PairPhoneModalProps) {
  const [qr, setQr] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!pairing.url) return;
    QRCode.toDataURL(pairing.url, { margin: 1, width: 256, errorCorrectionLevel: 'M', color: { dark: '#02070c', light: '#f7fbffff' } })
      .then((data) => { if (mounted) setQr(data); })
      .catch(() => { if (mounted) setQr(''); });
    return () => { mounted = false; };
  }, [pairing.url]);

  if (!open) return null;
  const ready = pairing.status === 'waiting' || pairing.status === 'connected';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pair-title">
      <section className="pair-modal">
        <div className="panel-header"><h2 id="pair-title">Pair phone camera</h2><button type="button" onClick={onClose} aria-label="Close pairing">×</button></div>
        <div className="pair-body">
          <div className="qr-stage">
            {pairing.url && qr ? <img src={qr} width={220} height={220} alt={`Pairing QR for Desktop session ${pairing.code}`} /> : (
              <div className="qr-placeholder"><span>QR</span><small>Generate a one-time pairing</small></div>
            )}
          </div>

          <div className="pair-info">
            <div className={`connection-badge ${pairing.status}`}>{pairing.status.replace('-', ' ')}</div>
            <h3>Use your phone as the down-facing camera</h3>
            <ol className="pair-steps">
              <li>Click <strong>Generate pairing</strong> below.</li>
              <li>Show the QR to your phone camera.</li>
              <li>Open the HTTPS link; allow camera permission.</li>
              <li>Confirm the verification code.</li>
              <li>Place the mounted phone above the desk.</li>
            </ol>
            <div className="verification"><span>Verification code</span><strong className="code">{pairing.code}</strong></div>
            {pairing.phoneName && <p className="phone-name"><strong>{pairing.phoneName}</strong> is linked.</p>}
            <p className="muted">{pairing.detail || 'No remote peer connected yet.'}</p>
            <label className="pair-url">Pairing URL<input readOnly value={pairing.url || 'Click Generate pairing to create link'} /></label>
            <div className="button-row">
              {!ready && <button type="button" className="primary-button" onClick={onStart}>Generate pairing</button>}
              {ready && <button type="button" className="ghost-danger" onClick={onStop}>Disconnect phone</button>}
              <button type="button" className="ghost-button" onClick={() => navigator.clipboard?.writeText(pairing.url)} disabled={!pairing.url}>Copy link</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
