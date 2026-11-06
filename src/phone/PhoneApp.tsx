import { useEffect, useMemo, useRef, useState } from 'react';
import { HandTracker } from '../vision/HandTracker';
import { PeerLink, type HandFramePacket } from '../pairing/PeerLink';
import HandOverlay from '../components/HandOverlay';
import type { HandFrame } from '../types';
import { pushLog } from '../lib/logger';

type PhoneStatus = 'idle' | 'connecting' | 'connected' | 'waiting' | 'error';

export default function PhoneApp() {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const room = search.get('room') ?? '';
  const code = search.get('code') ?? '';
  const [status, setStatus] = useState<PhoneStatus>('idle');
  const [detail, setDetail] = useState(room && code ? 'Ready to connect to the desktop.' : 'Missing ROOM or CODE in the QR link.');
  const [hands, setHands] = useState<HandFrame[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [frameRate, setFrameRate] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const peerRef = useRef<PeerLink | null>(null);
  const lastSentRef = useRef(0);
  const seqRef = useRef(0);
  const fpsSamples = useRef<number[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      trackerRef.current?.dispose();
      peerRef.current?.close();
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    };
  }, []);

  const sendHands = (frames: HandFrame[]) => {
    const now = performance.now();
    setHands(frames);
    fpsSamples.current.push(now);
    while (fpsSamples.current.length > 30) fpsSamples.current.shift();
    if (fpsSamples.current.length >= 2) {
      const span = fpsSamples.current[fpsSamples.current.length - 1] - fpsSamples.current[0];
      setFrameRate((fpsSamples.current.length - 1) * 1000 / Math.max(1, span));
    }
    if (now - lastSentRef.current < 33) return;
    lastSentRef.current = now;
    const video = videoRef.current;
    if (!video || !peerRef.current?.isConnected()) return;
    const packet: HandFramePacket = {
      type: 'hand-frame',
      seq: ++seqRef.current,
      ts: Date.now(),
      fps: Math.round(fpsSamples.current.length * 1000 / Math.max(1, fpsSamples.current[fpsSamples.current.length - 1] - fpsSamples.current[0])),
      width: video.videoWidth || 640,
      height: video.videoHeight || 480,
      hands: frames.map((hand) => ({
        handedness: hand.handedness,
        score: hand.score,
        landmarks: hand.landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z, presence: point.presence ?? 1 })),
      })),
    };
    peerRef.current.send(packet);
  };

  const connect = async () => {
    if (!room || !code) {
      setStatus('error');
      setDetail('This phone link is incomplete. Re-scan the QR from the desktop.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setDetail('Camera API is not available. Use a modern browser over HTTPS.');
      return;
    }
    setStatus('connecting');
    setDetail('Opening pairing channel…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'environment',
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Video element missing');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      await video.play();
      setCameraOn(true);
      pushLog('info', 'phone', 'Camera started', { width: video.videoWidth, height: video.videoHeight });

      const link = new PeerLink({
        role: 'phone',
        room,
        code,
        onState: (state, detail) => {
          setDetail(detail ?? state);
          setStatus(state === 'connected' ? 'connected' : state === 'error' ? 'error' : 'waiting');
        },
        onData: (data) => pushLog('info', 'phone', 'Desktop message', data),
      });
      peerRef.current = link;
      await link.connect();

      const tracker = new HandTracker();
      trackerRef.current = tracker;
      const init = await tracker.init();
      if (!init.ok) throw new Error(init.message);
      await tracker.startFromCamera(video, sendHands);
      setStatus('connected');
      setDetail('Phone camera is live. Keep it mounted over the desk.');
    } catch (error) {
      const text = String(error);
      setStatus('error');
      setDetail(text);
      pushLog('error', 'phone', 'Phone startup failed', { error: text });
    }
  };

  const disconnect = async () => {
    trackerRef.current?.stop();
    peerRef.current?.close();
    peerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setCameraOn(false);
    setHands([]);
    setStatus('idle');
    setDetail('Disconnected. You can scan the QR again to re-pair.');
  };

  const complete = status === 'connected';

  return (
    <main className="phone-app">
      <section className="camera-stage" aria-label="Phone camera preview">
        <video ref={videoRef} className={`phone-video${mirror ? ' mirrored' : ''}`} playsInline muted />
        <HandOverlay hands={hands} overlay="neon" mirror={mirror} />
        {!cameraOn && <div className="phone-empty"><p>Camera not started</p><small>This page needs HTTPS permission; it never uploads video.</small></div>}
        <div className="phone-status"><span className={`status-dot ${complete ? 'ok' : status}`}>{complete ? 'LIVE' : status.toUpperCase()}</span><span>{Math.round(frameRate) || 0} FPS</span><span>Room {room.slice(0, 10) || 'missing'}</span></div>
      </section>

      <section className="phone-console">
        <header><h1>HandCam Companion</h1><p>Use this phone as a down-facing camera for the EP-25 AR keyboard.</p></header>
        <div className="phone-verification"><span>Verification code</span><strong>{code || 'missing'}</strong></div>
        <p>{detail}</p>
        <div className="phone-actions">
          <button type="button" className="primary-button" onClick={connect} disabled={status === 'connecting' || complete}>Start camera + pair</button>
          <button type="button" className="ghost-button" onClick={() => setMirror((value) => !value)}>{mirror ? 'Un-flip preview' : 'Flip preview'}</button>
          <button type="button" className="ghost-danger" onClick={disconnect} disabled={!cameraOn && !peerRef.current}>Disconnect</button>
        </div>
        <details><summary>What is sent</summary><p>Only sparse normalized hand landmarks, timestamps and camera metadata. No video, audio or photos leave this page.</p></details>
        <details><summary>Mounting checklist</summary><p>Mount the phone flat and facing downward, centered over the keybed. Avoid glare; no object should cover the camera. Keep both hands visible inside the frame.</p></details>
      </section>
    </main>
  );
}
